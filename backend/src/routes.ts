import { Router, Request, Response } from 'express';
import {
  getAllTrades, getTradeById, createTrade, updateTrade, deleteTrade,
  getAllUsTrades, getUsTradeById, createUsTrade, updateUsTrade, deleteUsTrade,
  getSettings, saveSettings,
} from './database';
import { Trade, ExitRecord } from './types';

const router = Router();

function calcDaysInTrade(entryDate: string, exitDate: string | null): string {
  const entry = new Date(entryDate);
  const exit = exitDate ? new Date(exitDate) : new Date();
  const diff = Math.round((exit.getTime() - entry.getTime()) / (1000 * 60 * 60 * 24));
  return `${Math.max(0, diff)}d`;
}

function enrichTrade(trade: Trade, portfolioSize: number) {
  const invested = trade.entry_price * trade.entry_quantity;
  const pfPercentage = portfolioSize > 0 ? (invested / portfolioSize) * 100 : 0;

  let totalExitQty = 0;
  let totalPL = 0;
  let totalProceeds = 0;
  let lastExitDate: string | null = null;
  const exitReasons: string[] = [];
  const exitEmotions: string[] = [];

  if (trade.exits && trade.exits.length > 0) {
    for (const e of trade.exits) {
      totalExitQty += e.quantity;
      totalPL += (e.price - trade.entry_price) * e.quantity;
      totalProceeds += e.price * e.quantity;
      if (e.reason) exitReasons.push(e.reason);
      if (e.emotions) exitEmotions.push(e.emotions);
    }
    lastExitDate = trade.exits[trade.exits.length - 1].date;
  } else if (trade.exit_quantity != null && trade.exit_price != null) {
    // Legacy scalar fallback
    totalExitQty = trade.exit_quantity;
    totalPL = (trade.exit_price - trade.entry_price) * trade.exit_quantity;
    totalProceeds = trade.exit_price * trade.exit_quantity;
    lastExitDate = trade.exit_date;
    if (trade.reason_for_exit) exitReasons.push(trade.reason_for_exit);
    if (trade.emotions) exitEmotions.push(trade.emotions);
  }

  let status: 'Open' | 'Partial' | 'Closed';
  if (totalExitQty <= 0) status = 'Open';
  else if (totalExitQty >= trade.entry_quantity) status = 'Closed';
  else status = 'Partial';

  const exitDateForDays = status === 'Closed' ? lastExitDate : null;
  const weightedExitPrice = totalExitQty > 0 ? totalProceeds / totalExitQty : null;

  return {
    ...trade,
    exits: trade.exits ?? [],
    status,
    // Scalar display fields derived from exits array so the table always shows correct totals
    exit_quantity: totalExitQty > 0 ? totalExitQty : null,
    exit_price: weightedExitPrice,
    exit_date: lastExitDate,
    reason_for_exit: exitReasons.join(' | '),
    emotions: exitEmotions.join(' | '),
    days_in_trade: calcDaysInTrade(trade.entry_date, exitDateForDays),
    invested,
    pf_percentage: pfPercentage,
    pl: totalPL,
    pl_percentage: invested > 0 ? (totalPL / invested) * 100 : 0,
  };
}

function enrichAll(trades: Trade[], portfolioSize: number) {
  return trades.map(t => enrichTrade(t, portfolioSize));
}

// Only updates entry fields; always preserves exits and legacy scalar exit fields
function buildEntryPayload(body: Trade, existing: Trade) {
  return {
    stock: body.stock ? body.stock.toUpperCase().trim() : existing.stock,
    entry_date: body.entry_date || existing.entry_date,
    entry_quantity: body.entry_quantity ? Number(body.entry_quantity) : existing.entry_quantity,
    entry_price: body.entry_price ? Number(body.entry_price) : existing.entry_price,
    reason_for_entry: body.reason_for_entry !== undefined ? body.reason_for_entry : existing.reason_for_entry,
    // Always preserve exit data
    exit_date: existing.exit_date,
    exit_quantity: existing.exit_quantity,
    exit_price: existing.exit_price,
    reason_for_exit: existing.reason_for_exit,
    emotions: existing.emotions,
    exits: existing.exits,
  };
}

// ── India trades ──────────────────────────────────────────────────────────────

router.get('/trades', (_req: Request, res: Response) => {
  const { portfolio_size } = getSettings();
  res.json(enrichAll(getAllTrades(), portfolio_size));
});

router.get('/trades/:id', (req: Request, res: Response) => {
  const trade = getTradeById(parseInt(req.params.id));
  if (!trade) return res.status(404).json({ error: 'Trade not found' });
  const { portfolio_size } = getSettings();
  res.json(enrichTrade(trade, portfolio_size));
});

router.post('/trades', (req: Request, res: Response) => {
  const body = req.body as Trade;
  if (!body.stock || !body.entry_date || !body.entry_quantity || !body.entry_price) {
    return res.status(400).json({ error: 'Required: stock, entry_date, entry_quantity, entry_price' });
  }
  const trade = createTrade({
    stock: body.stock.toUpperCase().trim(),
    entry_date: body.entry_date,
    entry_quantity: Number(body.entry_quantity),
    entry_price: Number(body.entry_price),
    reason_for_entry: body.reason_for_entry || '',
    exit_date: null,
    exit_quantity: null,
    exit_price: null,
    reason_for_exit: '',
    emotions: '',
    exits: [],
  });
  const { portfolio_size } = getSettings();
  res.status(201).json(enrichTrade(trade, portfolio_size));
});

router.put('/trades/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const existing = getTradeById(id);
  if (!existing) return res.status(404).json({ error: 'Trade not found' });
  const updated = updateTrade(id, buildEntryPayload(req.body as Trade, existing));
  if (!updated) return res.status(404).json({ error: 'Trade not found' });
  const { portfolio_size } = getSettings();
  res.json(enrichTrade(updated, portfolio_size));
});

router.delete('/trades/:id', (req: Request, res: Response) => {
  const deleted = deleteTrade(parseInt(req.params.id));
  if (!deleted) return res.status(404).json({ error: 'Trade not found' });
  res.json({ success: true });
});

router.post('/trades/:id/exits', (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const trade = getTradeById(id);
  if (!trade) return res.status(404).json({ error: 'Trade not found' });

  const newExit: ExitRecord = {
    date: req.body.date,
    quantity: Number(req.body.quantity),
    price: Number(req.body.price),
    reason: req.body.reason || '',
    emotions: req.body.emotions || '',
  };

  // Auto-migrate legacy scalar fields to exits array on first new close
  let exits: ExitRecord[] = trade.exits ? [...trade.exits] : [];
  if (exits.length === 0 && trade.exit_quantity && trade.exit_price) {
    exits = [{
      date: trade.exit_date || new Date().toISOString().slice(0, 10),
      quantity: trade.exit_quantity,
      price: trade.exit_price,
      reason: trade.reason_for_exit || '',
      emotions: trade.emotions || '',
    }];
  }
  exits.push(newExit);

  const updated = updateTrade(id, { ...trade, exits });
  if (!updated) return res.status(404).json({ error: 'Trade not found' });
  const { portfolio_size } = getSettings();
  res.json(enrichTrade(updated, portfolio_size));
});

// ── US trades ─────────────────────────────────────────────────────────────────

router.get('/us-trades', (_req: Request, res: Response) => {
  const { us_portfolio_size } = getSettings();
  res.json(enrichAll(getAllUsTrades(), us_portfolio_size));
});

router.get('/us-trades/:id', (req: Request, res: Response) => {
  const trade = getUsTradeById(parseInt(req.params.id));
  if (!trade) return res.status(404).json({ error: 'Trade not found' });
  const { us_portfolio_size } = getSettings();
  res.json(enrichTrade(trade, us_portfolio_size));
});

router.post('/us-trades', (req: Request, res: Response) => {
  const body = req.body as Trade;
  if (!body.stock || !body.entry_date || !body.entry_quantity || !body.entry_price) {
    return res.status(400).json({ error: 'Required: stock, entry_date, entry_quantity, entry_price' });
  }
  const trade = createUsTrade({
    stock: body.stock.toUpperCase().trim(),
    entry_date: body.entry_date,
    entry_quantity: Number(body.entry_quantity),
    entry_price: Number(body.entry_price),
    reason_for_entry: body.reason_for_entry || '',
    exit_date: null,
    exit_quantity: null,
    exit_price: null,
    reason_for_exit: '',
    emotions: '',
    exits: [],
  });
  const { us_portfolio_size } = getSettings();
  res.status(201).json(enrichTrade(trade, us_portfolio_size));
});

router.put('/us-trades/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const existing = getUsTradeById(id);
  if (!existing) return res.status(404).json({ error: 'Trade not found' });
  const updated = updateUsTrade(id, buildEntryPayload(req.body as Trade, existing));
  if (!updated) return res.status(404).json({ error: 'Trade not found' });
  const { us_portfolio_size } = getSettings();
  res.json(enrichTrade(updated, us_portfolio_size));
});

router.delete('/us-trades/:id', (req: Request, res: Response) => {
  const deleted = deleteUsTrade(parseInt(req.params.id));
  if (!deleted) return res.status(404).json({ error: 'Trade not found' });
  res.json({ success: true });
});

router.post('/us-trades/:id/exits', (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const trade = getUsTradeById(id);
  if (!trade) return res.status(404).json({ error: 'Trade not found' });

  const newExit: ExitRecord = {
    date: req.body.date,
    quantity: Number(req.body.quantity),
    price: Number(req.body.price),
    reason: req.body.reason || '',
    emotions: req.body.emotions || '',
  };

  let exits: ExitRecord[] = trade.exits ? [...trade.exits] : [];
  if (exits.length === 0 && trade.exit_quantity && trade.exit_price) {
    exits = [{
      date: trade.exit_date || new Date().toISOString().slice(0, 10),
      quantity: trade.exit_quantity,
      price: trade.exit_price,
      reason: trade.reason_for_exit || '',
      emotions: trade.emotions || '',
    }];
  }
  exits.push(newExit);

  const updated = updateUsTrade(id, { ...trade, exits });
  if (!updated) return res.status(404).json({ error: 'Trade not found' });
  const { us_portfolio_size } = getSettings();
  res.json(enrichTrade(updated, us_portfolio_size));
});

// ── Settings ──────────────────────────────────────────────────────────────────

router.get('/settings', (_req: Request, res: Response) => {
  res.json(getSettings());
});

router.put('/settings', (req: Request, res: Response) => {
  const { portfolio_size, us_portfolio_size, usd_to_inr } = req.body;
  const updated = {
    portfolio_size: parseFloat(String(portfolio_size)) || 300000,
    us_portfolio_size: parseFloat(String(us_portfolio_size)) || 50000,
    usd_to_inr: parseFloat(String(usd_to_inr)) || 84,
  };
  saveSettings(updated);
  res.json(updated);
});

export default router;

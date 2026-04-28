import { Trade, StockPrice } from '../types';

interface Props {
  trades: Trade[];
  currency: 'INR' | 'USD';
  exchangeRate?: number;
  dateRates?: Record<string, number>;
  stockPrices?: Record<string, StockPrice>;
  exchange: 'US' | 'IN';
}

function fmt(n: number, decimals = 0, locale = 'en-IN'): string {
  return n.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function SummaryCards({ trades, currency, exchangeRate, dateRates, stockPrices, exchange }: Props) {
  const sym = currency === 'INR' ? '₹' : '$';
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  const rate = currency === 'INR' ? exchangeRate ?? 1 : 1;

  const closed = trades.filter(t => t.status === 'Closed');
  const open   = trades.filter(t => t.status === 'Open');

  const totalPL       = closed.reduce((s, t) => {
    // Only apply exchange rate for US trades (exchange === 'US') when displaying in INR
    const tradeRate = currency === 'INR' && exchange === 'US' ? (dateRates?.[t.entry_date] ?? rate) : 1;
    return s + ((t.pl ?? 0) * tradeRate);
  }, 0);
  const totalInvested = closed.reduce((s, t) => {
    // Only apply exchange rate for US trades (exchange === 'US') when displaying in INR
    const tradeRate = currency === 'INR' && exchange === 'US' ? (dateRates?.[t.entry_date] ?? rate) : 1;
    return s + ((t.invested ?? 0) * tradeRate);
  }, 0);
  const totalPLPct    = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

  const winners = closed.filter(t => (t.pl ?? 0) > 0);
  const losers  = closed.filter(t => (t.pl ?? 0) < 0);
  const winRate = closed.length > 0 ? (winners.length / closed.length) * 100 : 0;

  const avgWin  = winners.length > 0 ? winners.reduce((s, t) => {
    // Only apply exchange rate for US trades (exchange === 'US') when displaying in INR
    const tradeRate = currency === 'INR' && exchange === 'US' ? (dateRates?.[t.entry_date] ?? rate) : 1;
    return s + ((t.pl ?? 0) * tradeRate);
  }, 0) / winners.length : 0;
  const avgLoss = losers.length > 0 ? losers.reduce((s, t) => {
    // Only apply exchange rate for US trades (exchange === 'US') when displaying in INR
    const tradeRate = currency === 'INR' && exchange === 'US' ? (dateRates?.[t.entry_date] ?? rate) : 1;
    return s + ((t.pl ?? 0) * tradeRate);
  }, 0) / losers.length : 0;

  const openInvested = open.reduce((s, t) => {
    // Only apply exchange rate for US trades (exchange === 'US') when displaying in INR
    const tradeRate = currency === 'INR' && exchange === 'US' ? (dateRates?.[t.entry_date] ?? rate) : 1;
    return s + ((t.invested ?? 0) * tradeRate);
  }, 0);

  // Calculate unrealized P&L for open positions
  const unrealizedPL = open.reduce((s, t) => {
    const stockKey = `${t.stock}:${exchange}`;
    const currentPrice = stockPrices?.[stockKey]?.currentPrice;
    if (!currentPrice || !t.entry_quantity) return s;

    // Current market value in display currency
    const currentValue = t.entry_quantity * currentPrice * (currency === 'INR' && exchange === 'US' ? rate : 1);
    
    // Invested amount in display currency (t.invested is already in the trade's currency)
    const investedValue = (t.invested ?? 0) * (currency === 'INR' && exchange === 'US' ? (dateRates?.[t.entry_date] ?? rate) : 1);
    
    return s + (currentValue - investedValue);
  }, 0);

  const cards = [
    { label: 'Total Trades', value: fmt(trades.length, 0, locale), color: 'neutral' },
    { label: 'Open Positions', value: fmt(open.length, 0, locale), color: 'neutral' },
    { label: 'Capital in Open', value: `${sym}${fmt(openInvested, 0, locale)}`, color: 'neutral' },
    { label: 'Unrealised P/L', value: `${unrealizedPL >= 0 ? '+' : ''}${sym}${fmt(Math.abs(unrealizedPL), 0, locale)}`, color: unrealizedPL > 0 ? 'green' : unrealizedPL < 0 ? 'red' : 'neutral' },
    { label: 'Realised P/L', value: `${totalPL >= 0 ? '+' : ''}${sym}${fmt(Math.abs(totalPL), 0, locale)}`, color: totalPL > 0 ? 'green' : totalPL < 0 ? 'red' : 'neutral' },
    { label: 'P/L %', value: `${totalPLPct >= 0 ? '+' : ''}${totalPLPct.toFixed(2)}%`, color: totalPLPct > 0 ? 'green' : totalPLPct < 0 ? 'red' : 'neutral' },
    { label: 'Win Rate', value: closed.length ? `${winRate.toFixed(1)}%` : '—', color: winRate >= 50 ? 'green' : 'red' },
    { label: `Avg Win (${sym})`, value: winners.length ? `+${sym}${fmt(avgWin, 0, locale)}` : '—', color: 'green' },
    { label: `Avg Loss (${sym})`, value: `-${sym}${fmt(Math.abs(avgLoss), 0, locale)}`, color: 'red' },
  ];

  return (
    <div className="summary-grid">
      {cards.map(c => (
        <div key={c.label} className="summary-card">
          <div className="label">{c.label}</div>
          <div className={`value ${c.color}`}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

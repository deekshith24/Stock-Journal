import fs from 'fs';
import path from 'path';
import { Trade } from './types';

const DATA_DIR = path.join(__dirname, '../../data');
const TRADES_FILE = path.join(DATA_DIR, 'trades.json');
const US_TRADES_FILE = path.join(DATA_DIR, 'us_trades.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(TRADES_FILE)) fs.writeFileSync(TRADES_FILE, JSON.stringify([]));
if (!fs.existsSync(US_TRADES_FILE)) fs.writeFileSync(US_TRADES_FILE, JSON.stringify([]));
if (!fs.existsSync(SETTINGS_FILE)) fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ portfolio_size: 300000, us_portfolio_size: 50000 }));

function readTrades(): Trade[] {
  return JSON.parse(fs.readFileSync(TRADES_FILE, 'utf-8')) as Trade[];
}

function writeTrades(trades: Trade[]): void {
  fs.writeFileSync(TRADES_FILE, JSON.stringify(trades, null, 2));
}

function readUsTrades(): Trade[] {
  return JSON.parse(fs.readFileSync(US_TRADES_FILE, 'utf-8')) as Trade[];
}

function writeUsTrades(trades: Trade[]): void {
  fs.writeFileSync(US_TRADES_FILE, JSON.stringify(trades, null, 2));
}

function sortTrades(trades: Trade[]): Trade[] {
  return trades.sort((a, b) => {
    const d = new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime();
    return d !== 0 ? d : (b.id ?? 0) - (a.id ?? 0);
  });
}

export function getAllTrades(): Trade[] {
  return sortTrades(readTrades());
}

export function getTradeById(id: number): Trade | undefined {
  return readTrades().find(t => t.id === id);
}

export function createTrade(data: Omit<Trade, 'id' | 'created_at'>): Trade {
  const trades = readTrades();
  const maxId = trades.reduce((m, t) => Math.max(m, t.id ?? 0), 0);
  const trade: Trade = { ...data, id: maxId + 1, created_at: new Date().toISOString() };
  trades.push(trade);
  writeTrades(trades);
  return trade;
}

export function updateTrade(id: number, data: Partial<Trade>): Trade | null {
  const trades = readTrades();
  const idx = trades.findIndex(t => t.id === id);
  if (idx === -1) return null;
  trades[idx] = { ...trades[idx], ...data };
  writeTrades(trades);
  return trades[idx];
}

export function deleteTrade(id: number): boolean {
  const trades = readTrades();
  const next = trades.filter(t => t.id !== id);
  if (next.length === trades.length) return false;
  writeTrades(next);
  return true;
}

// US trades
export function getAllUsTrades(): Trade[] {
  return sortTrades(readUsTrades());
}

export function getUsTradeById(id: number): Trade | undefined {
  return readUsTrades().find(t => t.id === id);
}

export function createUsTrade(data: Omit<Trade, 'id' | 'created_at'>): Trade {
  const trades = readUsTrades();
  const maxId = trades.reduce((m, t) => Math.max(m, t.id ?? 0), 0);
  const trade: Trade = { ...data, id: maxId + 1, created_at: new Date().toISOString() };
  trades.push(trade);
  writeUsTrades(trades);
  return trade;
}

export function updateUsTrade(id: number, data: Partial<Trade>): Trade | null {
  const trades = readUsTrades();
  const idx = trades.findIndex(t => t.id === id);
  if (idx === -1) return null;
  trades[idx] = { ...trades[idx], ...data };
  writeUsTrades(trades);
  return trades[idx];
}

export function deleteUsTrade(id: number): boolean {
  const trades = readUsTrades();
  const next = trades.filter(t => t.id !== id);
  if (next.length === trades.length) return false;
  writeUsTrades(next);
  return true;
}

export function getSettings(): { portfolio_size: number; us_portfolio_size: number; usd_to_inr: number } {
  const raw = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
  return {
    portfolio_size: raw.portfolio_size ?? 300000,
    us_portfolio_size: raw.us_portfolio_size ?? 50000,
    usd_to_inr: raw.usd_to_inr ?? 84,
  };
}

export function saveSettings(s: { portfolio_size: number; us_portfolio_size: number; usd_to_inr: number }): void {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2));
}


import { Trade } from '../types';

interface Props {
  trades: Trade[];
  currency: 'INR' | 'USD';
  exchangeRate?: number;
}

function fmt(n: number, decimals = 0, locale = 'en-IN'): string {
  return n.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function SummaryCards({ trades, currency, exchangeRate }: Props) {
  const sym = currency === 'INR' ? '₹' : '$';
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  const rate = exchangeRate ?? 1;

  const closed = trades.filter(t => t.status === 'Closed');
  const open   = trades.filter(t => t.status === 'Open');

  const totalPL       = closed.reduce((s, t) => s + (t.pl ?? 0), 0) * rate;
  const totalInvested = closed.reduce((s, t) => s + (t.invested ?? 0), 0) * rate;
  const totalPLPct    = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

  const winners = closed.filter(t => (t.pl ?? 0) > 0);
  const losers  = closed.filter(t => (t.pl ?? 0) < 0);
  const winRate = closed.length > 0 ? (winners.length / closed.length) * 100 : 0;

  const avgWin  = winners.length > 0 ? (winners.reduce((s, t) => s + (t.pl ?? 0), 0) / winners.length) * rate : 0;
  const avgLoss = losers.length  > 0 ? (losers.reduce((s, t)  => s + (t.pl ?? 0), 0) / losers.length)  * rate : 0;

  const openInvested = open.reduce((s, t) => s + (t.invested ?? 0), 0) * rate;

  const cards = [
    { label: 'Total Trades', value: fmt(trades.length, 0, locale), color: 'neutral' },
    { label: 'Open Positions', value: fmt(open.length, 0, locale), color: 'neutral' },
    { label: 'Capital in Open', value: `${sym}${fmt(openInvested, 0, locale)}`, color: 'neutral' },
    { label: 'Realised P/L', value: `${totalPL >= 0 ? '+' : ''}${sym}${fmt(Math.abs(totalPL), 0, locale)}`, color: totalPL > 0 ? 'green' : totalPL < 0 ? 'red' : 'neutral' },
    { label: 'P/L %', value: `${totalPLPct >= 0 ? '+' : ''}${totalPLPct.toFixed(2)}%`, color: totalPLPct > 0 ? 'green' : totalPLPct < 0 ? 'red' : 'neutral' },
    { label: 'Win Rate', value: closed.length ? `${winRate.toFixed(1)}%` : '—', color: winRate >= 50 ? 'green' : 'red' },
    { label: `Avg Win (${sym})`, value: winners.length ? `+${sym}${fmt(avgWin, 0, locale)}` : '—', color: 'green' },
    { label: `Avg Loss (${sym})`, value: losers.length  ? `${sym}${fmt(avgLoss, 0, locale)}` : '—', color: 'red' },
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

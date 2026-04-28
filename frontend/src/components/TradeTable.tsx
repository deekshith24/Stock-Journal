import { Trade } from '../types';

interface Props {
  trades: Trade[];
  currency: 'INR' | 'USD';
  exchange: 'US' | 'IN';
  exchangeRate?: number;
  dateRates?: Record<string, number>;
  onEdit: (trade: Trade) => void;
  onDelete: (trade: Trade) => void;
  onClose: (trade: Trade) => void;
}

function fmt(n: number | undefined, decimals = 2, locale = 'en-IN'): string {
  if (n == null) return '—';
  return n.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y.slice(2)}`;
}

function rowClass(trade: Trade): string {
  if (trade.status === 'Open' || trade.status === 'Partial') return 'row-open';
  if ((trade.pl ?? 0) > 0) return 'row-profit';
  if ((trade.pl ?? 0) < 0) return 'row-loss';
  return '';
}

function plClass(pl: number | undefined): string {
  if (!pl) return 'pl-zero';
  return pl > 0 ? 'pl-positive' : 'pl-negative';
}

export default function TradeTable({ trades, currency, exchange, exchangeRate, dateRates, onEdit, onDelete, onClose }: Props) {
  const sym = currency === 'INR' ? '₹' : '$';
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  const rate = exchangeRate ?? 1;

  if (trades.length === 0) {
    return (
      <div className="table-wrapper">
        <div className="empty-state">
          <div className="icon">📊</div>
          <p>No trades found. Add your first trade to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Stock</th>
              <th>Entry Date</th>
              <th>Exit Date</th>
              <th>Status</th>
              <th>Days</th>
              <th>Entry Qty</th>
              <th>Exit Qty</th>
              <th>Entry Price</th>
              <th>Exit Price</th>
              <th>Invested ({sym})</th>
              <th>PF %</th>
              <th>Reason for Entry</th>
              <th>Reason for Exit</th>
              <th>P/L ({sym})</th>
              <th>P/L %</th>
              <th>Emotions</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t, idx) => {
              // Only apply exchange rate for US trades when displaying in INR
              const rateForTrade = currency === 'INR' && exchange === 'US' ? (dateRates?.[t.entry_date] ?? exchangeRate ?? 1) : 1;
              const entryPrice = t.entry_price * rateForTrade;
              const exitPrice  = t.exit_price != null ? t.exit_price * rateForTrade : null;
              const invested   = t.invested != null ? t.invested * rateForTrade : undefined;
              const pl         = t.pl != null ? t.pl * rateForTrade : undefined;

              return (
                <tr key={t.id} className={rowClass(t)}>
                  <td className="text-muted" style={{ color: '#9aa3af', fontSize: 11 }}>{idx + 1}</td>
                  <td><span className="stock-name">{t.stock}</span></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(t.entry_date)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{t.exit_date ? fmtDate(t.exit_date) : <em style={{ color: '#9aa3af' }}>Open</em>}</td>
                  <td>
                    <span className={`badge badge-${t.status?.toLowerCase()}`}>{t.status}</span>
                  </td>
                  <td className="text-center">{t.days_in_trade}</td>
                  <td className="text-right">{fmt(t.entry_quantity, 0, locale)}</td>
                  <td className="text-right">{t.exit_quantity != null ? fmt(t.exit_quantity, 0, locale) : '—'}</td>
                  <td className="text-right">{fmt(entryPrice, 2, locale)}</td>
                  <td className="text-right">{exitPrice != null ? fmt(exitPrice, 2, locale) : '—'}</td>
                  <td className="text-right">{fmt(invested, 0, locale)}</td>
                  <td className="text-right">{t.pf_percentage != null ? `${fmt(t.pf_percentage, 2, locale)}%` : '—'}</td>
                  <td>
                    {t.reason_for_entry ? (
                      <div className="text-truncate" data-tooltip={t.reason_for_entry} title={t.reason_for_entry}>
                        {t.reason_for_entry}
                      </div>
                    ) : <span style={{ color: '#c1c8d0' }}>—</span>}
                  </td>
                  <td>
                    {t.reason_for_exit ? (
                      <div className="text-truncate" data-tooltip={t.reason_for_exit} title={t.reason_for_exit}>
                        {t.reason_for_exit}
                      </div>
                    ) : <span style={{ color: '#c1c8d0' }}>—</span>}
                  </td>
                  <td className={`text-right ${plClass(pl)}`}>
                    {pl != null && pl !== 0 ? (pl > 0 ? '+' : '') + fmt(pl, 0, locale) : '—'}
                  </td>
                  <td className={`text-right ${plClass(t.pl_percentage)}`}>
                    {t.pl_percentage != null && t.pl_percentage !== 0
                      ? `${t.pl_percentage > 0 ? '+' : ''}${fmt(t.pl_percentage, 2, locale)}%`
                      : '—'}
                  </td>
                  <td>
                    {t.emotions ? (
                      <div className="text-truncate" style={{ maxWidth: 150 }} title={t.emotions}>
                        {t.emotions}
                      </div>
                    ) : <span style={{ color: '#c1c8d0' }}>—</span>}
                  </td>
                  <td>
                    <div className="actions-cell">
                      {(t.status === 'Open' || t.status === 'Partial') && (
                        <button className="btn-icon btn-close" onClick={() => onClose(t)} title="Close position">✓</button>
                      )}
                      <button className="btn-icon" onClick={() => onEdit(t)} title="Edit">✏️</button>
                      <button className="btn-icon" onClick={() => onDelete(t)} title="Delete" style={{ color: '#dc2626' }}>🗑️</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Trade } from '../types';

interface TradeEntryData {
  stock: string;
  entry_date: string;
  entry_quantity: number;
  entry_price: number;
  reason_for_entry: string;
}

interface Props {
  trade: Trade | null;
  currency: 'INR' | 'USD';
  onSave: (data: TradeEntryData) => Promise<void>;
  onClose: () => void;
}

const EMPTY: TradeEntryData = {
  stock: '',
  entry_date: '',
  entry_quantity: 0,
  entry_price: 0,
  reason_for_entry: '',
};

export default function TradeForm({ trade, currency, onSave, onClose }: Props) {
  const [form, setForm] = useState<TradeEntryData>(EMPTY);
  const [saving, setSaving] = useState(false);

  const sym = currency === 'INR' ? '₹' : '$';
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  const stockPlaceholder = currency === 'INR' ? 'e.g. RELIANCE' : 'e.g. AAPL';

  useEffect(() => {
    if (trade) {
      setForm({
        stock: trade.stock,
        entry_date: trade.entry_date,
        entry_quantity: trade.entry_quantity,
        entry_price: trade.entry_price,
        reason_for_entry: trade.reason_for_entry,
      });
    } else {
      setForm(EMPTY);
    }
  }, [trade]);

  const set = (field: keyof TradeEntryData, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        ...form,
        stock: form.stock.toUpperCase().trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  const invested = (form.entry_price || 0) * (form.entry_quantity || 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{trade ? `Edit — ${trade.stock}` : 'Add New Trade'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-section">
              <div className="form-section-title">Entry Details</div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Stock *</label>
                  <input
                    required
                    value={form.stock}
                    onChange={e => set('stock', e.target.value.toUpperCase())}
                    placeholder={stockPlaceholder}
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>
                <div className="form-group">
                  <label>Entry Date *</label>
                  <input
                    type="date"
                    required
                    value={form.entry_date}
                    onChange={e => set('entry_date', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Entry Quantity *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={form.entry_quantity || ''}
                    onChange={e => set('entry_quantity', parseInt(e.target.value) || 0)}
                    placeholder="No. of shares"
                  />
                </div>
                <div className="form-group">
                  <label>Entry Price ({sym}) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={form.entry_price || ''}
                    onChange={e => set('entry_price', parseFloat(e.target.value) || 0)}
                    placeholder="Price per share"
                  />
                </div>
                <div className="form-group">
                  <label>Invested ({sym})</label>
                  <input
                    readOnly
                    value={invested > 0 ? invested.toLocaleString(locale, { maximumFractionDigits: 2 }) : ''}
                    style={{ background: '#f8f9fa', color: '#6c757d' }}
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-title">Notes</div>
              <div className="form-group">
                <label>Reason for Entry</label>
                <textarea
                  rows={3}
                  value={form.reason_for_entry}
                  onChange={e => set('reason_for_entry', e.target.value)}
                  placeholder="Why did you enter this trade? (setup, sector, indicator…)"
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : trade ? 'Save Changes' : 'Add Trade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

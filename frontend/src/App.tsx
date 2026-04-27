import React, { useState, useEffect, useCallback } from 'react';
import { Trade, Settings, ExitRecord } from './types';
import { api } from './api';
import { exportToExcel } from './utils/exportExcel';
import TradeTable from './components/TradeTable';
import TradeForm from './components/TradeForm';
import SummaryCards from './components/SummaryCards';
import SettingsModal from './components/SettingsModal';
import ClosePositionModal from './components/ClosePositionModal';
import AnalyticsPage from './components/AnalyticsPage';

type FilterType = 'all' | 'open' | 'closed';
type PageType = 'india' | 'us' | 'analytics';
type UsCurrency = 'USD' | 'INR';
type PeriodFilter = '1M' | '3M' | '6M' | '1Y' | 'ALL' | 'CUSTOM';

const PERIOD_OPTIONS: { label: string; value: PeriodFilter; days: number }[] = [
  { label: '1M',     value: '1M',     days: 30  },
  { label: '3M',     value: '3M',     days: 90  },
  { label: '6M',     value: '6M',     days: 180 },
  { label: '1Y',     value: '1Y',     days: 365 },
  { label: 'All',    value: 'ALL',    days: 0   },
  { label: 'Custom', value: 'CUSTOM', days: 0   },
];

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('india');
  const [usCurrency, setUsCurrency] = useState<UsCurrency>('USD');

  const [indiaTrades, setIndiaTrades] = useState<Trade[]>([]);
  const [usTrades, setUsTrades] = useState<Trade[]>([]);
  const [settings, setSettings] = useState<Settings>({ portfolio_size: 300000, us_portfolio_size: 50000, usd_to_inr: 84 });

  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<PeriodFilter>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Trade | null>(null);
  const [closingTrade, setClosingTrade] = useState<Trade | null>(null);

  const isUS = currentPage === 'us';
  const isAnalytics = currentPage === 'analytics';
  const trades = isUS ? usTrades : indiaTrades;
  const setTrades = isUS ? setUsTrades : setIndiaTrades;

  // Currency display logic
  const displayCurrency = isUS ? usCurrency : 'INR';
  const exchangeRate = (isUS && usCurrency === 'INR' && settings.usd_to_inr > 0)
    ? settings.usd_to_inr
    : undefined;
  const sym = displayCurrency === 'INR' ? '₹' : '$';
  const locale = displayCurrency === 'INR' ? 'en-IN' : 'en-US';
  const portfolioSize = isUS
    ? (usCurrency === 'INR' ? settings.us_portfolio_size * (settings.usd_to_inr || 1) : settings.us_portfolio_size)
    : settings.portfolio_size;

  const loadData = useCallback(async () => {
    try {
      const [indiaData, usData, settingsData] = await Promise.all([
        api.getTrades(),
        api.getUsTrades(),
        api.getSettings(),
      ]);
      setIndiaTrades(indiaData);
      setUsTrades(usData);
      setSettings(settingsData);
      setError(null);
    } catch (e) {
      setError('Failed to connect to server. Make sure the backend is running on port 3002.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handlePageSwitch = (page: PageType) => {
    setCurrentPage(page);
    setFilter('all');
    setSearch('');
    setPeriod('ALL');
    setDateFrom('');
    setDateTo('');
  };

  const fromDate = (() => {
    if (period === 'ALL') return '';
    if (period === 'CUSTOM') return dateFrom;
    const days = PERIOD_OPTIONS.find(o => o.value === period)!.days;
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  })();
  const toDate = period === 'CUSTOM' ? dateTo : '';

  const dateFilteredTrades = trades.filter(t =>
    (!fromDate || t.entry_date >= fromDate) &&
    (!toDate   || t.entry_date <= toDate)
  );

  const filteredTrades = dateFilteredTrades.filter(t => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'open' && (t.status === 'Open' || t.status === 'Partial')) ||
      (filter === 'closed' && t.status === 'Closed');
    const matchesSearch = !search || t.stock.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleSave = async (data: { stock: string; entry_date: string; entry_quantity: number; entry_price: number; reason_for_entry: string }) => {
    try {
      if (editingTrade?.id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updated = isUS ? await api.updateUsTrade(editingTrade.id, data as any) : await api.updateTrade(editingTrade.id, data as any);
        setTrades(prev => prev.map(t => t.id === updated.id ? updated : t));
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const created = isUS ? await api.createUsTrade(data as any) : await api.createTrade(data as any);
        setTrades(prev => [created, ...prev]);
      }
      setShowForm(false);
      setEditingTrade(null);
    } catch (e: unknown) {
      alert((e as Error).message || 'Save failed');
    }
  };

  const handleEdit = (trade: Trade) => {
    setEditingTrade(trade);
    setShowForm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm?.id) return;
    try {
      if (isUS) {
        await api.deleteUsTrade(deleteConfirm.id);
      } else {
        await api.deleteTrade(deleteConfirm.id);
      }
      setTrades(prev => prev.filter(t => t.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch (e: unknown) {
      alert((e as Error).message || 'Delete failed');
    }
  };

  const handleSaveSettings = async (s: Settings) => {
    const updated = await api.updateSettings(s);
    setSettings(updated);
    setShowSettings(false);
    loadData();
  };

  const handleClosePosition = async (exit: ExitRecord) => {
    if (!closingTrade?.id) return;
    try {
      const updated = isUS
        ? await api.addUsExit(closingTrade.id, exit)
        : await api.addExit(closingTrade.id, exit);
      setTrades(prev => prev.map(t => t.id === updated.id ? updated : t));
      setClosingTrade(null);
    } catch (e: unknown) {
      alert((e as Error).message || 'Close failed');
    }
  };

  const handleExport = () => {
    exportToExcel(indiaTrades, usTrades, settings.usd_to_inr);
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#6c757d' }}>
      Loading…
    </div>
  );

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>
            {isAnalytics ? '📊 Stock Journal — Analytics' : isUS ? '🇺🇸 Stock Journal — US' : '🇮🇳 Stock Journal — India'}
          </h1>
          <div className="page-tabs">
            <button className={`page-tab ${currentPage === 'india' ? 'active' : ''}`} onClick={() => handlePageSwitch('india')}>
              India
            </button>
            <button className={`page-tab ${currentPage === 'us' ? 'active' : ''}`} onClick={() => handlePageSwitch('us')}>
              US
            </button>
            <button className={`page-tab ${currentPage === 'analytics' ? 'active' : ''}`} onClick={() => handlePageSwitch('analytics')}>
              Analytics
            </button>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={handleExport} title="Export all trades to Excel">
            ↓ Export
          </button>
          <button className="btn btn-ghost" onClick={() => setShowSettings(true)}>⚙ Settings</button>
          {!isAnalytics && (
            <button className="btn btn-primary" onClick={() => { setEditingTrade(null); setShowForm(true); }}>
              + Add Trade
            </button>
          )}
        </div>
      </header>

      <main className="main-content">
        {error && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
            ⚠ {error}
          </div>
        )}

        {isAnalytics ? (
          <AnalyticsPage
            indiaTrades={indiaTrades}
            usTrades={usTrades}
            settings={settings}
          />
        ) : (
          <>
            <SummaryCards trades={dateFilteredTrades} currency={displayCurrency} exchangeRate={exchangeRate} />

            <div className="toolbar">
              <div className="filter-tabs">
                {(['all', 'open', 'closed'] as FilterType[]).map(f => (
                  <button key={f} className={`tab-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                    {f === 'all'
                      ? `All (${dateFilteredTrades.length})`
                      : f === 'open'
                      ? `Open (${dateFilteredTrades.filter(t => t.status === 'Open' || t.status === 'Partial').length})`
                      : `Closed (${dateFilteredTrades.filter(t => t.status === 'Closed').length})`}
                  </button>
                ))}
              </div>
              <div className="filter-tabs">
                {PERIOD_OPTIONS.map(o => (
                  <button key={o.value} className={`tab-btn ${period === o.value ? 'active' : ''}`} onClick={() => setPeriod(o.value)}>
                    {o.label}
                  </button>
                ))}
              </div>
              {period === 'CUSTOM' && (
                <div className="date-range-inputs">
                  <input
                    type="date"
                    className="date-input"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                  />
                  <span style={{ color: '#9aa3af', fontSize: 12 }}>–</span>
                  <input
                    type="date"
                    className="date-input"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                  />
                </div>
              )}
              <input
                className="search-box"
                placeholder="Search stock…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />

              {isUS && (
                <div className="currency-toggle">
                  <button
                    className={`toggle-btn ${usCurrency === 'USD' ? 'active' : ''}`}
                    onClick={() => setUsCurrency('USD')}
                  >
                    $ USD
                  </button>
                  <button
                    className={`toggle-btn ${usCurrency === 'INR' ? 'active' : ''}`}
                    onClick={() => setUsCurrency('INR')}
                    disabled={!settings.usd_to_inr}
                    title={!settings.usd_to_inr ? 'Set USD→INR rate in Settings first' : undefined}
                  >
                    ₹ INR
                  </button>
                </div>
              )}

              <div className="spacer" />
              <span style={{ fontSize: 11, color: '#6c757d' }}>
                Portfolio: {sym}{portfolioSize.toLocaleString(locale)}
              </span>
            </div>

            <TradeTable
              trades={filteredTrades}
              currency={displayCurrency}
              exchangeRate={exchangeRate}
              onEdit={handleEdit}
              onClose={t => setClosingTrade(t)}
              onDelete={t => setDeleteConfirm(t)}
            />
          </>
        )}
      </main>

      {showForm && (
        <TradeForm
          trade={editingTrade}
          currency={isUS ? 'USD' : 'INR'}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingTrade(null); }}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Delete</h2>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>×</button>
            </div>
            <div className="confirm-body">
              Delete trade for <strong>{deleteConfirm.stock}</strong>?<br />
              This action cannot be undone.
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDeleteConfirm}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {closingTrade && (
        <ClosePositionModal
          trade={closingTrade}
          currency={isUS ? 'USD' : 'INR'}
          onSave={handleClosePosition}
          onClose={() => setClosingTrade(null)}
        />
      )}
    </div>
  );
}

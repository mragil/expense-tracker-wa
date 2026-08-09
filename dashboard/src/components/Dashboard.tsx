import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  updateTransaction,
  deleteTransaction,
  updateLanguage,
  type MeResponse,
  type SummaryResponse,
  type TransactionsResponse,
  type CategoriesResponse,
  type BudgetResponse,
  type Transaction,
  type Category,
} from '../lib/api';
import { useI18n, type Language } from '../lib/i18n';
import Icon, { type IconName } from './Icon';

interface DashboardProps {
  session: MeResponse;
  onLogout: () => void;
  onLanguageChange: (lang: Language) => void;
}

const PERIODS = [
  { key: 'today', tKey: 'today' },
  { key: 'week', tKey: 'thisWeek' },
  { key: 'month', tKey: 'thisMonth' },
  { key: 'year', tKey: 'thisYear' },
  { key: 'all', tKey: 'all' },
] as const;

function fmt(n: number, lang: Language): string {
  return n.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US');
}

function currencySymbol(lang: Language): string {
  return lang === 'id' ? 'Rp' : 'IDR';
}

function fmtMoney(n: number, lang: Language): string {
  return `${currencySymbol(lang)} ${fmt(n, lang)}`;
}

function fmtCurrency(n: number, lang: Language): string {
  const sym = currencySymbol(lang);
  const abs = Math.abs(n);
  let compact: string;
  if (abs >= 1_000_000_000) compact = `${(n / 1_000_000_000).toFixed(1)}B`;
  else if (abs >= 1_000_000) compact = `${(n / 1_000_000).toFixed(1)}M`;
  else if (abs >= 1_000) compact = `${(n / 1_000).toFixed(1)}K`;
  else compact = String(n);
  compact = compact.replace(/\.0(?=[KMB]$)/, '');
  return `${sym} ${compact}`;
}

function fmtDateTime(ts: number | null, lang: Language): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString(lang === 'id' ? 'id-ID' : 'en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Dashboard({ session, onLogout, onLanguageChange }: DashboardProps) {
  const { t, lang, setLang } = useI18n();
  const [period, setPeriod] = useState('month');
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budget, setBudget] = useState<BudgetResponse['budget']>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [confirming, setConfirming] = useState<Transaction | null>(null);

  const tz = session.timezone;

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    return Promise.all([
      api<SummaryResponse>(`/dashboard/summary?period=${period}&timezone=${encodeURIComponent(tz)}`),
      api<TransactionsResponse>(`/dashboard/transactions?period=${period}&limit=100&timezone=${encodeURIComponent(tz)}`),
      api<CategoriesResponse>(`/dashboard/categories?period=${period}&timezone=${encodeURIComponent(tz)}`),
      api<BudgetResponse>(`/dashboard/budget?timezone=${encodeURIComponent(tz)}`),
    ])
      .then(([s, tr, cat, bd]) => {
        setSummary(s);
        setTransactions(tr.transactions);
        setCategories(cat.categories);
        setBudget(bd.budget);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : t('errFailedToLoad'));
      })
      .finally(() => setLoading(false));
  }, [period, tz, t]);

  useEffect(() => {
    load();
  }, [load]);

  const expenses = useMemo(() => {
    const byCat = new Map<string, number>();
    for (const c of categories) {
      if (c.type === 'expense') byCat.set(c.category, c.total);
    }
    return Array.from(byCat.entries()).sort((a, b) => b[1] - a[1]);
  }, [categories]);

  const expenseTotal = expenses.reduce((acc, [, v]) => acc + v, 0);

  const handleSave = async (id: number, data: Parameters<typeof updateTransaction>[1]) => {
    setError('');
    const res = await updateTransaction(id, data);
    if (!res.ok) {
      setError(res.error === 'not_found' ? t('errNotFound') : t('errUpdateFailed'));
      return false;
    }
    setEditing(null);
    await load();
    return true;
  };

  const handleDelete = async (id: number) => {
    setError('');
    const res = await deleteTransaction(id);
    if (!res.ok) {
      setError(res.error === 'not_found' ? t('errNotFound') : t('errDeleteFailed'));
      setConfirming(null);
      return;
    }
    setConfirming(null);
    await load();
  };

  const handleToggleLanguage = async () => {
    const next: Language = lang === 'id' ? 'en' : 'id';
    setError('');
    try {
      await updateLanguage(next);
      setLang(next);
      onLanguageChange(next);
    } catch {
      setError(t('errFailedToSave'));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="nav">
        <div className="nav-inner">
          <div className="logo">
            <span className="logo-mark"><Icon name="balance" size={16} /></span>
            <span>Expense Tracker</span>
          </div>
          <div className="nav-actions">
            <button
              onClick={handleToggleLanguage}
              className="nav-btn lang-toggle"
              aria-label={t('languageLabel')}
            >
              {lang === 'id' ? 'EN' : 'ID'}
            </button>
            <button onClick={onLogout} className="nav-btn">
              {t('logout')}
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between gap-4 mb-6" style={{ flexWrap: 'wrap' }}>
          <h1 className="text-xl font-bold">{t('overview')}</h1>
          <div className="period-tabs">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={period === p.key ? 'active' : ''}
              >
                {t(p.tKey)}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="card" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c', marginBottom: 24 }}>
            {error}
          </div>
        )}

        {loading && !summary ? (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="skeleton skeleton-card" />
              <div className="skeleton skeleton-card" />
              <div className="skeleton skeleton-card" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card">
                <div className="skeleton skeleton-line" />
                <div className="skeleton skeleton-line short" />
                <div className="skeleton skeleton-line short" />
              </div>
              <div className="card">
                <div className="skeleton skeleton-line" />
                <div className="skeleton skeleton-line short" />
                <div className="skeleton skeleton-line short" />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <StatCard
                label={t('income')}
                value={`+${fmtCurrency(summary?.totalIncome ?? 0, lang)}`}
                color="#16a34a"
                icon="income"
                detail={`${fmtMoney(summary?.totalIncome ?? 0, lang)} · ${t('txnCount', { n: summary?.count ?? 0 })}`}
              />
              <StatCard
                label={t('expense')}
                value={`−${fmtCurrency(summary?.totalExpense ?? 0, lang)}`}
                color="#dc2626"
                icon="expense"
                detail={`${fmtMoney(summary?.totalExpense ?? 0, lang)} · ${t('txnCount', { n: summary?.count ?? 0 })}`}
              />
              <StatCard
                label={t('balance')}
                value={fmtCurrency(summary?.balance ?? 0, lang)}
                color={(summary?.balance ?? 0) >= 0 ? '#111110' : '#dc2626'}
                icon="balance"
                detail={t('balanceDetail')}
              />
            </div>

            {budget && (
              <div className="card mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold">{t('monthlyBudget')}</h2>
                  <span className="text-sm text-gray-500">
                    {t('spentOf', { spent: fmtCurrency(budget.spent, lang), amount: fmtCurrency(budget.amount, lang) })}
                  </span>
                </div>
                <div className="budget-bar">
                  <div
                    style={{
                      width: `${Math.min(budget.percentUsed, 100)}%`,
                      backgroundColor:
                        budget.percentUsed >= 100
                          ? '#dc2626'
                          : budget.percentUsed >= 80
                            ? '#b45309'
                            : '#111110',
                    }}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  {t('percentUsed', { pct: budget.percentUsed.toFixed(1) })} ·{' '}
                  <span style={{ fontWeight: 500, color: budget.remaining >= 0 ? '#16a34a' : '#dc2626' }}>
                    {budget.remaining >= 0
                      ? t('remaining', { amount: fmtCurrency(budget.remaining, lang) })
                      : t('overBudget', { amount: fmtCurrency(-budget.remaining, lang) })}
                  </span>
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card">
                <h2 className="font-semibold mb-4">{t('spendingByCategory')}</h2>
                {expenses.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon"><Icon name="chart" size={20} /></span>
                    <p className="empty-title">{t('noExpenses')}</p>
                    <p className="empty-hint">{t('noExpensesHint')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {expenses.map(([cat, total]) => {
                      const pct = expenseTotal > 0 ? (total / expenseTotal) * 100 : 0;
                      return (
                        <div key={cat}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-700">{cat}</span>
                            <span className="text-gray-500 font-medium">
                              {fmtCurrency(total, lang)} · {pct.toFixed(0)}%
                            </span>
                          </div>
                          <div className="cat-bar">
                            <div style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold">{t('recentTransactions')}</h2>
                  <span className="text-xs text-gray-400">{t('clickToEdit')}</span>
                </div>
                {transactions.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon"><Icon name="inbox" size={20} /></span>
                    <p className="empty-title">{t('noTransactions')}</p>
                    <p className="empty-hint">{t('noTransactionsHint')}</p>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    {transactions.map((trx) => (
                      <div key={trx.id} className="txn-row">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="txn-avatar">
                            <Icon name={trx.transactionType === 'income' ? 'arrowUp' : 'arrowDown'} size={15} />
                          </span>
                          <div className="min-w-0" style={{ flex: 1 }}>
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {trx.category ?? (trx.transactionType === 'income' ? t('income') : t('expense'))}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {trx.description || fmtDateTime(trx.createdAt, lang)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className="txn-amount"
                            style={{ color: trx.transactionType === 'income' ? '#16a34a' : '#dc2626' }}
                          >
                            {trx.transactionType === 'income' ? '+' : '−'}{fmtMoney(trx.amount, lang)}
                          </span>
                          <button
                            onClick={() => setEditing(trx)}
                            title={t('edit')}
                            className="row-action"
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => setConfirming(trx)}
                            title={t('delete')}
                            className="row-action"
                            style={{ color: '#dc2626' }}
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {editing && (
        <EditModal
          transaction={editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}

      {confirming && (
        <div className="modal-overlay" onClick={() => setConfirming(null)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">{t('deleteTransaction')}</h3>
            <p className="text-sm text-gray-500 mb-4">
              {t('deleteConfirm', {
                category: confirming.category ?? (confirming.transactionType === 'income' ? t('income') : t('expense')),
                amount: fmtMoney(confirming.amount, lang),
              })}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirming(null)}
                className="btn-secondary"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => handleDelete(confirming.id)}
                className="btn-danger"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, detail, icon }: { label: string; value: string; color: string; detail: string; icon: IconName }) {
  return (
    <div className="card stat-card">
      <p className="stat-label"><Icon name={icon} size={15} />{label}</p>
      <p className="stat-value text-2xl" style={{ color }}>{value}</p>
      <p className="stat-detail">{detail}</p>
    </div>
  );
}

interface EditModalProps {
  transaction: Transaction;
  onSave: (id: number, data: { amount?: number; transactionType?: 'income' | 'expense'; category?: string; description?: string }) => Promise<boolean>;
  onClose: () => void;
}

function EditModal({ transaction, onSave, onClose }: EditModalProps) {
  const { t } = useI18n();
  const [amount, setAmount] = useState(String(transaction.amount));
  const [type, setType] = useState<'income' | 'expense'>(transaction.transactionType);
  const [category, setCategory] = useState(transaction.category ?? '');
  const [description, setDescription] = useState(transaction.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError(t('errInvalidAmount'));
      setSaving(false);
      return;
    }
    const ok = await onSave(transaction.id, {
      amount: parsed,
      transactionType: type,
      category,
      description,
    });
    setSaving(false);
    if (!ok) setError(t('errFailedToSave'));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-4">{t('editTransaction')}</h3>
        <form onSubmit={handleSubmit}>
          <label className="label">{t('amount')}</label>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input mb-3"
            required
          />

          <label className="label">{t('type')}</label>
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={type === 'expense' ? 'type-btn active expense' : 'type-btn'}
            >
              {t('expenseBtn')}
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={type === 'income' ? 'type-btn active income' : 'type-btn'}
            >
              {t('incomeBtn')}
            </button>
          </div>

          <label className="label">{t('category')}</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input mb-3"
            placeholder={t('categoryPlaceholder')}
          />

          <label className="label">{t('description')}</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input mb-3"
            placeholder={t('optionalNote')}
          />

          {error && <p className="error">{error}</p>}

          <div className="flex gap-3 justify-end mt-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              {t('cancel')}
            </button>
            <button type="submit" disabled={saving} className="btn-primary" style={{ width: 'auto' }}>
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import {
  api,
  type MeResponse,
  type SummaryResponse,
  type TransactionsResponse,
  type CategoriesResponse,
  type BudgetResponse,
  type Transaction,
  type Category,
} from '../lib/api';

interface DashboardProps {
  session: MeResponse;
  onLogout: () => void;
}

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
  { key: 'all', label: 'All' },
];

function fmt(n: number, lang: string): string {
  return n.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US');
}

function fmtCurrency(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtDateTime(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Dashboard({ session, onLogout }: DashboardProps) {
  const [period, setPeriod] = useState('month');
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budget, setBudget] = useState<BudgetResponse['budget']>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const tz = session.timezone;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      api<SummaryResponse>(`/dashboard/summary?period=${period}&timezone=${encodeURIComponent(tz)}`),
      api<TransactionsResponse>(`/dashboard/transactions?period=${period}&limit=100&timezone=${encodeURIComponent(tz)}`),
      api<CategoriesResponse>(`/dashboard/categories?period=${period}&timezone=${encodeURIComponent(tz)}`),
      api<BudgetResponse>(`/dashboard/budget?timezone=${encodeURIComponent(tz)}`),
    ])
      .then(([s, tr, cat, bd]) => {
        if (cancelled) return;
        setSummary(s);
        setTransactions(tr.transactions);
        setCategories(cat.categories);
        setBudget(bd.budget);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period, tz]);

  const expenses = useMemo(() => {
    const byCat = new Map<string, number>();
    for (const c of categories) {
      if (c.type === 'expense') byCat.set(c.category, c.total);
    }
    return Array.from(byCat.entries()).sort((a, b) => b[1] - a[1]);
  }, [categories]);

  const expenseTotal = expenses.reduce((acc, [, v]) => acc + v, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="nav">
        <div className="nav-inner">
          <div className="logo">
            <span>💰</span>
            <span>Expense Tracker</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500" style={{ display: 'none' }}>
              {session.displayName ?? session.whatsappNumber.split('@')[0]}
            </span>
            <button
              onClick={onLogout}
              className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5"
              style={{ cursor: 'pointer', background: 'none' }}
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between gap-4 mb-6" style={{ flexWrap: 'wrap' }}>
          <h1 className="text-xl font-bold">Overview</h1>
          <div className="period-tabs">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={period === p.key ? 'active' : ''}
              >
                {p.label}
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
          <p className="text-gray-500 text-center" style={{ padding: '48px 0' }}>Loading...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <StatCard
                label="Income"
                value={`+${fmtCurrency(summary?.totalIncome ?? 0)}`}
                color="#16a34a"
                detail={`${fmt(summary?.totalIncome ?? 0, session.language)} · ${summary?.count ?? 0} txn(s)`}
              />
              <StatCard
                label="Expense"
                value={`−${fmtCurrency(summary?.totalExpense ?? 0)}`}
                color="#dc2626"
                detail={`${fmt(summary?.totalExpense ?? 0, session.language)} · ${summary?.count ?? 0} txn(s)`}
              />
              <StatCard
                label="Balance"
                value={fmtCurrency(summary?.balance ?? 0)}
                color={(summary?.balance ?? 0) >= 0 ? '#111827' : '#dc2626'}
                detail="income − expense"
              />
            </div>

            {budget && (
              <div className="card mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold">Monthly Budget</h2>
                  <span className="text-sm text-gray-500">
                    Spent {fmtCurrency(budget.spent)} of {fmtCurrency(budget.amount)}
                  </span>
                </div>
                <div className="budget-bar">
                  <div
                    className={
                      budget.percentUsed >= 100
                        ? 'bg-red-500'
                        : budget.percentUsed >= 80
                          ? 'bg-yellow-500'
                          : 'bg-indigo-600'
                    }
                    style={{ width: `${Math.min(budget.percentUsed, 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  {budget.percentUsed.toFixed(1)}% used ·{' '}
                  <span style={{ fontWeight: 500, color: budget.remaining >= 0 ? '#16a34a' : '#dc2626' }}>
                    {budget.remaining >= 0 ? `${fmtCurrency(budget.remaining)} remaining` : `${fmtCurrency(-budget.remaining)} over budget`}
                  </span>
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card">
                <h2 className="font-semibold mb-4">Spending by Category</h2>
                {expenses.length === 0 ? (
                  <p className="text-sm text-gray-400">No expenses this period.</p>
                ) : (
                  <div className="space-y-3">
                    {expenses.map(([cat, total]) => {
                      const pct = expenseTotal > 0 ? (total / expenseTotal) * 100 : 0;
                      return (
                        <div key={cat}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-700">{cat}</span>
                            <span className="text-gray-500 font-medium">
                              {fmtCurrency(total)} · {pct.toFixed(0)}%
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
                <h2 className="font-semibold mb-4">Recent Transactions</h2>
                {transactions.length === 0 ? (
                  <p className="text-sm text-gray-400">No transactions this period.</p>
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    {transactions.map((trx) => (
                      <div key={trx.id} className="txn-row">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="txn-avatar">
                            {trx.transactionType === 'income' ? '💰' : '💸'}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {trx.category ?? (trx.transactionType === 'income' ? 'Income' : 'Expense')}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {trx.description || fmtDateTime(trx.createdAt)}
                            </p>
                          </div>
                        </div>
                        <span
                          className="text-sm font-semibold shrink-0"
                          style={{ color: trx.transactionType === 'income' ? '#16a34a' : '#dc2626' }}
                        >
                          {trx.transactionType === 'income' ? '+' : '−'}{fmt(trx.amount, session.language)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, color, detail }: { label: string; value: string; color: string; detail: string }) {
  return (
    <div className="card">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{detail}</p>
    </div>
  );
}

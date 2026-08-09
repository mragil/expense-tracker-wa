import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  UnauthorizedError,
  type MeResponse,
  type SummaryResponse,
  type TransactionsResponse,
  type CategoriesResponse,
  type BudgetResponse,
  type Transaction,
  type Category,
} from '../lib/api';
import { useI18n } from '../lib/i18n';
import { fmtCurrency, fmtMoney, fmtDateTime } from '../lib/format';
import { PERIODS } from '../lib/periods';
import Icon, { type IconName } from './Icon';

interface DashboardProps {
  session: MeResponse;
  onNavigate: (to: string) => void;
}

export default function Dashboard({ session, onNavigate }: DashboardProps) {
  const { t, lang } = useI18n();
  const [period, setPeriod] = useState('month');
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budget, setBudget] = useState<BudgetResponse['budget']>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
        if (err instanceof UnauthorizedError) {
          window.location.reload();
          return;
        }
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
  const recent = transactions.slice(0, 8);

  return (
    <div>
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
                {transactions.length > 0 && (
                  <button onClick={() => onNavigate('/transactions')} className="view-all">
                    {t('viewAll')} →
                  </button>
                )}
              </div>
              {recent.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon"><Icon name="inbox" size={20} /></span>
                  <p className="empty-title">{t('noTransactions')}</p>
                  <p className="empty-hint">{t('noTransactionsHint')}</p>
                </div>
              ) : (
                <div>
                  {recent.map((trx) => (
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
                      <span
                        className="txn-amount shrink-0"
                        style={{ color: trx.transactionType === 'income' ? '#16a34a' : '#dc2626' }}
                      >
                        {trx.transactionType === 'income' ? '+' : '−'}{fmtMoney(trx.amount, lang)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
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

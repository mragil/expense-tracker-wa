import { useCallback, useEffect, useState } from 'react';
import {
  api,
  updateTransaction,
  deleteTransaction,
  UnauthorizedError,
  type MeResponse,
  type TransactionsResponse,
  type Transaction,
} from '../lib/api';
import { useI18n } from '../lib/i18n';
import { fmtMoney, fmtDateTime } from '../lib/format';
import { PERIODS } from '../lib/periods';
import Icon from './Icon';
import EditModal from './EditModal';

export default function Transactions({ session }: { session: MeResponse }) {
  const { t, lang } = useI18n();
  const [period, setPeriod] = useState('month');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [confirming, setConfirming] = useState<Transaction | null>(null);

  const tz = session.timezone;

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    return api<TransactionsResponse>(
      `/dashboard/transactions?period=${period}&limit=500&timezone=${encodeURIComponent(tz)}`,
    )
      .then((res) => setTransactions(res.transactions))
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

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6" style={{ flexWrap: 'wrap' }}>
        <h1 className="text-xl font-bold">{t('manageTransactions')}</h1>
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

      {loading && transactions.length === 0 ? (
        <div className="card">
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <span className="empty-icon"><Icon name="inbox" size={20} /></span>
            <p className="empty-title">{t('noTransactions')}</p>
            <p className="empty-hint">{t('noTransactionsHint')}</p>
          </div>
        </div>
      ) : (
        <div className="card">
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
                    {[trx.description, fmtDateTime(trx.createdAt, lang)].filter(Boolean).join(' · ')}
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

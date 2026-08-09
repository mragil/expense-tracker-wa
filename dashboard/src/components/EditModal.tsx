import { useState } from 'react';
import type { Transaction, TransactionInput } from '../lib/api';
import { useI18n } from '../lib/i18n';

interface EditModalProps {
  transaction: Transaction;
  onSave: (id: number, data: TransactionInput) => Promise<boolean>;
  onClose: () => void;
}

export default function EditModal({ transaction, onSave, onClose }: EditModalProps) {
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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransactionService } from '@/services/transaction.service';
import { I18nService } from '@/services/i18n.service';
import type { TransactionData } from '@/types';

describe('TransactionService', () => {
  let service: TransactionService;
  let mockDb: any;
  let mockI18n: I18nService;
  let mockEvolution: any;

  beforeEach(() => {
    mockDb = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue({}),
    };
    mockI18n = new I18nService();
    mockEvolution = {
      sendTextMessage: vi.fn().mockResolvedValue({}),
    };
    service = new TransactionService(mockDb, mockI18n, mockEvolution);
  });

  it('should insert a transaction and send a confirmation message', async () => {
    const data: TransactionData = {
      type: 'transaction',
      amount: 10000,
      transactionType: 'expense' as const,
      category: 'Food',
      description: 'Lunch',
    };

    await service.handleTransaction('user123', data, 'user123', 'en');

    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
      whatsappId: 'user123',
      amount: 10000,
      transactionType: 'expense',
      category: 'Food',
      description: 'Lunch',
    }));
    expect(mockEvolution.sendTextMessage).toHaveBeenCalledWith(
      'user123',
      expect.stringContaining('10,000')
    );
  });

  it('should use default language (id) if not provided', async () => {
    const data: TransactionData = {
      type: 'transaction',
      amount: 5000,
      transactionType: 'income' as const,
      category: 'Salary',
      description: 'Salary',
    };

    await service.handleTransaction('user123', data);

    expect(mockEvolution.sendTextMessage).toHaveBeenCalledWith(
      'user123',
      expect.stringContaining('5.000') // ID format uses dots
    );
  });
});

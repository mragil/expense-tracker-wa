import { describe, it, expect, beforeEach, mock } from 'bun:test';
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
      insert: mock(() => mockDb),
      values: mock(() => Promise.resolve({})),
    };
    mockI18n = new I18nService();
    mockEvolution = {
      sendTextMessage: mock(() => Promise.resolve({})),
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

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { ReportService } from '@/services/report.service';
import { I18nService } from '@/services/i18n.service';


describe('ReportService', () => {
  let service: ReportService;
  let mockDb: any;
  let mockI18n: I18nService;
  let mockEvolution: any;

  beforeEach(() => {
    mockDb = {
      select: mock(() => mockDb),
      from: mock(() => mockDb),
      where: mock(() => Promise.resolve([])),
    };
    mockI18n = new I18nService();
    mockEvolution = {
      sendTextMessage: mock(() => Promise.resolve({})),
    };
    service = new ReportService(mockDb, mockI18n, mockEvolution);
  });

  it('should handle "no data" case', async () => {
    mockDb.where = mock(() => Promise.resolve([]));

    await service.generateSummary('user123', { period: 'today' }, 'en');

    expect(mockEvolution.sendTextMessage).toHaveBeenCalledWith(
      'user123',
      expect.stringContaining('No transactions for this period')
    );
  });

  it('should generate summary with totals', async () => {
    mockDb.where = mock(() => Promise.resolve([
      { amount: 10000, transactionType: 'income', category: 'Gift', createdAt: new Date() },
      { amount: 3000, transactionType: 'expense', category: 'Coffee', createdAt: new Date() },
    ]));

    await service.generateSummary('user123', { period: 'today' }, 'en');

    expect(mockEvolution.sendTextMessage).toHaveBeenCalledWith(
      'user123',
      expect.stringContaining('10,000')
    );
    expect(mockEvolution.sendTextMessage).toHaveBeenCalledWith(
      'user123',
      expect.stringContaining('3,000')
    );
    expect(mockEvolution.sendTextMessage).toHaveBeenCalledWith(
      'user123',
      expect.stringContaining('7,000')
    );
  });

  it('should handle "last_month" period', async () => {
    mockDb.where = mock(() => Promise.resolve([
      { amount: 1000, transactionType: 'income', category: 'Test', createdAt: new Date() }
    ]));
    await service.generateSummary('user123', { period: 'last_month' }, 'en');

    expect(mockEvolution.sendTextMessage).toHaveBeenCalledWith(
      'user123',
      expect.stringContaining('Financial Report (Last Month)')
    );
  });
});

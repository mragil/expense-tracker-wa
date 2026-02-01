import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportService } from '@/services/report.service';
import { I18nService } from '@/services/i18n.service';


describe('ReportService', () => {
  let service: ReportService;
  let mockDb: any;
  let mockI18n: I18nService;
  let mockEvolution: any;

  beforeEach(() => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn(),
    };
    mockI18n = new I18nService();
    mockEvolution = {
      sendTextMessage: vi.fn().mockResolvedValue({}),
    };
    service = new ReportService(mockDb, mockI18n, mockEvolution);
  });

  it('should handle "no data" case', async () => {
    mockDb.where.mockResolvedValue([]);

    await service.generateSummary('user123', { period: 'today' }, 'en');

    expect(mockEvolution.sendTextMessage).toHaveBeenCalledWith(
      'user123',
      expect.stringContaining('No transactions for this period')
    );
  });

  it('should generate summary with totals', async () => {
    mockDb.where.mockResolvedValue([
      { amount: 10000, transactionType: 'income', category: 'Gift', createdAt: new Date() },
      { amount: 3000, transactionType: 'expense', category: 'Coffee', createdAt: new Date() },
    ]);

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
    mockDb.where.mockResolvedValue([
      { amount: 1000, transactionType: 'income', category: 'Test', createdAt: new Date() }
    ]);
    await service.generateSummary('user123', { period: 'last_month' }, 'en');

    expect(mockEvolution.sendTextMessage).toHaveBeenCalledWith(
      'user123',
      expect.stringContaining('Financial Report (Last Month)')
    );
  });
});

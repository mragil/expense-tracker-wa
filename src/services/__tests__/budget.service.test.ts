import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BudgetService } from '@/services/budget.service';
import { I18nService } from '@/services/i18n.service';


describe('BudgetService', () => {
  let service: BudgetService;
  let mockDb: any;
  let mockI18n: I18nService;
  let mockEvolution: any;

  beforeEach(() => {
    mockDb = {
      query: {
        budgets: {
          findFirst: vi.fn(),
        },
      },
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue({}),
    };
    mockI18n = new I18nService();
    mockEvolution = {
      sendTextMessage: vi.fn().mockResolvedValue({}),
    };
    service = new BudgetService(mockDb, mockI18n, mockEvolution);
  });

  it('should notify if no budget is found', async () => {
    mockDb.query.budgets.findFirst.mockResolvedValue(null);

    await service.checkBudget('user123', 'en');

    expect(mockEvolution.sendTextMessage).toHaveBeenCalledWith(
      'user123',
      expect.stringContaining('set a monthly budget')
    );
  });

  it('should calculate remaining budget correctly', async () => {
    mockDb.query.budgets.findFirst.mockResolvedValue({
      amount: 1000000,
      createdAt: new Date(),
    });
    mockDb.where.mockResolvedValue([
      { amount: 200000 },
      { amount: 300000 },
    ]);

    await service.checkBudget('user123', 'id');

    expect(mockEvolution.sendTextMessage).toHaveBeenCalledWith(
      'user123',
      expect.stringContaining('500.000')
    );
  });

  it('should update budget', async () => {
    await service.updateBudget('user123', 2000000, 'en');

    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockEvolution.sendTextMessage).toHaveBeenCalledWith(
      'user123',
      expect.stringContaining('2,000,000')
    );
  });
});

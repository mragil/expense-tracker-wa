import { describe, it, expect, beforeEach, mock } from 'bun:test';
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
          findFirst: mock(() => Promise.resolve(null)),
        },
      },
      select: mock(() => mockDb),
      from: mock(() => mockDb),
      where: mock(() => Promise.resolve([])),
      insert: mock(() => mockDb),
      values: mock(() => Promise.resolve({})),
    };
    mockI18n = new I18nService();
    mockEvolution = {
      sendTextMessage: mock(() => Promise.resolve({})),
    };
    service = new BudgetService(mockDb, mockI18n, mockEvolution);
  });

  it('should notify if no budget is found', async () => {
    mockDb.query.budgets.findFirst = mock(() => Promise.resolve(null));

    await service.checkBudget('user123', 'en');

    expect(mockEvolution.sendTextMessage).toHaveBeenCalledWith(
      'user123',
      expect.stringContaining('set a monthly budget')
    );
  });

  it('should calculate remaining budget correctly', async () => {
    mockDb.query.budgets.findFirst = mock(() => Promise.resolve({
      amount: 1000000,
      createdAt: new Date(),
    }));
    mockDb.where = mock(() => Promise.resolve([
      { amount: 200000 },
      { amount: 300000 },
    ]));

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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookService } from '@/services/webhook.service';
import { I18nService } from '@/services/i18n.service';


describe('WebhookService', () => {
  let service: WebhookService;
  let mockDb: any;
  let mockI18n: I18nService;
  let mockOnboarding: any;
  let mockTransaction: any;
  let mockBudget: any;
  let mockReport: any;
  let mockEvolution: any;
  let mockAi: any;

  beforeEach(() => {
    mockDb = {
      query: {
        users: { findFirst: vi.fn() },
      },
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockResolvedValue({}),
    };
    mockI18n = new I18nService();
    mockOnboarding = {
      startOnboarding: vi.fn().mockResolvedValue({}),
      handleOnboarding: vi.fn().mockResolvedValue({}),
    };
    mockTransaction = {
      handleTransaction: vi.fn().mockResolvedValue({}),
    };
    mockBudget = {
      checkBudget: vi.fn().mockResolvedValue({}),
      updateBudget: vi.fn().mockResolvedValue({}),
    };
    mockReport = {
      generateSummary: vi.fn().mockResolvedValue({}),
    };
    mockEvolution = {
      isWhitelisted: vi.fn().mockReturnValue(true),
      extractMessageText: vi.fn().mockReturnValue('hello'),
      sendTextMessage: vi.fn().mockResolvedValue({}),
    };
    mockAi = {
      extractIntent: vi.fn().mockResolvedValue({ type: 'transaction', detectedLanguage: 'en' }),
    };

    service = new WebhookService(
      mockDb,
      mockI18n,
      mockOnboarding,
      mockTransaction,
      mockBudget,
      mockReport,
      mockEvolution,
      mockAi
    );
  });

  it('should ignore self messages', async () => {
    const payload = {
      event: 'messages.upsert' as const,
      data: { key: { fromMe: true, remoteJid: '123' } }
    } as any;

    const result = await service.handleWebhook(payload);
    expect(result.status).toBe('ignored');
  });

  it('should start onboarding if user not found', async () => {
    const payload = {
      event: 'messages.upsert' as const,
      data: { key: { fromMe: false, remoteJid: 'user123' } }
    } as any;

    mockDb.query.users.findFirst.mockResolvedValue(null);

    const result = await service.handleWebhook(payload);

    expect(result.status).toBe('onboarding_started');
    expect(mockOnboarding.startOnboarding).toHaveBeenCalled();
  });

  it('should route to transaction service', async () => {
    const payload = {
      event: 'messages.upsert' as const,
      data: { key: { fromMe: false, remoteJid: 'user123' } }
    } as any;

    mockDb.query.users.findFirst.mockResolvedValue({ onboardingStep: 'completed' });
    mockAi.extractIntent.mockResolvedValue({ type: 'transaction', amount: 100, detectedLanguage: 'en' });

    const result = await service.handleWebhook(payload);

    expect(result.status).toBe('processed_transaction');
    expect(mockTransaction.handleTransaction).toHaveBeenCalled();
  });

  it('should route to report service', async () => {
    const payload = {
      event: 'messages.upsert' as const,
      data: { key: { fromMe: false, remoteJid: 'user123' } }
    } as any;

    mockDb.query.users.findFirst.mockResolvedValue({ onboardingStep: 'completed' });
    mockAi.extractIntent.mockResolvedValue({ type: 'report', period: 'month', detectedLanguage: 'en' });

    const result = await service.handleWebhook(payload);

    expect(result.status).toBe('processed_report');
    expect(mockReport.generateSummary).toHaveBeenCalledWith('user123', expect.objectContaining({ period: 'month' }), 'en');
  });
});

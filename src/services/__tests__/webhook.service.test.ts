import { describe, it, expect, beforeEach, mock } from 'bun:test';
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
        users: { findFirst: mock(() => Promise.resolve(null)) },
      },
      insert: mock(() => mockDb),
      values: mock(() => mockDb),
      onConflictDoUpdate: mock(() => Promise.resolve({})),
    };
    mockI18n = new I18nService();
    mockOnboarding = {
      startOnboarding: mock(() => Promise.resolve({})),
      handleOnboarding: mock(() => Promise.resolve({})),
    };
    mockTransaction = {
      handleTransaction: mock(() => Promise.resolve({})),
    };
    mockBudget = {
      checkBudget: mock(() => Promise.resolve({})),
      updateBudget: mock(() => Promise.resolve({})),
    };
    mockReport = {
      generateSummary: mock(() => Promise.resolve({})),
    };
    mockEvolution = {
      isWhitelisted: mock(() => true),
      extractMessageText: mock(() => 'hello'),
      sendTextMessage: mock(() => Promise.resolve({})),
    };
    mockAi = {
      extractIntent: mock(() => Promise.resolve({ type: 'transaction', detectedLanguage: 'en' })),
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

    mockDb.query.users.findFirst = mock(() => Promise.resolve(null));

    const result = await service.handleWebhook(payload);

    expect(result.status).toBe('onboarding_started');
    expect(mockOnboarding.startOnboarding).toHaveBeenCalled();
  });

  it('should route to transaction service', async () => {
    const payload = {
      event: 'messages.upsert' as const,
      data: { key: { fromMe: false, remoteJid: 'user123' } }
    } as any;

    mockDb.query.users.findFirst = mock(() => Promise.resolve({ onboardingStep: 'completed' }));
    mockAi.extractIntent = mock(() => Promise.resolve({ type: 'transaction', amount: 100, detectedLanguage: 'en' }));

    const result = await service.handleWebhook(payload);

    expect(result.status).toBe('processed_transaction');
    expect(mockTransaction.handleTransaction).toHaveBeenCalled();
  });

  it('should route to report service', async () => {
    const payload = {
      event: 'messages.upsert' as const,
      data: { key: { fromMe: false, remoteJid: 'user123' } }
    } as any;

    mockDb.query.users.findFirst = mock(() => Promise.resolve({ onboardingStep: 'completed' }));
    mockAi.extractIntent = mock(() => Promise.resolve({ type: 'report', period: 'month', detectedLanguage: 'en' }));

    const result = await service.handleWebhook(payload);

    expect(result.status).toBe('processed_report');
    expect(mockReport.generateSummary).toHaveBeenCalledWith('user123', expect.objectContaining({ period: 'month' }), 'en');
  });
});

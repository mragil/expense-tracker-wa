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
      update: mock(() => mockDb),
      set: mock(() => mockDb),
      where: mock(() => Promise.resolve({})),
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
      resolvePhoneJid: mock((jid: string) => Promise.resolve(jid)),
      extractMessageText: mock(() => 'hello'),
      sendTextMessage: mock(() => Promise.resolve({})),
      leaveGroup: mock(() => Promise.resolve({})),
    };
    mockAi = {
      extractIntent: mock(() => Promise.resolve({ type: 'transaction', detectedLanguage: 'en' })),
    };
    const mockEnv = {
      OPEN_FOR_PUBLIC: 'false',
      WAHA_WHITELISTED_NUMBERS: '',
    } as any;

    service = new WebhookService(
      mockDb,
      mockI18n,
      mockOnboarding,
      mockTransaction,
      mockBudget,
      mockReport,
      mockEvolution,
      mockAi,
      mockEnv
    );
  });

  it('should ignore self messages', async () => {
    const payload = {
      event: 'message' as const,
      payload: { fromMe: true, from: '123' }
    } as any;

    const result = await service.handleWebhook(payload);
    expect(result.status).toBe('ignored');
  });

  it('should start onboarding if user not found', async () => {
    const payload = {
      event: 'message' as const,
      payload: { fromMe: false, from: 'user123' }
    } as any;

    mockDb.query.users.findFirst = mock(() => Promise.resolve(null));

    const result = await service.handleWebhook(payload);

    expect(result.status).toBe('onboarding_started');
    expect(mockOnboarding.startOnboarding).toHaveBeenCalled();
  });

  it('should route to transaction service', async () => {
    const payload = {
      event: 'message' as const,
      payload: { fromMe: false, from: 'user123', body: 'hello' }
    } as any;

    mockDb.query.users.findFirst = mock(() => Promise.resolve({ onboardingStep: 'completed' }));
    mockAi.extractIntent = mock(() => Promise.resolve({ type: 'transaction', amount: 100, detectedLanguage: 'en' }));

    const result = await service.handleWebhook(payload);

    expect(result.status).toBe('processed_transaction');
    expect(mockTransaction.handleTransaction).toHaveBeenCalled();
  });

  it('should route to report service', async () => {
    const payload = {
      event: 'message' as const,
      payload: { fromMe: false, from: 'user123', body: 'hello' }
    } as any;

    mockDb.query.users.findFirst = mock(() => Promise.resolve({ onboardingStep: 'completed' }));
    mockAi.extractIntent = mock(() => Promise.resolve({ type: 'report', period: 'month', detectedLanguage: 'en' }));

    const result = await service.handleWebhook(payload);

    expect(result.status).toBe('processed_report');
    expect(mockReport.generateSummary).toHaveBeenCalledWith('user123', expect.objectContaining({ period: 'month' }), 'en', expect.any(String));
  });

  it('should reject group join when owner already manages 5 active groups', async () => {
    const envelope = {
      event: 'group.v2.join' as const,
      payload: {
        group: { id: '999999999@g.us', subject: 'Sixth Group', participants: [{ id: '6281275973221@c.us' }] },
      },
    } as any;

    mockDb.query.users.findFirst = mock(() => Promise.resolve({ whatsappNumber: '6281275973221@c.us', language: 'en' }));
    mockEvolution.isWhitelisted = mock(() => true);
    mockDb.select = mock(() => mockDb);
    mockDb.from = mock(() => mockDb);
    mockDb.where = mock(() => mockDb);
    mockDb.get = mock(() => Promise.resolve({ count: 5 }));

    const result = await service.handleWebhook(envelope);

    expect(result.status).toBe('group_limit_reached');
    expect(mockEvolution.leaveGroup).toHaveBeenCalledWith('999999999@g.us');
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('should register group join when owner is below the group limit', async () => {
    const envelope = {
      event: 'group.v2.join' as const,
      payload: {
        group: { id: '888888888@g.us', subject: 'New Group', participants: [{ id: '6281275973221@c.us' }] },
      },
    } as any;

    mockDb.query.users.findFirst = mock(() => Promise.resolve({ whatsappNumber: '6281275973221@c.us', language: 'en' }));
    mockEvolution.isWhitelisted = mock(() => true);
    mockDb.select = mock(() => mockDb);
    mockDb.from = mock(() => mockDb);
    mockDb.where = mock(() => mockDb);
    mockDb.get = mock(() => Promise.resolve({ count: 2 }));

    const result = await service.handleWebhook(envelope);

    expect(result.status).toBe('group_registered');
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('should honor the MAX_GROUPS_PER_OWNER env var', async () => {
    const envelope = {
      event: 'group.v2.join' as const,
      payload: {
        group: { id: '777777777@g.us', subject: 'Capped Group', participants: [{ id: '6281275973221@c.us' }] },
      },
    } as any;

    (service as any).env = {
      OPEN_FOR_PUBLIC: 'false',
      WAHA_WHITELISTED_NUMBERS: '',
      MAX_GROUPS_PER_OWNER: '1',
    };

    mockDb.query.users.findFirst = mock(() => Promise.resolve({ whatsappNumber: '6281275973221@c.us', language: 'en' }));
    mockEvolution.isWhitelisted = mock(() => true);
    mockDb.select = mock(() => mockDb);
    mockDb.from = mock(() => mockDb);
    mockDb.where = mock(() => mockDb);
    mockDb.get = mock(() => Promise.resolve({ count: 1 }));

    const result = await service.handleWebhook(envelope);

    expect(result.status).toBe('group_limit_reached');
    expect(mockEvolution.leaveGroup).toHaveBeenCalledWith('777777777@g.us');
    expect(mockEvolution.sendTextMessage).toHaveBeenCalledWith('777777777@g.us', expect.stringContaining('1'));
  });
});

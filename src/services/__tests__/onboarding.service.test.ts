import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OnboardingService } from '@/services/onboarding.service';
import { I18nService } from '@/services/i18n.service';
import type { User } from '@/types';


describe('OnboardingService', () => {
  let service: OnboardingService;
  let mockDb: any;
  let mockI18n: I18nService;
  let mockEvolution: any;
  let mockAi: any;

  beforeEach(() => {
    mockDb = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue({}),
    };
    mockI18n = new I18nService();
    mockEvolution = {
      sendTextMessage: vi.fn().mockResolvedValue({}),
    };
    mockAi = {
      extractName: vi.fn().mockResolvedValue('Ally'),
      extractBudget: vi.fn().mockResolvedValue({ amount: 1000000 }),
    };
    service = new OnboardingService(mockDb, mockI18n, mockEvolution, mockAi);
  });

  it('should start onboarding', async () => {
    await service.startOnboarding('user123', 'en');

    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockEvolution.sendTextMessage).toHaveBeenCalledTimes(2);
  });

  it('should handle name step', async () => {
    const user: User = { 
      whatsappNumber: 'user123', 
      onboardingStep: 'name', 
      displayName: null, 
      isActive: false, 
      createdAt: new Date() 
    };
    await service.handleOnboarding('user123', 'My name is Ally', user, 'en');

    expect(mockAi.extractName).toHaveBeenCalled();
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockEvolution.sendTextMessage).toHaveBeenCalledWith(
      'user123',
      expect.stringContaining('Ally')
    );
  });

  it('should handle budget step', async () => {
    const user: User = { 
      whatsappNumber: 'user123', 
      displayName: 'Ally', 
      onboardingStep: 'budget', 
      isActive: false, 
      createdAt: new Date() 
    };
    await service.handleOnboarding('user123', '1000000', user, 'en');

    expect(mockAi.extractBudget).toHaveBeenCalled();
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockEvolution.sendTextMessage).toHaveBeenCalledWith(
      'user123',
      expect.stringContaining('Registration complete')
    );
  });

  it('should handle skip budget', async () => {
    const user: User = { 
      whatsappNumber: 'user123', 
      displayName: 'Ally', 
      onboardingStep: 'budget', 
      isActive: false, 
      createdAt: new Date() 
    };
    await service.handleOnboarding('user123', 'skip', user, 'en');

    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.update).toHaveBeenCalledWith(expect.anything());
    expect(mockEvolution.sendTextMessage).toHaveBeenCalled();
  });
});

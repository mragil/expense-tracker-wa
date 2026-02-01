import { db } from '@/db/index';
import * as evolution from '@/lib/evolution';
import * as ai from '@/lib/ai';
import { i18nService } from '@/services/i18n.service';
import { onboardingService } from '@/services/onboarding.service';
import { transactionService } from '@/services/transaction.service';
import { budgetService } from '@/services/budget.service';
import { reportService } from '@/services/report.service';
import { webhookService } from '@/services/webhook.service';

/**
 * Service Container
 * Provides a single point of access for all orchestrated service instances.
 * This can be expanded to a full DI container if needed.
 */
export const container = {
  db,
  evolution,
  ai,
  i18n: i18nService,
  onboarding: onboardingService,
  transaction: transactionService,
  budget: budgetService,
  report: reportService,
  webhook: webhookService,
};

export type Container = typeof container;

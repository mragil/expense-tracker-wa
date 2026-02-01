import { db } from '@/db/index';
import * as evolution from '@/lib/evolution';
import * as ai from '@/lib/ai';
import { I18nService } from '@/services/i18n.service';
import { OnboardingService } from '@/services/onboarding.service';
import { TransactionService } from '@/services/transaction.service';
import { BudgetService } from '@/services/budget.service';
import { ReportService } from '@/services/report.service';
import { WebhookService } from '@/services/webhook.service';
import type { Services } from '@/types';

export function createContainer(): Services {
  const i18n = new I18nService();
  const onboarding = new OnboardingService(db, i18n, evolution, ai);
  const transaction = new TransactionService(db, i18n, evolution);
  const budget = new BudgetService(db, i18n, evolution);
  const report = new ReportService(db, i18n, evolution);
  const webhook = new WebhookService(
    db,
    i18n,
    onboarding,
    transaction,
    budget,
    report,
    evolution,
    ai
  );

  return {
    i18n,
    onboarding,
    transaction,
    budget,
    report,
    webhook,
  };
}

export type Container = Services;

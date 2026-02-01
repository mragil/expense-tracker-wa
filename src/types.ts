import { users } from '@/db/schema';

export type Language = 'id' | 'en';

export interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
      participant?: string;
    };
    message?: {
      conversation?: string;
      extendedTextMessage?: {
        text: string;
      };
    };
    pushName?: string;
    author?: string;
  };
}

export interface TransactionData {
  type: 'transaction';
  amount: number;
  transactionType: 'income' | 'expense';
  category: string;
  description: string;
}

export interface ReportData {
  type: 'report';
  period?: 'today' | 'week' | 'month' | 'year' | 'last_month' | 'all' | 'custom';
  startDate?: string; // ISO date string
  endDate?: string;   // ISO date string
}

export interface BudgetInquiryData {
  type: 'budget_inquiry';
}

export interface BudgetUpdateData {
  type: 'budget_update';
  amount: number;
  period: 'day' | 'month' | 'year';
}

export interface LanguageChangeData {
  type: 'language_change';
  language: Language;
}

export type UserIntent = 
  | TransactionData 
  | ReportData 
  | BudgetInquiryData 
  | BudgetUpdateData 
  | { error: string };

export type UserIntentWithLang = (UserIntent & { detectedLanguage: Language }) | { error: string, detectedLanguage: Language };

export type User = typeof users.$inferSelect;

export interface EvolutionGroupUpsertPayload {
  event: 'groups.upsert';
  instance: string;
  data: Array<{
    id: string;
    subject: string;
    author?: string;
    authorPn?: string;
    [key: string]: any;
  }>;
}

export interface EvolutionGroupUpdatePayload {
  event: 'group-participants.update';
  instance: string;
  sender: string;
  data: {
    id: string;
    action: 'add' | 'remove' | 'leave' | 'promote' | 'demote';
    author: string;
    participants: Array<{
      phoneNumber: string;
      [key: string]: any;
    }>;
  };
}

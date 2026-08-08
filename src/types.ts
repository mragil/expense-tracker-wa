import { users } from '@/db/schema';

export type Language = 'id' | 'en';

export interface WahaWebhookEnvelope {
  id: string;
  timestamp: number;
  event: string;
  session: string;
  me?: { id: string; pushName: string };
  payload: WahaMessagePayload | WahaGroupJoinPayload | WahaGroupLeavePayload | WahaGroupParticipantsPayload | WahaPollVotePayload | unknown;
  environment?: {
    tier: string;
    version: string;
  };
  engine: string;
}

export interface WahaMessagePayload {
  id: string;
  timestamp: number;
  from: string;
  fromMe: boolean;
  source?: string;
  to: string;
  body?: string;
  hasMedia?: boolean;
  participant?: string;
  pushName?: string;
  _data?: unknown;
}

export interface WahaGroupJoinPayload {
  group: {
    id: string;
    subject?: string;
    participants?: Array<{ id: string; role: string }>;
  };
  timestamp?: number;
  _data?: unknown;
}

export interface WahaGroupLeavePayload {
  group: {
    id: string;
  };
  timestamp?: number;
  _data?: unknown;
}

export interface WahaGroupParticipantsPayload {
  type: 'join' | 'leave' | 'promote' | 'demote';
  timestamp: number;
  group: {
    id: string;
  };
  participants: Array<{
    id: string;
    role: string;
  }>;
  _data?: unknown;
}

export interface WahaPollVotePayload {
  vote: {
    id: string;
    to: string;
    from: string;
    fromMe: boolean;
    selectedOptions: string[];
    timestamp?: number;
  };
  poll: {
    id: string;
    to: string;
    from: string;
    fromMe: boolean;
  };
  _data?: unknown;
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

export interface Env {
  DB: D1Database;
  AI: Ai;
  GOOGLE_GENERATIVE_AI_API_KEY?: string;
  WAHA_API_URL: string;
  WAHA_API_KEY: string;
  WAHA_INSTANCE: string;
  WAHA_WHITELISTED_NUMBERS?: string;
  OPEN_FOR_PUBLIC?: string;
}

export interface Services {
  onboarding: any;
  transaction: any;
  budget: any;
  report: any;
  webhook: any;
  i18n: any;
}

export interface AppEnv {
  Bindings: Env;
  Variables: {
    services: Services;
  };
}

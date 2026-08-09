export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

const LOGGED_IN_KEY = 'expense_logged_in';

export function markLoggedIn(): void {
  localStorage.setItem(LOGGED_IN_KEY, '1');
}

export function clearLoggedIn(): void {
  localStorage.removeItem(LOGGED_IN_KEY);
}

export function isMarkedLoggedIn(): boolean {
  return localStorage.getItem(LOGGED_IN_KEY) === '1';
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    throw new UnauthorizedError();
  }

  const data = (await res.json().catch(() => null)) as T | null;
  if (!res.ok) {
    throw new Error((data as { error?: string })?.error ?? 'Request failed');
  }
  return data as T;
}

export interface MeResponse {
  whatsappNumber: string;
  displayName: string | null;
  timezone: string;
  language: string;
}

export interface OtpResponse {
  ok: boolean;
  error?: string;
  expiresIn?: number;
}

export interface VerifyResponse {
  ok: boolean;
  user?: MeResponse;
  error?: string;
}

export interface SummaryResponse {
  period: string;
  count: number;
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export interface Transaction {
  id: number;
  amount: number;
  transactionType: 'income' | 'expense';
  category: string | null;
  description: string | null;
  createdAt: number | null;
}

export interface TransactionsResponse {
  transactions: Transaction[];
}

export interface Category {
  category: string;
  type: 'income' | 'expense';
  total: number;
  count: number;
}

export interface CategoriesResponse {
  categories: Category[];
}

export interface Budget {
  amount: number;
  period: string;
  spent: number;
  remaining: number;
  percentUsed: number;
}

export interface BudgetResponse {
  budget: Budget | null;
}

export interface MutateResponse {
  ok: boolean;
  error?: string;
}

export type TransactionInput = {
  amount?: number;
  transactionType?: 'income' | 'expense';
  category?: string;
  description?: string;
};

export function updateTransaction(id: number, data: TransactionInput): Promise<MutateResponse> {
  return api<MutateResponse>(`/dashboard/transactions/${id}`, {
    method: 'PATCH',
    body: data,
  });
}

export function deleteTransaction(id: number): Promise<MutateResponse> {
  return api<MutateResponse>(`/dashboard/transactions/${id}`, {
    method: 'DELETE',
  });
}

export function updateLanguage(language: 'en' | 'id'): Promise<MeResponse> {
  return api<MeResponse>('/auth/me', {
    method: 'PATCH',
    body: { language },
  });
}

export function logout(): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>('/auth/logout', {
    method: 'POST',
  });
}

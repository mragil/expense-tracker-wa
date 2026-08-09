const TOKEN_KEY = 'expense_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/';
    throw new Error('Unauthorized');
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
  token?: string;
  user?: { whatsappNumber: string; displayName: string | null };
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

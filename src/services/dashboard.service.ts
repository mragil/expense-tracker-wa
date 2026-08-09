import { otpCodes, webSessions, users, transactions, budgets, authAttempts } from '@/db/schema';
import { and, eq, gte, desc, lt, count } from 'drizzle-orm';
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfYear,
  DEFAULT_TIMEZONE,
  inferTimezoneFromPhone,
} from '@/lib/time';
import type { WahaClient } from '@/lib/waha';
import type { Db } from '@/db/index';

export const WEB_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_REQUEST_WINDOW_MS = 10 * 60 * 1000;
export const OTP_REQUEST_MAX_PER_PHONE = 3;
export const OTP_REQUEST_MAX_PER_IP = 10;
export const OTP_VERIFY_FAIL_MAX = 5;
export const OTP_VERIFY_WINDOW_MS = 10 * 60 * 1000;

export interface DashboardPeriod {
  from?: Date;
  to?: Date;
}

function parsePeriod(period: string, timezone: string): DashboardPeriod {
  switch (period) {
    case 'today':
      return { from: startOfDay(timezone) };
    case 'week':
      return { from: startOfWeek(timezone) };
    case 'year':
      return { from: startOfYear(timezone) };
    case 'month':
    case 'all':
    default:
      return period === 'month' ? { from: startOfMonth(timezone) } : {};
  }
}

export function normalizePhone(input: string): string {
  let digits = input.replace(/[^\d]/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  if (!digits.startsWith('62')) digits = `62${digits}`;
  return `${digits}@c.us`;
}

function randomCode(): string {
  const buf = new Uint8Array(3);
  crypto.getRandomValues(buf);
  const n = (buf[0]! << 16) | (buf[1]! << 8) | buf[2]!;
  return String(n % 1000000).padStart(6, '0');
}

function randomToken(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

export class DashboardService {
  constructor(
    private db: Db,
    private waha: WahaClient,
  ) {}

  private validUser(whatsappNumber: string) {
    return this.db.select().from(users).where(eq(users.whatsappNumber, whatsappNumber)).get();
  }

  private async countAttempts(whatsappNumber: string, action: string, windowMs: number): Promise<number> {
    const since = new Date(Date.now() - windowMs);
    const row = await this.db
      .select({ n: count() })
      .from(authAttempts)
      .where(
        and(
          eq(authAttempts.whatsappNumber, whatsappNumber),
          eq(authAttempts.action, action),
          gte(authAttempts.createdAt, since),
        ),
      )
      .get();
    return row?.n ?? 0;
  }

  private async recordAttempt(whatsappNumber: string, action: string, ip?: string) {
    await this.db.insert(authAttempts).values({
      whatsappNumber,
      action,
      ip: ip ?? null,
    });
  }

  private async cleanupAttempts() {
    await this.db
      .delete(authAttempts)
      .where(lt(authAttempts.createdAt, new Date(Date.now() - OTP_REQUEST_WINDOW_MS)));
  }

  async requestOtp(phoneInput: string, ip?: string) {
    const whatsappNumber = normalizePhone(phoneInput);
    const user = await this.validUser(whatsappNumber);
    if (!user) {
      return { ok: false, error: 'unknown_number' as const };
    }

    const [phoneCount, ipCount] = await Promise.all([
      this.countAttempts(whatsappNumber, 'request', OTP_REQUEST_WINDOW_MS),
      ip ? this.countAttempts(ip, 'request', OTP_REQUEST_WINDOW_MS) : Promise.resolve(0),
    ]);

    if (phoneCount >= OTP_REQUEST_MAX_PER_PHONE) {
      return { ok: false as const, error: 'rate_limited' as const };
    }
    if (ipCount >= OTP_REQUEST_MAX_PER_IP) {
      return { ok: false as const, error: 'rate_limited' as const };
    }

    await this.recordAttempt(whatsappNumber, 'request', ip);

    const code = randomCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await this.db
      .delete(otpCodes)
      .where(eq(otpCodes.whatsappNumber, whatsappNumber));
    await this.db.insert(otpCodes).values({
      whatsappNumber,
      code,
      expiresAt,
      isUsed: false,
    });

    const sent = await this.waha.sendTextMessage(
      whatsappNumber,
      `🔐 *Expense Dashboard Login*\n\nYour verification code is: *${code}*\n\nThis code expires in 10 minutes.`,
    );

    if (!sent) {
      return { ok: false, error: 'send_failed' as const };
    }

    return { ok: true as const, expiresIn: OTP_TTL_MS };
  }

  async verifyOtp(phoneInput: string, codeInput: string, ip?: string) {
    const whatsappNumber = normalizePhone(phoneInput);
    const code = codeInput.trim();

    const failCount = await this.countAttempts(whatsappNumber, 'verify_fail', OTP_VERIFY_WINDOW_MS);
    if (failCount >= OTP_VERIFY_FAIL_MAX) {
      return { ok: false as const, error: 'rate_limited' as const };
    }

    const record = await this.db
      .select()
      .from(otpCodes)
      .where(eq(otpCodes.whatsappNumber, whatsappNumber))
      .orderBy(desc(otpCodes.id))
      .limit(1)
      .get();

    if (!record) {
      await this.recordAttempt(whatsappNumber, 'verify_fail', ip);
      return { ok: false as const, error: 'no_code' as const };
    }
    if (record.isUsed) {
      await this.recordAttempt(whatsappNumber, 'verify_fail', ip);
      return { ok: false as const, error: 'used' as const };
    }
    if (record.expiresAt.getTime() < Date.now()) {
      await this.recordAttempt(whatsappNumber, 'verify_fail', ip);
      return { ok: false as const, error: 'expired' as const };
    }
    if (record.code !== code) {
      await this.recordAttempt(whatsappNumber, 'verify_fail', ip);
      return { ok: false as const, error: 'invalid' as const };
    }

    await this.cleanupAttempts();

    await this.db
      .update(otpCodes)
      .set({ isUsed: true })
      .where(eq(otpCodes.id, record.id));

    const token = randomToken();
    const expiresAt = new Date(Date.now() + WEB_SESSION_TTL_MS);
    await this.db.insert(webSessions).values({
      id: token,
      whatsappNumber,
      expiresAt,
    });

    const user = await this.validUser(whatsappNumber);

    return {
      ok: true as const,
      token,
      expiresAt,
      user: {
        whatsappNumber,
        displayName: user?.displayName ?? null,
        language: user?.language ?? 'id',
        timezone: user?.timezone ?? DEFAULT_TIMEZONE,
      },
    };
  }

  async getUserForToken(token: string) {
    if (!token) return null;
    const session = await this.db
      .select()
      .from(webSessions)
      .where(eq(webSessions.id, token))
      .get();
    if (!session) return null;
    if (session.expiresAt.getTime() < Date.now()) return null;
    return session;
  }

  async getMe(token: string) {
    const session = await this.getUserForToken(token);
    if (!session) return null;
    const user = await this.validUser(session.whatsappNumber);
    return {
      whatsappNumber: session.whatsappNumber,
      displayName: user?.displayName ?? null,
      language: user?.language ?? 'id',
      timezone: user?.timezone ?? inferTimezoneFromPhone(session.whatsappNumber),
    };
  }

  async logout(token: string) {
    if (!token) return;
    await this.db.delete(webSessions).where(eq(webSessions.id, token));
  }

  async cleanupExpired() {
    await this.db
      .delete(webSessions)
      .where(lt(webSessions.expiresAt, new Date()));
  }

  async getSummary(whatsappNumber: string, period: string, timezone: string) {
    const { from, to } = parsePeriod(period, timezone);
    const conditions = [eq(transactions.whatsappId, whatsappNumber)];
    if (from) conditions.push(gte(transactions.createdAt, from));
    if (to) conditions.push(lt(transactions.createdAt, to));

    const rows = await this.db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .all();

    let totalIncome = 0;
    let totalExpense = 0;
    for (const trx of rows) {
      if (trx.transactionType === 'income') totalIncome += trx.amount;
      else totalExpense += trx.amount;
    }

    return {
      period,
      count: rows.length,
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
    };
  }

  async getTransactions(whatsappNumber: string, period: string, timezone: string, limit = 100) {
    const { from, to } = parsePeriod(period, timezone);
    const conditions = [eq(transactions.whatsappId, whatsappNumber)];
    if (from) conditions.push(gte(transactions.createdAt, from));
    if (to) conditions.push(lt(transactions.createdAt, to));

    const rows = await this.db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.createdAt))
      .limit(limit)
      .all();

    return rows.map((trx) => ({
      id: trx.id,
      amount: trx.amount,
      transactionType: trx.transactionType,
      category: trx.category,
      description: trx.description,
      createdAt: trx.createdAt ? trx.createdAt.getTime() : null,
    }));
  }

  async updateTransaction(
    whatsappNumber: string,
    id: number,
    data: { amount?: number; transactionType?: string; category?: string; description?: string },
  ) {
    const existing = await this.db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.whatsappId, whatsappNumber)))
      .get();

    if (!existing) {
      return { ok: false as const, error: 'not_found' as const };
    }

    const patch: Partial<typeof transactions.$inferInsert> = {};
    if (data.amount !== undefined) {
      if (typeof data.amount !== 'number' || !Number.isFinite(data.amount) || data.amount <= 0) {
        return { ok: false as const, error: 'invalid_amount' as const };
      }
      patch['amount'] = data.amount;
    }
    if (data.transactionType !== undefined) {
      if (data.transactionType !== 'income' && data.transactionType !== 'expense') {
        return { ok: false as const, error: 'invalid_type' as const };
      }
      patch['transactionType'] = data.transactionType;
    }
    if (data.category !== undefined) patch['category'] = data.category.trim() || null;
    if (data.description !== undefined) patch['description'] = data.description.trim() || null;

    await this.db.update(transactions).set(patch).where(eq(transactions.id, id));

    return { ok: true as const };
  }

  async deleteTransaction(whatsappNumber: string, id: number) {
    const existing = await this.db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.whatsappId, whatsappNumber)))
      .get();

    if (!existing) {
      return { ok: false as const, error: 'not_found' as const };
    }

    await this.db.delete(transactions).where(eq(transactions.id, id));

    return { ok: true as const };
  }

  async getCategories(whatsappNumber: string, period: string, timezone: string) {
    const { from, to } = parsePeriod(period, timezone);
    const conditions = [eq(transactions.whatsappId, whatsappNumber)];
    if (from) conditions.push(gte(transactions.createdAt, from));
    if (to) conditions.push(lt(transactions.createdAt, to));

    const rows = await this.db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .all();

    const map = new Map<string, { type: string; total: number; count: number }>();
    for (const trx of rows) {
      const key = trx.category || (trx.transactionType === 'income' ? 'Income' : 'Expense');
      const entry = map.get(key) ?? { type: trx.transactionType, total: 0, count: 0 };
      entry.total += trx.amount;
      entry.count += 1;
      map.set(key, entry);
    }

    return Array.from(map.entries())
      .map(([category, v]) => ({ category, type: v.type, total: v.total, count: v.count }))
      .sort((a, b) => b.total - a.total);
  }

  async getBudget(whatsappNumber: string) {
    const budget = await this.db
      .select()
      .from(budgets)
      .where(eq(budgets.whatsappNumber, whatsappNumber))
      .orderBy(desc(budgets.createdAt))
      .limit(1)
      .get();

    if (!budget) return null;

    const { totalExpense } = await this.getSummary(whatsappNumber, 'month', DEFAULT_TIMEZONE);
    const remaining = budget.amount - totalExpense;
    const percentUsed = budget.amount > 0 ? (totalExpense / budget.amount) * 100 : 0;

    return {
      amount: budget.amount,
      period: budget.period,
      spent: totalExpense,
      remaining,
      percentUsed: Math.round(percentUsed * 10) / 10,
    };
  }
}

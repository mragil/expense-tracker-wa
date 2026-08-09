import { Hono } from 'hono';
import { inferTimezoneFromPhone } from '@/lib/time';
import type { AppEnv } from '@/types';

const api = new Hono<AppEnv>();

api.use('*', async (c, next) => {
  await next();
  c.header('Cache-Control', 'no-store');
});

api.get('/health', (c) => c.json({ status: 'ok' }));

api.post('/auth/request-otp', async (c) => {
  const services = c.var.services;
  const body = await c.req.json<{ phone?: string }>().catch(() => ({} as { phone?: string }));
  const phone = (body.phone ?? '').trim();

  if (!phone) {
    return c.json({ ok: false, error: 'missing_phone' }, 400);
  }

  const ip = c.req.header('CF-Connecting-IP') ?? undefined;
  const result = await services.dashboard.requestOtp(phone, ip);
  if (!result.ok) {
    const status = result.error === 'unknown_number' ? 404 : result.error === 'rate_limited' ? 429 : 500;
    return c.json(result, status);
  }
  return c.json(result);
});

api.post('/auth/verify', async (c) => {
  const services = c.var.services;
  const body = await c.req
    .json<{ phone?: string; code?: string }>()
    .catch(() => ({} as { phone?: string; code?: string }));
  const phone = (body.phone ?? '').trim();
  const code = (body.code ?? '').trim();

  if (!phone || !code) {
    return c.json({ ok: false, error: 'missing_fields' }, 400);
  }

  const ip = c.req.header('CF-Connecting-IP') ?? undefined;
  const result = await services.dashboard.verifyOtp(phone, code, ip);
  if (!result.ok) {
    const status = result.error === 'no_code' ? 404 : result.error === 'rate_limited' ? 429 : 400;
    return c.json(result, status);
  }
  return c.json(result);
});

api.post('/auth/logout', async (c) => {
  const services = c.var.services;
  const token = (c.req.header('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  await services.dashboard.logout(token);
  return c.json({ ok: true });
});

api.get('/auth/me', async (c) => {
  const services = c.var.services;
  const token = (c.req.header('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const me = await services.dashboard.getMe(token);
  if (!me) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  return c.json(me);
});

api.patch('/auth/me', async (c) => {
  const services = c.var.services;
  const token = (c.req.header('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const body = await c.req.json<{ language?: string }>().catch(() => ({} as { language?: string }));
  const result = await services.dashboard.updateLanguage(token, body.language ?? '');
  if (!result.ok) {
    const status = result.error === 'unauthorized' ? 401 : 400;
    return c.json(result, status);
  }
  const me = await services.dashboard.getMe(token);
  if (!me) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  return c.json(me);
});

api.use('/dashboard/*', async (c, next) => {
  const services = c.var.services;
  const token = (c.req.header('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const session = await services.dashboard.getUserForToken(token);
  if (!session) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  c.set('session', { whatsappNumber: session.whatsappNumber });
  await next();
  return undefined;
});

api.get('/dashboard/summary', async (c) => {
  const services = c.var.services;
  const session = c.get('session')!;
  const period = (c.req.query('period') || 'month').trim();
  const timezone = c.req.query('timezone') || inferTimezoneFromPhone(session.whatsappNumber);
  const data = await services.dashboard.getSummary(session.whatsappNumber, period, timezone);
  return c.json(data);
});

api.get('/dashboard/transactions', async (c) => {
  const services = c.var.services;
  const session = c.get('session')!;
  const period = (c.req.query('period') || 'month').trim();
  const timezone = c.req.query('timezone') || inferTimezoneFromPhone(session.whatsappNumber);
  const limit = Number(c.req.query('limit') || 100);
  const data = await services.dashboard.getTransactions(session.whatsappNumber, period, timezone, limit);
  return c.json({ transactions: data });
});

api.get('/dashboard/categories', async (c) => {
  const services = c.var.services;
  const session = c.get('session')!;
  const period = (c.req.query('period') || 'month').trim();
  const timezone = c.req.query('timezone') || inferTimezoneFromPhone(session.whatsappNumber);
  const data = await services.dashboard.getCategories(session.whatsappNumber, period, timezone);
  return c.json({ categories: data });
});

api.get('/dashboard/budget', async (c) => {
  const services = c.var.services;
  const session = c.get('session')!;
  const data = await services.dashboard.getBudget(session.whatsappNumber);
  return c.json({ budget: data ?? null });
});

api.patch('/dashboard/transactions/:id', async (c) => {
  const services = c.var.services;
  const session = c.get('session')!;
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) {
    return c.json({ ok: false, error: 'invalid_id' }, 400);
  }
  const body = await c.req
    .json<{ amount?: number; transactionType?: string; category?: string; description?: string }>()
    .catch(() => ({} as { amount?: number; transactionType?: string; category?: string; description?: string }));
  const result = await services.dashboard.updateTransaction(session.whatsappNumber, id, body);
  if (!result.ok) {
    const status = result.error === 'not_found' ? 404 : 400;
    return c.json(result, status);
  }
  return c.json(result);
});

api.delete('/dashboard/transactions/:id', async (c) => {
  const services = c.var.services;
  const session = c.get('session')!;
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) {
    return c.json({ ok: false, error: 'invalid_id' }, 400);
  }
  const result = await services.dashboard.deleteTransaction(session.whatsappNumber, id);
  if (!result.ok) {
    const status = result.error === 'not_found' ? 404 : 400;
    return c.json(result, status);
  }
  return c.json(result);
});

export default api;

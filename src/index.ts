import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { createContainer } from '@/services/container';
import { factory } from '@/services/factory';
import type { AppEnv, WahaWebhookEnvelope } from '@/types';

const app = new Hono<AppEnv>();

app.use('*', logger());

app.use('*', async (c, next) => {
  const container = createContainer(c.env);
  c.set('services', container);
  await next();
});

app.get('/', (c) => {
  return c.text('Expense Tracker WA Bot - API Running');
});

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

app.post('/webhook', ...factory.createHandlers(async (c) => {
  const services = c.var.services;
  try {
    const rawBody = await c.req.text();
    if (!rawBody) {
      console.warn('Received empty webhook body');
      return c.json({ status: 'ignored', reason: 'empty_body' });
    }

    const body = JSON.parse(rawBody) as WahaWebhookEnvelope;
    const result = await services.webhook.handleWebhook(body);
    return c.json(result);
  } catch (error) {
    console.error('Webhook processing error:', error);
    return c.json({ status: 'error', message: 'Internal server error' }, 500);
  }
}));

export default {
  fetch: app.fetch,
};

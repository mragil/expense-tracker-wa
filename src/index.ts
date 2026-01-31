import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { config } from 'dotenv';
import * as webhookService from './services/webhook.service';
import type { EvolutionWebhookPayload } from './lib/evolution';

config();

const app = new Hono();

app.use('*', logger());

app.get('/', (c) => {
  return c.text('Expense Tracker WA Bot - API Running');
});

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

app.post('/webhook/messages-upsert', async (c) => {
  try {
    const rawBody = await c.req.text();
    if (!rawBody) {
      console.warn('Received empty webhook body');
      return c.json({ status: 'ignored', reason: 'empty_body' });
    }
    
    const body = JSON.parse(rawBody) as EvolutionWebhookPayload;
    const result = await webhookService.handleWebhook(body);
    return c.json(result);
  } catch (error) {
    console.error('Webhook processing error:', error);
    return c.json({ status: 'error', message: 'Internal server error' }, 500);
  }
});

app.post('/webhook/group-participants-update', async (c) => {
  try {
    const body = await c.req.json();
    const result = await webhookService.handleGroupUpdate(body);
    return c.json(result);
  } catch (error) {
    console.error('Group update error:', error);
    return c.json({ status: 'error', message: 'Internal server error' }, 500);
  }
});

app.post('/webhook/groups-upsert', async (c) => {
  try {
    const body = await c.req.json();
    const result = await webhookService.handleGroupUpsert(body);
    return c.json(result);
  } catch (error) {
    console.error('Group upsert error:', error);
    return c.json({ status: 'error', message: 'Internal server error' }, 500);
  }
});

const port = Number(process.env.PORT) || 3000;
console.log(`Main service is running on port ${port}`);

serve({
  fetch: app.fetch,
  port
});

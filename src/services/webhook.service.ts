import { db } from '../db/index';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { extractMessageText, sendTextMessage } from '../lib/evolution';
import type { EvolutionWebhookPayload } from '../lib/evolution';
import * as onboarding from './onboarding.service';
import * as transaction from './transaction.service';
import { extractIntent } from '../lib/ai';
import * as reportService from './report.service';

export async function handleWebhook(payload: EvolutionWebhookPayload) {
  if (payload.event !== 'messages.upsert' || payload.data.key.fromMe) {
    return { status: 'ignored' };
  }

  const remoteJid = payload.data.key.remoteJid;
  const isWhitelisted = process.env.EVOLUTION_WHITELISTED_NUMBERS?.split(',').includes(remoteJid);

  if (!isWhitelisted) {
    return { status: 'not_whitelisted' };
  }

  const messageText = extractMessageText(payload);
  console.log('Received message:', messageText);

  if (!messageText) return { status: 'no_text' };

  const user = await db.query.users.findFirst({
    where: eq(users.whatsappNumber, remoteJid),
  });

  if (!user) {
    await onboarding.startOnboarding(remoteJid);
    return { status: 'onboarding_started' };
  }

  if (user.onboardingStep !== 'completed') {
    await onboarding.handleOnboarding(remoteJid, messageText, user);
    return { status: 'onboarding_continue' };
  }

  const intent = await extractIntent(messageText);

  if ('error' in intent) {
    if (intent.error === 'unsupported_topic') {
      await sendTextMessage(remoteJid, "I'm sorry, I can only help you log expenses/income or show reports. Try something like 'Spent 50k on coffee' or 'What is my expense for today?'.");
    } else {
      await sendTextMessage(remoteJid, "Oops! I had trouble understanding that. Could you try rephrasing it?");
    }
    return { status: 'unsupported_topic' };
  }

  if (intent.type === 'report') {
    await reportService.generateSummary(remoteJid, intent.period);
    return { status: 'processed_report' };
  }

  await transaction.handleTransaction(remoteJid, intent);
  return { status: 'processed_transaction' };
}

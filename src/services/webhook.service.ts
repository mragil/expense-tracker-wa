import { db } from '../db/index';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { extractMessageText } from '../lib/evolution';
import type { EvolutionWebhookPayload } from '../lib/evolution';
import * as onboarding from './onboarding.service';
import * as transaction from './transaction.service';

export async function handleWebhook(payload: EvolutionWebhookPayload) {
  console.log('Received webhook:', payload);
  if (payload.event !== 'messages.upsert' || payload.data.key.fromMe) {
    return { status: 'ignored' };
  }

  const remoteJid = payload.data.key.remoteJid;
  const messageText = extractMessageText(payload);

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

  await transaction.handleTransaction(remoteJid, messageText);
  return { status: 'processed_transaction' };
}

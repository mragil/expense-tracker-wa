import { db } from '../db/index';
import { users } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { extractMessageText, sendTextMessage } from '../lib/evolution';
import type { EvolutionWebhookPayload } from '../lib/evolution';
import * as onboarding from './onboarding.service';
import * as transaction from './transaction.service';
import { extractIntent } from '../lib/ai';
import * as reportService from './report.service';
import { leaveGroup } from '../lib/evolution';

export async function handleWebhook(payload: EvolutionWebhookPayload) {
  if (payload.event !== 'messages.upsert' || payload.data.key.fromMe) {
    return { status: 'ignored' };
  }

  const remoteJid = payload.data.key.remoteJid;
  const senderJid = payload.data.key.participant || payload.data.author || remoteJid;
  const isGroup = remoteJid.endsWith('@g.us');

  // Whitelist check: required for personal chats, skipped for groups
  if (!isGroup) {
    const isWhitelisted = process.env.EVOLUTION_WHITELISTED_NUMBERS?.split(',').includes(senderJid);
    if (!isWhitelisted) {
      return { status: 'not_whitelisted' };
    }
  }

  const messageText = extractMessageText(payload);
  console.log('Received message:', messageText);

  if (!messageText) return { status: 'no_text' };

  if (!isGroup) {
    const user = await db.query.users.findFirst({
      where: eq(users.whatsappNumber, senderJid),
    });

    if (!user) {
      await onboarding.startOnboarding(remoteJid);
      return { status: 'onboarding_started' };
    }

    if (user.onboardingStep !== 'completed') {
      await onboarding.handleOnboarding(remoteJid, messageText, user);
      return { status: 'onboarding_continue' };
    }
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

  await transaction.handleTransaction(remoteJid, intent, senderJid);
  return { status: 'processed_transaction' };
}

export async function handleGroupUpdate(payload: any) {
  console.log('Received group update:', JSON.stringify(payload, null, 2));
  
  const { action, author, remoteJid } = payload.data;
  const instance = payload.instance;

  if (action === 'add') {
    // Security: Check if the inviter is a registered and active user
    const inviter = await db.query.users.findFirst({
      where: and(eq(users.whatsappNumber, author), eq(users.isActive, true)),
    });

    if (!inviter) {
      console.warn(`Unauthorized group join attempt in ${remoteJid} by ${author}`);
      await leaveGroup(instance, remoteJid);
      return { status: 'left_unauthorized_group' };
    }

    const welcomeMessage = `*Halo Semuanya!* 👋\n\n` +
      `Saya adalah *ExpenseBot*, asisten pencatat pengeluaran Anda.\n\n` +
      `Ketik pesan seperti:\n` +
      `- "Beli kopi 25rb"\n` +
      `- "Gajian 5jt"\n` +
      `- "Berapa pengeluaran hari ini?"\n\n` +
      `Saya akan mencatat pengeluaran untuk *Grup ini*.`;

    await sendTextMessage(remoteJid, welcomeMessage);
    return { status: 'group_welcome_sent' };
  }

  return { status: 'ignored' };
}

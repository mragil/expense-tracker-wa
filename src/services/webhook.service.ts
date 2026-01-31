import { db } from '../db/index';
import { users, groups } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { extractMessageText, sendTextMessage, isWhitelisted, leaveGroup } from '../lib/evolution';
import type { EvolutionWebhookPayload } from '../lib/evolution';
import * as onboarding from './onboarding.service';
import * as transaction from './transaction.service';
import { extractIntent } from '../lib/ai';
import * as reportService from './report.service';
import * as budgetService from './budget.service';
import { getT, type Language } from './i18n.service';

export async function handleWebhook(payload: EvolutionWebhookPayload) {
  if (payload.event !== 'messages.upsert' || payload.data.key.fromMe) {
    return { status: 'ignored' };
  }
  const remoteJid = payload.data.key.remoteJid;
  const senderJid = payload.data.key.participant || payload.data.author || remoteJid;
  const isGroup = remoteJid.endsWith('@g.us');

  // Whitelist check: required for personal chats, skipped for groups
  if (!isGroup) {
    if (!isWhitelisted(senderJid)) {
      return { status: 'not_whitelisted' };
    }
  }

  const messageText = extractMessageText(payload);
  console.log('Received message:', { remoteJid, senderJid,messageText });

  if (!messageText) return { status: 'no_text' };

  const user = await db.query.users.findFirst({
    where: eq(users.whatsappNumber, senderJid),
  });

  const intent = await extractIntent(messageText);
  const lang = intent.detectedLanguage;

  if (!isGroup) {
    if (!user) {
      await onboarding.startOnboarding(remoteJid, lang);
      return { status: 'onboarding_started' };
    }

    if (user.onboardingStep !== 'completed') {
      await onboarding.handleOnboarding(remoteJid, messageText, user, lang);
      return { status: 'onboarding_continue' };
    }
  }

  const t = getT(lang);

  if ('error' in intent) {
    if (intent.error === 'unsupported_topic') {
      const helpMessage = 
        `${t.help_menu_title}\n\n` +
        `${t.help_menu_unsupported}\n\n` +
        `${t.help_menu_sections.logging}\n\n` +
        `${t.help_menu_sections.reports}\n\n` +
        `${t.help_menu_sections.footer}`;

      await sendTextMessage(remoteJid, helpMessage);
    } else {
      await sendTextMessage(remoteJid, t.error_generic);
    }
    return { status: 'unsupported_topic' };
  }

  if (intent.type === 'report') {
    await reportService.generateSummary(remoteJid, intent.period, lang);
    return { status: 'processed_report' };
  }

  if (intent.type === 'budget_inquiry') {
    await budgetService.checkBudget(remoteJid, lang);
    return { status: 'processed_budget_inquiry' };
  }

  if (intent.type === 'budget_update') {
    await budgetService.updateBudget(remoteJid, intent.amount, lang);
    return { status: 'processed_budget_update' };
  }

  if (intent.type === 'transaction') {
    await transaction.handleTransaction(remoteJid, intent, senderJid, lang);
    return { status: 'processed_transaction' };
  }

  return { status: 'ignored' };
}

export async function handleGroupUpsert(payload: any) {
  const instance = payload.instance;
  const groupData = payload.data?.[0];
  if (!groupData) return { status: 'no_data' };

  const { id: remoteJid, author, authorPn, subject } = groupData;
  const authorizingUser = author || authorPn;

  const whitelisted = isWhitelisted(author) || isWhitelisted(authorPn);
  
  const user = await db.query.users.findFirst({
    where: and(eq(users.whatsappNumber, authorizingUser), eq(users.isActive, true)),
  });

  if (!whitelisted && !user) {
    console.warn(`Unauthorized group registration attempt for ${remoteJid} ("${subject}") by ${authorizingUser}. Leaving group.`);
    await leaveGroup(instance, remoteJid);
    return { status: 'left_unauthorized_group' };
  }

  // Record or Reactivate Group
  await db.insert(groups).values({
    jid: remoteJid,
    name: subject || 'Untitled Group',
    addedBy: authorizingUser,
    isActive: true,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: groups.jid,
    set: { 
      name: subject || 'Untitled Group',
      addedBy: authorizingUser, 
      isActive: true, 
      updatedAt: new Date() 
    }
  });

  console.log(`Registered group via upsert: ${remoteJid} authorized by ${authorizingUser}`);
  await sendGroupWelcomeMessage(remoteJid, 'id');
  
  return { status: 'group_registered' };
}

export async function handleGroupUpdate(payload: any) {
  const instance = payload.instance;
  const data = payload.data;
  const { action, author, remoteJid } = data;

  if (action === 'add') {
    const inviter = await db.query.users.findFirst({
      where: and(eq(users.whatsappNumber, author), eq(users.isActive, true)),
    });

    if (!inviter) {
      console.warn(`Unauthorized group join attempt in ${remoteJid} by ${author}`);
      await leaveGroup(instance, remoteJid);
      return { status: 'left_unauthorized_group' };
    }

    // Record group membership
    await db.insert(groups).values({
      jid: remoteJid,
      addedBy: author,
      isActive: true,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: groups.jid,
      set: { 
        addedBy: author, 
        isActive: true, 
        updatedAt: new Date() 
      }
    });

    await sendGroupWelcomeMessage(remoteJid);
    return { status: 'group_welcome_sent' };
  }

  if (action === 'remove' || action === 'leave') {
    const botJid = payload.sender;
    const isBotRemoved = data.participants.some((p: any) => p.phoneNumber === botJid);
    if (isBotRemoved) {
      await db.update(groups)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(groups.jid, data.id));
      console.log(`Bot removed from group: ${data.id}. Marked as inactive.`);
      return { status: 'group_inactive' };
    }
  }

  return { status: 'ignored' };
}

async function sendGroupWelcomeMessage(remoteJid: string, lang: Language = 'id') {
  const t = getT(lang);
  await sendTextMessage(remoteJid, t.group_welcome);
}

import { db } from '../db/index';
import { users, groups } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { extractMessageText, sendTextMessage } from '../lib/evolution';
import type { EvolutionWebhookPayload } from '../lib/evolution';
import * as onboarding from './onboarding.service';
import * as transaction from './transaction.service';
import { extractIntent } from '../lib/ai';
import * as reportService from './report.service';
import * as budgetService from './budget.service';
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
  console.log('Received message:', { remoteJid, senderJid,messageText });

  if (!messageText) return { status: 'no_text' };

  if (isGroup) {
    // Lazy Group Registration: Register group on first interaction if missed join event
    const group = await db.query.groups.findFirst({
      where: eq(groups.jid, remoteJid),
    });

    if (!group) {
      await db.insert(groups).values({
        jid: remoteJid,
        addedBy: senderJid, // Fallback to first interactor
        isActive: true,
        updatedAt: new Date(),
      });
      console.log(`Lazy registered group: ${remoteJid} via interaction from ${senderJid}`);
      
      await sendGroupWelcomeMessage(remoteJid);
      return { status: 'group_welcome_sent' };
    } else if (!group.isActive) {
      await db.update(groups)
        .set({ isActive: true, addedBy: senderJid, updatedAt: new Date() })
        .where(eq(groups.jid, remoteJid));
      console.log(`Reactivated group: ${remoteJid} via interaction from ${senderJid}`);
      
      await sendGroupWelcomeMessage(remoteJid);
      return { status: 'group_reactivated' };
    }
  }

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
      const helpMessage = 
        `*🤖 ExpenseBot Help Menu*\n\n` +
        `Saya tidak yakin apa yang Anda maksud. Berikut adalah beberapa hal yang bisa saya bantu:\n\n` +
        `*1️⃣ Pencatatan (Pemasukan/Pengeluaran)*\n` +
        `Cukup ketik secara alami, contoh:\n` +
        `• _"Beli kopi 25rb"_\n` +
        `• _"Gajian 5 juta"_\n` +
        `• _"Tadi makan siang soto 30.000"_\n\n` +
        `*2️⃣ Laporan Keuangan*\n` +
        `Tanyakan ringkasan saldo Anda, contoh:\n` +
        `• _"Pengeluaran hari ini"_\n` +
        `• _"Laporan minggu ini"_\n` +
        `• _"Berapa sisa budget bulan ini?"_\n\n` +
        `Silakan pilih salah satu opsi di atas atau ketik pertanyaan Anda! 📈💸`;

      await sendTextMessage(remoteJid, helpMessage);
    } else {
      await sendTextMessage(remoteJid, "Oops! Saya kesulitan memahami itu. Bisa coba ulangi kalimatnya?");
    }
    return { status: 'unsupported_topic' };
  }

  if (intent.type === 'report') {
    await reportService.generateSummary(remoteJid, intent.period);
    return { status: 'processed_report' };
  }

  if (intent.type === 'budget_inquiry') {
    await budgetService.checkBudget(remoteJid);
    return { status: 'processed_budget_inquiry' };
  }

  if (intent.type === 'budget_update') {
    await budgetService.updateBudget(remoteJid, intent.amount);
    return { status: 'processed_budget_update' };
  }

  if (intent.type === 'transaction') {
    await transaction.handleTransaction(remoteJid, intent, senderJid);
    return { status: 'processed_transaction' };
  }

  return { status: 'ignored' };
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

async function sendGroupWelcomeMessage(remoteJid: string) {
  const welcomeMessage = `*Halo Semuanya!* 👋\n\n` +
    `Saya adalah *ExpenseBot*, asisten pencatat pengeluaran Anda.\n\n` +
    `Ketik pesan seperti:\n` +
    `- "Beli kopi 25rb"\n` +
    `- "Gajian 5jt"\n` +
    `- "Berapa pengeluaran hari ini?"\n\n` +
    `Saya akan mencatat pengeluaran untuk *Grup ini*.`;

  await sendTextMessage(remoteJid, welcomeMessage);
}

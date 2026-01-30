import { db } from '../db/index';
import { users, vouchers, budgets } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { sendTextMessage } from '../lib/evolution';
import { extractName, extractBudget } from '../lib/ai';

async function handleVoucherStep(remoteJid: string, messageText: string) {
  const voucherLine = await db.query.vouchers.findFirst({
    where: and(eq(vouchers.code, messageText.trim()), eq(vouchers.isUsed, false)),
  });

  if (voucherLine) {
    await db.update(vouchers).set({ isUsed: true, usedBy: remoteJid }).where(eq(vouchers.code, voucherLine.code));
    await db.update(users).set({ onboardingStep: 'name' }).where(eq(users.whatsappNumber, remoteJid));
    await sendTextMessage(remoteJid, "Access granted! What should I call you?");
  } else {
    await sendTextMessage(remoteJid, "Invalid or already used code. Please check and try again.");
  }
}

async function handleNameStep(remoteJid: string, messageText: string) {
  const name = await extractName(messageText);
  await db.update(users).set({ displayName: name, onboardingStep: 'budget' }).where(eq(users.whatsappNumber, remoteJid));
  await sendTextMessage(remoteJid, `Nice to meet you, ${name}! Now, what is your monthly budget for expenses? (e.g., "5 million a month" or "1000000")`);
}

async function handleBudgetStep(remoteJid: string, messageText: string) {
  const budgetInfo = await extractBudget(messageText);
  if (budgetInfo) {
    await db.insert(budgets).values({
      whatsappNumber: remoteJid,
      amount: budgetInfo.amount,
      period: budgetInfo.period,
    });
    await db.update(users).set({ onboardingStep: 'completed', isActive: true }).where(eq(users.whatsappNumber, remoteJid));
    await sendTextMessage(remoteJid, "You're all set! You can log expenses naturally (e.g., 'Spent 50k for lunch'), or type `/report` anytime to get your data.");
  } else {
    await sendTextMessage(remoteJid, "I couldn't quite catch the amount. Could you please specify it clearly?");
  }
}

export async function handleOnboarding(remoteJid: string, messageText: string, user: any) {
  switch (user.onboardingStep) {
    case 'voucher':
      await handleVoucherStep(remoteJid, messageText);
      break;
    case 'name':
      await handleNameStep(remoteJid, messageText);
      break;
    case 'budget':
      await handleBudgetStep(remoteJid, messageText);
      break;
  }
}

export async function startOnboarding(remoteJid: string) {
  await db.insert(users).values({
    whatsappNumber: remoteJid,
    onboardingStep: 'voucher',
  });
  await sendTextMessage(remoteJid, "Welcome to ExpenseBot! 📊 To get started, please enter your **Access Code** (Voucher).");
}

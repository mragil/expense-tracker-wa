import { db } from '../db/index';
import { users, budgets } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { sendTextMessage } from '../lib/evolution';
import { extractName, extractBudget } from '../lib/ai';


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
    await sendTextMessage(remoteJid, "You're all set! You can log expenses naturally (e.g., 'Spent 50k for lunch'), or ask 'what is my expense for today?' anytime.");
  } else {
    await sendTextMessage(remoteJid, "I couldn't quite catch the amount. Could you please specify it clearly?");
  }
}

export async function handleOnboarding(remoteJid: string, messageText: string, user: any) {
  switch (user.onboardingStep) {
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
    onboardingStep: 'name',
  });
  await sendTextMessage(remoteJid, "Welcome to ExpenseBot! 📊 Before we start, what should I call you?");
}

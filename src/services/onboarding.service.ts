import { db } from '../db/index';
import { users, budgets } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { sendTextMessage } from '../lib/evolution';
import { extractName, extractBudget } from '../lib/ai';


async function handleNameStep(remoteJid: string, messageText: string) {
  const name = await extractName(messageText);
  await db.update(users).set({ displayName: name, onboardingStep: 'budget' }).where(eq(users.whatsappNumber, remoteJid));
  await sendTextMessage(remoteJid, `Nice to meet you, ${name}! 👋\n\nNow, what is your *Target Monthly Budget*? (e.g., "5jt" or "3000000")\n\nI will use this to track your spending and notify you if you're getting close to your limit. 📊\n\n_Wait, not ready? Type *SKIP* to set it later!_`);
}

async function handleBudgetStep(remoteJid: string, messageText: string) {
  const isSkip = messageText.toLowerCase().includes('skip') || messageText.toLowerCase().includes('nanti');
  
  if (isSkip) {
    await db.update(users).set({ onboardingStep: 'completed', isActive: true }).where(eq(users.whatsappNumber, remoteJid));
    await sendTextMessage(remoteJid, "No problem! You can set your monthly budget anytime by typing something like 'Budget 5jt'.\n\nNow you're all set! You can log expenses naturally (e.g., 'Spent 50k for lunch'). 🚀");
    return;
  }

  const budgetInfo = await extractBudget(messageText);
  if (budgetInfo) {
    await db.insert(budgets).values({
      whatsappNumber: remoteJid,
      amount: budgetInfo.amount,
      period: 'month',
    });
    await db.update(users).set({ onboardingStep: 'completed', isActive: true }).where(eq(users.whatsappNumber, remoteJid));
    await sendTextMessage(remoteJid, `Perfect! Your monthly budget of *${budgetInfo.amount.toLocaleString('id-ID')}* is set. ✅\n\nYou're all set! You can log expenses naturally (e.g., 'Spent 50k for lunch'), or ask 'what is my expense for today?' anytime.`);
  } else {
    await sendTextMessage(remoteJid, "I couldn't quite catch the amount. Could you please specify it clearly (e.g., '5jt') or type 'skip' to do it later?");
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

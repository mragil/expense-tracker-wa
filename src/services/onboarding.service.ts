import { db } from '../db/index';
import { users, budgets } from '../db/schema';
import { eq } from 'drizzle-orm';
import { sendTextMessage } from '../lib/evolution';
import { extractName, extractBudget } from '../lib/ai';
import { getT, type Language } from './i18n.service';

async function handleNameStep(remoteJid: string, messageText: string, user: any, lang: Language) {
  const name = await extractName(messageText);
  await db.update(users)
    .set({ displayName: name, onboardingStep: 'budget' })
    .where(eq(users.whatsappNumber, remoteJid));
  
  const t = getT(lang);
  await sendTextMessage(remoteJid, t.onboarding_budget_prompt(name));
}

async function handleBudgetStep(remoteJid: string, messageText: string, user: any, lang: Language) {
  const isSkip = messageText.toLowerCase().includes('skip') || messageText.toLowerCase().includes('nanti');
  const t = getT(lang);

  if (isSkip) {
    await db.update(users).set({ onboardingStep: 'completed', isActive: true }).where(eq(users.whatsappNumber, remoteJid));
    await sendTextMessage(remoteJid, t.onboarding_completed(user.displayName));
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
    await sendTextMessage(remoteJid, t.onboarding_completed(user.displayName));
  } else {
    await sendTextMessage(remoteJid, t.error_budget_parse);
  }
}

export async function handleOnboarding(remoteJid: string, messageText: string, user: any, lang: Language) {
  switch (user.onboardingStep) {
    case 'name':
      await handleNameStep(remoteJid, messageText, user, lang);
      break;
    case 'budget':
      await handleBudgetStep(remoteJid, messageText, user, lang);
      break;
  }
}

export async function startOnboarding(remoteJid: string, lang: Language) {
  await db.insert(users).values({
    whatsappNumber: remoteJid,
    onboardingStep: 'name',
  }).onConflictDoUpdate({
    target: users.whatsappNumber,
    set: { onboardingStep: 'name' }
  });
  
  const t = getT(lang);
  await sendTextMessage(remoteJid, t.welcome_onboarding); // Use full welcome prompt
  await sendTextMessage(remoteJid, t.onboarding_name_prompt);
}

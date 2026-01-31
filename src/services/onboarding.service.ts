import { db } from '../db/index';
import { users, budgets } from '../db/schema';
import { eq } from 'drizzle-orm';
import { sendTextMessage } from '../lib/evolution';
import { extractName, extractBudget } from '../lib/ai';
import { getT, type Language } from './i18n.service';

async function handleLanguageStep(remoteJid: string, messageText: string) {
  const text = messageText.toLowerCase();
  let lang: Language = 'id';
  if (text.includes('en') || text === '2') {
    lang = 'en';
  }

  await db.update(users)
    .set({ language: lang, onboardingStep: 'name' })
    .where(eq(users.whatsappNumber, remoteJid));
  
  const t = getT(lang);
  await sendTextMessage(remoteJid, t.onboarding_name_prompt);
}

async function handleNameStep(remoteJid: string, messageText: string, user: any) {
  const name = await extractName(messageText);
  await db.update(users)
    .set({ displayName: name, onboardingStep: 'budget' })
    .where(eq(users.whatsappNumber, remoteJid));
  
  const t = getT(user.language as Language);
  await sendTextMessage(remoteJid, t.onboarding_budget_prompt(name));
}

async function handleBudgetStep(remoteJid: string, messageText: string, user: any) {
  const isSkip = messageText.toLowerCase().includes('skip') || messageText.toLowerCase().includes('nanti');
  const t = getT(user.language as Language);

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
    await sendTextMessage(remoteJid, t.error_budget_parse);
  }
}

export async function handleOnboarding(remoteJid: string, messageText: string, user: any) {
  switch (user.onboardingStep) {
    case 'language':
      await handleLanguageStep(remoteJid, messageText);
      break;
    case 'name':
      await handleNameStep(remoteJid, messageText, user);
      break;
    case 'budget':
      await handleBudgetStep(remoteJid, messageText, user);
      break;
  }
}

export async function startOnboarding(remoteJid: string) {
  await db.insert(users).values({
    whatsappNumber: remoteJid,
    onboardingStep: 'language',
  }).onConflictDoUpdate({
    target: users.whatsappNumber,
    set: { onboardingStep: 'language' }
  });
  
  const t = getT('id'); // Default to ID for the initial prompt
  await sendTextMessage(remoteJid, t.onboarding_language_select);
}

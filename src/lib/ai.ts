import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { config } from 'dotenv';

config();

export async function extractInformation(prompt: string, userMessage: string) {
  const { text } = await generateText({
    model: google('gemini-2.5-flash'),
    system: prompt,
    prompt: userMessage,
  });

  return text.trim();
}

/**
 * Clean AI response to extract pure JSON
 */
function cleanJson(result: string): string {
  return result
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();
}

export async function extractName(userMessage: string): Promise<string> {
  const systemPrompt = `You are an assistant for an expense tracker. 
Extract the person's name from their message. 
If they just provide a name, return only the name. 
If they say "My name is Ally", return "Ally". 
Return ONLY the name string.`;

  return await extractInformation(systemPrompt, userMessage);
}

export async function extractBudget(userMessage: string): Promise<{ amount: number; period: string } | null> {
  const systemPrompt = `You are an assistant for an expense tracker. 
Extract the budget amount and period from the user message. 
The period can be 'day', 'month', or 'year'. Default to 'month' if not specified.
Return ONLY a JSON object like {"amount": 500000, "period": "month"}. 
If no amount is found, return {"error": "no_amount"}.`;

  const result = await extractInformation(systemPrompt, userMessage);
  try {
    const parsed = JSON.parse(cleanJson(result));
    if (parsed.error) return null;
    return parsed;
  } catch (e) {
    console.error('Failed to parse budget JSON:', result);
    return null;
  }
}

export interface TransactionData {
  type: 'transaction';
  amount: number;
  transactionType: 'income' | 'expense';
  category: string;
  description: string;
}

export interface ReportData {
  type: 'report';
  period: 'today' | 'week' | 'month' | 'year';
}

export interface BudgetInquiryData {
  type: 'budget_inquiry';
}

export interface BudgetUpdateData {
  type: 'budget_update';
  amount: number;
  period: 'day' | 'month' | 'year';
}

export interface LanguageChangeData {
  type: 'language_change';
  language: 'id' | 'en';
}

export type UserIntent = 
  | TransactionData 
  | ReportData 
  | BudgetInquiryData 
  | BudgetUpdateData 
  | { error: string };

export type UserIntentWithLang = (UserIntent & { detectedLanguage: 'id' | 'en' }) | { error: string, detectedLanguage: 'id' | 'en' };

export async function extractIntent(userMessage: string): Promise<UserIntentWithLang> {
  const systemPrompt = `You are an Expense Tracker assistant.
Your job is to understand the user's intent AND detect the language of the message.

IF the message is mainly in Indonesian, set "detectedLanguage": "id".
IF the message is mainly in English, set "detectedLanguage": "en".
If unsure, default to "id".

If logging a transaction, return JSON:
{
  "type": "transaction",
  "amount": number,
  "transactionType": "income" | "expense",
  "category": string,
  "description": string,
  "detectedLanguage": "id" | "en"
}

If asking for a report/summary, return JSON:
{
  "type": "report",
  "period": "today" | "week" | "month" | "year",
  "detectedLanguage": "id" | "en"
}

If asking about their budget status, return JSON:
{
  "type": "budget_inquiry",
  "detectedLanguage": "id" | "en"
}

If setting or updating their budget, return JSON:
{
  "type": "budget_update",
  "amount": number,
  "period": "day" | "month" | "year",
  "detectedLanguage": "id" | "en"
}

Rules:
1. "transactionType" must be exactly "income" or "expense".
2. "amount" must be a positive number.
3. "category" should be a short, one-word category.
4. "description" should be what the user spent it on.
5. "period" must be exactly "month" for budget updates.
6. EXPLICITLY SUPPORT both English and Indonesian commands.
7. If the message is NOT related to spending, income, budget management, or reports, respond with {"error": "unsupported_topic", "detectedLanguage": "id" | "en"}.
8. Do NOT include any markdown or extra text.`;

  const result = await extractInformation(systemPrompt, userMessage);
  try {
    const cleanedResult = cleanJson(result);
    const parsed = JSON.parse(cleanedResult);
    
    // Fallback for missing period in report intents
    if (parsed.type === 'report' && !parsed.period) {
      parsed.period = 'today';
    }

    // Ensure detectedLanguage exists
    if (!parsed.detectedLanguage) {
      parsed.detectedLanguage = 'id';
    }

    return parsed;
  } catch (e) {
    console.error('Failed to parse intent JSON:', result);
    return { error: 'parse_error', detectedLanguage: 'id' };
  }
}

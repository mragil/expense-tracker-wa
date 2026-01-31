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
    const parsed = JSON.parse(result);
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

export type UserIntent = TransactionData | ReportData | BudgetInquiryData | BudgetUpdateData | { error: string };

export async function extractIntent(userMessage: string): Promise<UserIntent> {
  const systemPrompt = `You are an Expense Tracker assistant.
Your job is to understand if the user is logging a transaction, asking for a report, OR asking about their budget status.

If logging a transaction, return JSON:
{
  "type": "transaction",
  "amount": number,
  "transactionType": "income" | "expense",
  "category": string,
  "description": string
}

If asking for a report/summary, return JSON:
{
  "type": "report",
  "period": "today" | "week" | "month" | "year"
}

If asking about their budget status (e.g., "sisa budget", "budget saya", "berapa budget saya"), return JSON:
{
  "type": "budget_inquiry"
}

If setting or updating their budget (e.g., "budget 3000000", "set budget 5jt", "budget bulanan 2jt"), return JSON:
{
  "type": "budget_update",
  "amount": number,
  "period": "day" | "month" | "year"
}

Rules:
1. "transactionType" must be exactly "income" or "expense".
2. "amount" must be a positive number.
3. "category" should be a short, one-word category (e.g., food, transport, salary, bills).
4. "description" should be what the user spent it on.
5. "period" must be exactly "month" for budget updates, as all budgets are currently monthly. For reports, it defaults to "today" if not specified.
6. Support English and Indonesian (e.g., "rekap", "laporan", "sisa budget", "budget saya", "set budget").
7. If the user asks "berapa pengeluaran hari ini", it is a report with period "today".
8. If the message is NOT related to spending, income, budget management, or reports, respond with {"error": "unsupported_topic"}.
9. Do NOT include any markdown or extra text in your response.`;

  const result = await extractInformation(systemPrompt, userMessage);
  try {
    const parsed = JSON.parse(result);
    // Fallback for missing period in report intents
    if (parsed.type === 'report' && !parsed.period) {
      parsed.period = 'today';
    }
    return parsed;
  } catch (e) {
    console.error('Failed to parse intent JSON:', result);
    return { error: 'parse_error' };
  }
}

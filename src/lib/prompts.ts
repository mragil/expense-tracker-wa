export const NAME_EXTRACTION_PROMPT = `You are an assistant for an expense tracker. 
Extract the person's name from their message. 
If they just provide a name, return only the name. 
If they say "My name is Ally", return "Ally". 
Return ONLY the name string.`;

export const BUDGET_EXTRACTION_PROMPT = `You are an assistant for an expense tracker. 
Extract the budget amount and period from the user message. 
The period can be 'day', 'month', or 'year'. Default to 'month' if not specified.
Return ONLY a JSON object like {"amount": 500000, "period": "month"}. 
If no amount is found, return {"error": "no_amount"}.`;

export const INTENT_EXTRACTION_PROMPT = `You are an Expense Tracker assistant.
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
  "period": "today" | "week" | "month" | "year" | "last_month" | "all" | "custom",
  "startDate": "YYYY-MM-DD", (only if period is "custom")
  "endDate": "YYYY-MM-DD", (only if period is "custom")
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

import { 
  NAME_EXTRACTION_PROMPT, 
  BUDGET_EXTRACTION_PROMPT, 
  INTENT_EXTRACTION_PROMPT 
} from './prompts';
import type { UserIntentWithLang } from '@/types';

const PROXY_URL = process.env['PROXY_URL'] || '';
const PROXY_SECRET = process.env['PROXY_SECRET'] || '';

export async function extractInformation(prompt: string, userMessage: string) {
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': PROXY_SECRET,
    },
    body: JSON.stringify({
      model: 'gemini-2.5-flash-lite',
      system: prompt,
      prompt: userMessage,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Gemini proxy error:', error);
    throw new Error(`Gemini proxy error: ${response.status}`);
  }

  const data = await response.json();
  return data.text?.trim() || '';
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
  return await extractInformation(NAME_EXTRACTION_PROMPT, userMessage);
}

export async function extractBudget(userMessage: string): Promise<{ amount: number; period: string } | null> {
  const result = await extractInformation(BUDGET_EXTRACTION_PROMPT, userMessage);
  try {
    const parsed = JSON.parse(cleanJson(result));
    if (parsed.error) return null;
    return parsed;
  } catch (e) {
    console.error('Failed to parse budget JSON:', result);
    return null;
  }
}

export async function extractIntent(userMessage: string): Promise<UserIntentWithLang> {
  const dateContext = `Current date: ${new Date().toISOString().split('T')[0]}\n`;
  const result = await extractInformation(dateContext + INTENT_EXTRACTION_PROMPT, userMessage);
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

import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { 
  NAME_EXTRACTION_PROMPT, 
  BUDGET_EXTRACTION_PROMPT, 
  INTENT_EXTRACTION_PROMPT 
} from './prompts';
import type { UserIntentWithLang } from '@/types';

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

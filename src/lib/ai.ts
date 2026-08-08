import { 
  NAME_EXTRACTION_PROMPT, 
  BUDGET_EXTRACTION_PROMPT, 
  INTENT_EXTRACTION_PROMPT 
} from './prompts';
import { getDateContext, DEFAULT_TIMEZONE } from './time';
import type { UserIntentWithLang } from '@/types';

const CHAT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

export function createAi(ai: Ai) {
  async function extractInformation(prompt: string, userMessage: string) {
    const result = await ai.run(CHAT_MODEL, {
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: userMessage },
      ],
    });

    const content = (result as any)?.choices?.[0]?.message?.content as string | undefined;
    const text = content ?? '';
    return text.trim();
  }

  function cleanJson(result: string): string {
    return result
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
  }

  async function extractName(userMessage: string): Promise<string> {
    return await extractInformation(NAME_EXTRACTION_PROMPT, userMessage);
  }

  async function extractBudget(userMessage: string): Promise<{ amount: number; period: string } | null> {
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

  async function extractIntent(userMessage: string, timezone?: string): Promise<UserIntentWithLang> {
    const dateContext = getDateContext(timezone || DEFAULT_TIMEZONE) + '\n';
    const result = await extractInformation(dateContext + INTENT_EXTRACTION_PROMPT, userMessage);
    try {
      const cleanedResult = cleanJson(result);
      const parsed = JSON.parse(cleanedResult);

      if (parsed.type === 'report' && !parsed.period) {
        parsed.period = 'today';
      }

      if (!parsed.detectedLanguage) {
        parsed.detectedLanguage = 'id';
      }

      return parsed;
    } catch (e) {
      console.error('Failed to parse intent JSON:', result);
      return { error: 'parse_error', detectedLanguage: 'id' };
    }
  }

  return { extractName, extractBudget, extractIntent };
}

export type AiClient = ReturnType<typeof createAi>;

import type { EvolutionWebhookPayload } from '@/types';

const API_URL = Bun.env['EVOLUTION_API_URL'];
const API_KEY = Bun.env['EVOLUTION_API_KEY'];
const INSTANCE = Bun.env['EVOLUTION_INSTANCE'] || 'main';

export async function sendTextMessage(remoteJid: string, text: string, instance: string = INSTANCE) {
  try {
    const response = await fetch(`${API_URL}/message/sendText/${instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': API_KEY || '',
      },
      body: JSON.stringify({
        number: remoteJid,
        options: {
          delay: 1200,
          presence: 'composing',
          linkPreview: false,
        },
        text,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Evolution API Error:', data.response?.message || data);
    }

    return data;
  } catch (error) {
    console.error('Error sending message via Evolution API:', error);
  }
}

export function extractMessageText(payload: EvolutionWebhookPayload): string | undefined {
  return (
    payload.data.message?.conversation ||
    payload.data.message?.extendedTextMessage?.text
  );
}

export async function leaveGroup(instance: string, groupJid: string) {
  try {
    const response = await fetch(`${API_URL}/group/leaveGroup/${instance}?groupJid=${groupJid}`, {
      method: 'DELETE',
      headers: {
        'apikey': API_KEY || '',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Evolution API Leave Group Error:', data);
    }

    return data;
  } catch (error) {
    console.error('Error leaving group via Evolution API:', error);
  }
}

export function isWhitelisted(jid: string): boolean {
  const whitelist = Bun.env['EVOLUTION_WHITELISTED_NUMBERS']?.split(',') || [];
  return whitelist.includes(jid);
}

import { config } from 'dotenv';

config();

const API_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE || 'main';

export interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
      participant?: string;
    };
    message?: {
      conversation?: string;
      extendedTextMessage?: {
        text: string;
      };
    };
    pushName?: string;
    author?: string;
  };
}

export async function sendTextMessage(remoteJid: string, text: string, instance: string = INSTANCE) {
  console.log('Sending message via Evolution API:', text, remoteJid, INSTANCE);
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

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Evolution API Error:', errorData.response.message);
    }

    return await response.json();
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
    const response = await fetch(`${API_URL}/group/leave/${instance}`, {
      method: 'DELETE',
      headers: {
        'apikey': API_KEY || '',
      },
      body: JSON.stringify({
        groupJid: groupJid,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Evolution API Leave Group Error:', errorData);
    }

    return await response.json();
  } catch (error) {
    console.error('Error leaving group via Evolution API:', error);
  }
}

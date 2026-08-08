import type { WahaWebhookEnvelope, WahaMessagePayload } from '@/types';

export interface WahaConfig {
  apiUrl: string;
  apiKey: string;
  instance: string;
  whitelist: string[];
}

export function createWahaClient(config: WahaConfig) {
  const { apiUrl, apiKey, instance, whitelist } = config;

  async function sendTextMessage(chatId: string, text: string) {
    try {
      const response = await fetch(`${apiUrl}/api/sendText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
        },
        body: JSON.stringify({
          session: instance,
          chatId,
          text,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('WAHA API Error:', data);
      }

      return data;
    } catch (error) {
      console.error('Error sending message via WAHA:', error);
      return null;
    }
  }

  async function sendPoll(chatId: string, question: string, options: string[], multipleAnswers = false) {
    try {
      const response = await fetch(`${apiUrl}/api/sendPoll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
        },
        body: JSON.stringify({
          session: instance,
          chatId,
          poll: {
            name: question,
            options,
            multipleAnswers,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('WAHA sendPoll Error:', data);
      }

      return data;
    } catch (error) {
      console.error('Error sending poll via WAHA:', error);
      return null;
    }
  }

  async function sendList(chatId: string, message: {
    title: string;
    description?: string;
    footer?: string;
    button: string;
    sections: Array<{
      title?: string;
      rows: Array<{
        title: string;
        rowId: string;
        description?: string | null;
      }>;
    }>;
  }) {
    try {
      const response = await fetch(`${apiUrl}/api/sendList`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
        },
        body: JSON.stringify({
          session: instance,
          chatId,
          message,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('WAHA sendList Error:', data);
      }

      return data;
    } catch (error) {
      console.error('Error sending list via WAHA:', error);
      return null;
    }
  }

  async function leaveGroup(groupJid: string) {
    try {
      const encoded = encodeURIComponent(groupJid);
      const response = await fetch(`${apiUrl}/api/${instance}/groups/${encoded}/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('WAHA Leave Group Error:', data);
      }

      return data;
    } catch (error) {
      console.error('Error leaving group via WAHA:', error);
      return null;
    }
  }

  const lidCache = new Map<string, string>();

  async function resolvePhoneJid(jid: string): Promise<string> {
    if (!jid.endsWith('@lid')) return jid;
    if (lidCache.has(jid)) return lidCache.get(jid)!;
    try {
      const encoded = encodeURIComponent(jid);
      const response = await fetch(`${apiUrl}/api/${instance}/lids/${encoded}`, {
        headers: { 'X-Api-Key': apiKey },
      });
      if (response.ok) {
        const data = (await response.json()) as { lid?: string; pn?: string | null };
        if (data.pn) {
          lidCache.set(jid, data.pn);
          return data.pn;
        }
      }
    } catch (error) {
      console.error('Error resolving LID via WAHA:', error);
    }
    return jid;
  }

  async function isWhitelisted(jid: string): Promise<boolean> {
    const resolved = await resolvePhoneJid(jid);
    return whitelist.includes(resolved) || whitelist.includes(jid);
  }

  return {
    sendTextMessage,
    sendPoll,
    sendList,
    leaveGroup,
    resolvePhoneJid,
    isWhitelisted,
    extractMessageText: (envelope: WahaWebhookEnvelope): string | undefined => {
      const payload = envelope.payload as WahaMessagePayload;
      return payload?.body;
    },
  };
}

export type WahaClient = ReturnType<typeof createWahaClient>;

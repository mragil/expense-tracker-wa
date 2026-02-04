import { users, groups } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import type * as evolution from '@/lib/evolution';
import type { OnboardingService } from '@/services/onboarding.service';
import type { TransactionService } from '@/services/transaction.service';
import type { ReportService } from '@/services/report.service';
import type { BudgetService } from '@/services/budget.service';
import type { I18nService } from '@/services/i18n.service';
import { db as defaultDb } from '@/db/index';
import type { EvolutionWebhookPayload, Language, EvolutionGroupUpsertPayload, EvolutionGroupUpdatePayload, User } from '@/types';
import type * as ai from '@/lib/ai';

export class WebhookService {
  constructor(
    private db: typeof defaultDb,
    private i18n: I18nService,
    private onboarding: OnboardingService,
    private transaction: TransactionService,
    private budget: BudgetService,
    private report: ReportService,
    private evolutionClient: typeof evolution,
    private aiClient: typeof ai
  ) {}

  async handleWebhook(payload: EvolutionWebhookPayload) {
    if (payload.event !== 'messages.upsert' || payload.data.key.fromMe) {
      return { status: 'ignored' };
    }
    const remoteJid = payload.data.key.remoteJid;
    const senderJid = payload.data.key.participant || payload.data.author || remoteJid;
    const isGroup = remoteJid.endsWith('@g.us');

    // Whitelist check: required for personal chats, skipped for groups or if OPEN_FOR_PUBLIC is true
    const isOpenForPublic = Bun.env['OPEN_FOR_PUBLIC'] === 'true';
    if (!isGroup && !isOpenForPublic) {
      if (!this.evolutionClient.isWhitelisted(senderJid)) {
        return { status: 'not_whitelisted' };
      }
    }

    const messageText = this.evolutionClient.extractMessageText(payload);
    console.log('Received message:', { remoteJid, senderJid, messageText });

    if (!messageText) return { status: 'no_text' };

    const user: User | undefined = await this.db.query.users.findFirst({
      where: eq(users.whatsappNumber, senderJid),
    });

    const intent = await this.aiClient.extractIntent(messageText);

    console.log('Intent:', intent);

    const lang = intent.detectedLanguage;

    if (!isGroup) {
      if (!user) {
        await this.onboarding.startOnboarding(remoteJid, lang);
        return { status: 'onboarding_started' };
      }

      if (user.onboardingStep !== 'completed') {
        await this.onboarding.handleOnboarding(remoteJid, messageText, user, lang);
        return { status: 'onboarding_continue' };
      }
    }

    const t = this.i18n.getT(lang);

    if ('error' in intent) {
      if (intent.error === 'unsupported_topic') {
        const helpMessage = 
          `${t.help_menu_title}\n\n` +
          `${t.help_menu_unsupported}\n\n` +
          `${t.help_menu_sections.logging}\n\n` +
          `${t.help_menu_sections.reports}\n\n` +
          `${t.help_menu_sections.footer}`;

        await this.evolutionClient.sendTextMessage(remoteJid, helpMessage);
      } else {
        await this.evolutionClient.sendTextMessage(remoteJid, t.error_generic);
      }
      return { status: 'unsupported_topic' };
    }

    if (intent.type === 'report') {
      await this.report.generateSummary(remoteJid, intent, lang);
      return { status: 'processed_report' };
    }

    if (intent.type === 'budget_inquiry') {
      await this.budget.checkBudget(remoteJid, lang);
      return { status: 'processed_budget_inquiry' };
    }

    if (intent.type === 'budget_update') {
      await this.budget.updateBudget(remoteJid, intent.amount, lang);
      return { status: 'processed_budget_update' };
    }

    if (intent.type === 'transaction') {
      await this.transaction.handleTransaction(remoteJid, intent, senderJid, lang);
      return { status: 'processed_transaction' };
    }

    return { status: 'ignored' };
  }

  async handleGroupUpsert(payload: EvolutionGroupUpsertPayload) {
    const instance = payload.instance;
    const groupData = payload.data?.[0];
    if (!groupData) return { status: 'no_data' };

    const { id: remoteJid, author, authorPn, subject } = groupData;
    const authorizingUser = author || authorPn;

    const whitelisted = (author && this.evolutionClient.isWhitelisted(author)) || (authorPn && this.evolutionClient.isWhitelisted(authorPn));
    
    const user = authorizingUser ? await this.db.query.users.findFirst({
      where: and(eq(users.whatsappNumber, authorizingUser), eq(users.isActive, true)),
    }) : null;

    if (!whitelisted && !user) {
      console.warn(`Unauthorized group registration attempt for ${remoteJid} ("${subject}") by ${authorizingUser}. Leaving group.`);
      await this.evolutionClient.leaveGroup(instance, remoteJid);
      return { status: 'left_unauthorized_group' };
    }

    // Record or Reactivate Group
    await this.db.insert(groups).values({
      jid: remoteJid,
      name: subject || 'Untitled Group',
      addedBy: authorizingUser || 'system',
      isActive: true,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: groups.jid,
      set: { 
        name: subject || 'Untitled Group',
        addedBy: authorizingUser, 
        isActive: true, 
        updatedAt: new Date() 
      }
    });

    console.log(`Registered group via upsert: ${remoteJid} authorized by ${authorizingUser}`);
    await this.sendGroupWelcomeMessage(remoteJid, 'id');
    
    return { status: 'group_registered' };
  }

  async handleGroupUpdate(payload: EvolutionGroupUpdatePayload) {
    const instance = payload.instance;
    const data = payload.data;
    const { action, author, id: remoteJid } = data;

    if (action === 'add') {
      const inviter = await this.db.query.users.findFirst({
        where: and(eq(users.whatsappNumber, author), eq(users.isActive, true)),
      });

      if (!inviter) {
        console.warn(`Unauthorized group join attempt in ${remoteJid} by ${author}`);
        await this.evolutionClient.leaveGroup(instance, remoteJid);
        return { status: 'left_unauthorized_group' };
      }

      // Record group membership
      await this.db.insert(groups).values({
        jid: remoteJid,
        addedBy: author,
        isActive: true,
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: groups.jid,
        set: { 
          addedBy: author, 
          isActive: true, 
          updatedAt: new Date() 
        }
      });

      await this.sendGroupWelcomeMessage(remoteJid);
      return { status: 'group_welcome_sent' };
    }

    if (action === 'remove' || action === 'leave') {
      const botJid = payload.sender;
      const isBotRemoved = data.participants.some((p: any) => p.phoneNumber === botJid);
      if (isBotRemoved) {
        await this.db.update(groups)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(groups.jid, data.id));
        console.log(`Bot removed from group: ${data.id}. Marked as inactive.`);
        return { status: 'group_inactive' };
      }
    }

    return { status: 'ignored' };
  }

  private async sendGroupWelcomeMessage(remoteJid: string, lang: Language = 'id') {
    const t = this.i18n.getT(lang);
    await this.evolutionClient.sendTextMessage(remoteJid, t.group_welcome);
  }
}


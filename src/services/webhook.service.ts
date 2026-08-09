import { users, groups } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { inferTimezoneFromPhone, isValidTimezone } from '@/lib/time';
import type { WahaClient } from '@/lib/waha';
import type { OnboardingService } from '@/services/onboarding.service';
import type { TransactionService } from '@/services/transaction.service';
import type { ReportService } from '@/services/report.service';
import type { BudgetService } from '@/services/budget.service';
import type { I18nService } from '@/services/i18n.service';
import type { Db } from '@/db/index';
import type {
  WahaWebhookEnvelope,
  WahaMessagePayload,
  WahaGroupJoinPayload,
  WahaGroupLeavePayload,
  WahaGroupParticipantsPayload,
  WahaPollVotePayload,
  Language,
  User,
  Env,
} from '@/types';
import type { AiClient } from '@/lib/ai';

export class WebhookService {
  constructor(
    private db: Db,
    private i18n: I18nService,
    private onboarding: OnboardingService,
    private transaction: TransactionService,
    private budget: BudgetService,
    private report: ReportService,
    private evolutionClient: WahaClient,
    private aiClient: AiClient,
    private env: Env
  ) {}

  async handleWebhook(envelope: WahaWebhookEnvelope) {
    switch (envelope.event) {
      case 'message':
        return this.handleMessage(envelope);
      case 'poll.vote':
        return this.handlePollVote(envelope);
      case 'group.v2.join':
        return this.handleGroupJoin(envelope);
      case 'group.v2.leave':
        return this.handleGroupLeave(envelope);
      case 'group.v2.participants':
        return this.handleGroupParticipants(envelope);
      default:
        return { status: 'ignored' };
    }
  }

  private async handleMessage(envelope: WahaWebhookEnvelope) {
    const payload = envelope.payload as WahaMessagePayload;
    if (!payload || payload.fromMe) {
      return { status: 'ignored' };
    }
    const rawFrom = payload.from;
    const rawSender = payload.participant || payload.from;
    const isGroup = rawFrom.endsWith('@g.us');

    const remoteJid = isGroup ? rawFrom : await this.evolutionClient.resolvePhoneJid(rawFrom);
    const senderJid = isGroup
      ? await this.evolutionClient.resolvePhoneJid(rawSender)
      : remoteJid;

    // Whitelist check: required for personal chats, skipped for groups or if OPEN_FOR_PUBLIC is true
    const isOpenForPublic = this.env.OPEN_FOR_PUBLIC === 'true';
    if (!isGroup && !isOpenForPublic) {
      if (!(await this.evolutionClient.isWhitelisted(senderJid))) {
        return { status: 'not_whitelisted' };
      }
    }

    const messageText = this.evolutionClient.extractMessageText(envelope);
    console.log('Received message:', { remoteJid, senderJid, messageText });

    if (!messageText) return { status: 'no_text' };

    const user: User | undefined = await this.db.query.users.findFirst({
      where: eq(users.whatsappNumber, senderJid),
    });

    const timezone = user?.timezone ?? inferTimezoneFromPhone(senderJid);

    const timezoneCommand = this.parseTimezoneCommand(messageText);
    if (timezoneCommand) {
      return this.handleTimezoneCommand(remoteJid, senderJid, timezoneCommand, (user?.language as Language) ?? 'id');
    }

    const menuMatch = this.matchMenuOption(messageText);
    if (menuMatch) {
      const lang: Language = user?.language ? (user.language as Language) : this.detectLanguage(messageText);
      const action = await this.routeMenuOption(menuMatch, remoteJid, lang, timezone);
      return { status: 'processed_menu_option', action };
    }

    const intent = await this.aiClient.extractIntent(messageText, timezone);

    console.log('Intent:', intent);

    const lang = intent.detectedLanguage;

    if (!isGroup && user && user.language !== lang) {
      await this.db.update(users)
        .set({ language: lang })
        .where(eq(users.whatsappNumber, senderJid));
      user.language = lang;
    }

    const t = this.i18n.getT(lang);

    if (!isGroup) {
      if (!user) {
        await this.onboarding.startOnboarding(remoteJid, lang, timezone);
        return { status: 'onboarding_started' };
      }

      if (user.onboardingStep !== 'completed') {
        await this.onboarding.handleOnboarding(remoteJid, messageText, user, lang);
        return { status: 'onboarding_continue' };
      }
    }

    if ('error' in intent) {
      if (intent.error === 'unsupported_topic') {
        await this.sendHelpMenu(remoteJid, lang);
      } else {
        await this.evolutionClient.sendTextMessage(remoteJid, t.error_generic);
      }
      return { status: 'unsupported_topic' };
    }

    if (intent.type === 'report') {
      await this.report.generateSummary(remoteJid, intent, lang, timezone);
      return { status: 'processed_report' };
    }

    if (intent.type === 'budget_inquiry') {
      await this.budget.checkBudget(remoteJid, lang, timezone);
      return { status: 'processed_budget_inquiry' };
    }

    if (intent.type === 'budget_update') {
      await this.budget.updateBudget(remoteJid, intent.amount, lang);
      return { status: 'processed_budget_update' };
    }

    if (intent.type === 'transaction') {
      await this.transaction.handleTransaction(remoteJid, intent, senderJid, lang, payload.pushName);
      return { status: 'processed_transaction' };
    }

    return { status: 'ignored' };
  }

  private async handleGroupJoin(envelope: WahaWebhookEnvelope) {
    const payload = envelope.payload as WahaGroupJoinPayload;
    const groupData = payload?.group;
    if (!groupData) return { status: 'no_data' };

    const { id: remoteJid, subject } = groupData;

    // Determine who added the bot: WAHA join event doesn't expose the adder,
    // so check participants against whitelist / active users.
    const participants = groupData.participants || [];
    const authorizedParticipant = (await Promise.all(
      participants.map(async (p) => ({
        p,
        ok: await this.evolutionClient.isWhitelisted(p.id),
      }))
    )).find((r) => r.ok)?.p;

    const activeUser = authorizedParticipant
      ? await this.db.query.users.findFirst({
          where: and(eq(users.whatsappNumber, authorizedParticipant.id), eq(users.isActive, true)),
        })
      : null;

    if (!authorizedParticipant && !activeUser) {
      console.warn(`Unauthorized group registration attempt for ${remoteJid} ("${subject}"). Leaving group.`);
      await this.evolutionClient.leaveGroup(remoteJid);
      return { status: 'left_unauthorized_group' };
    }

    await this.db.insert(groups).values({
      jid: remoteJid,
      name: subject || 'Untitled Group',
      addedBy: authorizedParticipant?.id || activeUser?.whatsappNumber || 'system',
      isActive: true,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: groups.jid,
      set: {
        name: subject || 'Untitled Group',
        addedBy: authorizedParticipant?.id || activeUser?.whatsappNumber,
        isActive: true,
        updatedAt: new Date(),
      },
    });

    console.log(`Registered group via join: ${remoteJid}`);
    await this.sendGroupWelcomeMessage(remoteJid, 'id');

    return { status: 'group_registered' };
  }

  private async handleGroupLeave(envelope: WahaWebhookEnvelope) {
    const payload = envelope.payload as WahaGroupLeavePayload;
    const remoteJid = payload?.group?.id;
    if (!remoteJid) return { status: 'no_data' };

    await this.db.update(groups)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(groups.jid, remoteJid));
    console.log(`Bot left group: ${remoteJid}. Marked as inactive.`);
    return { status: 'group_inactive' };
  }

  private async handleGroupParticipants(envelope: WahaWebhookEnvelope) {
    const payload = envelope.payload as WahaGroupParticipantsPayload;
    if (!payload?.group?.id) return { status: 'no_data' };
    const remoteJid = payload.group.id;

    if (payload.type === 'join') {
      await this.sendGroupWelcomeMessage(remoteJid);
      return { status: 'group_welcome_sent' };
    }

    return { status: 'ignored' };
  }

  private async sendGroupWelcomeMessage(remoteJid: string, lang: Language = 'id') {
    const t = this.i18n.getT(lang);
    await this.evolutionClient.sendTextMessage(remoteJid, t.group_welcome);
  }

  private async sendHelpMenu(remoteJid: string, lang: Language) {
    const t = this.i18n.getT(lang);

    const options = [
      { label: t.menu_report_today, rowId: 'report_today', optionText: t.menu_report_today.replace(/^\S+\s/, '') },
      { label: t.menu_report_week, rowId: 'report_week', optionText: t.menu_report_week.replace(/^\S+\s/, '') },
      { label: t.menu_report_month, rowId: 'report_month', optionText: t.menu_report_month.replace(/^\S+\s/, '') },
      { label: t.menu_budget, rowId: 'budget', optionText: t.menu_budget.replace(/^\S+\s/, '') },
      { label: t.menu_logging, rowId: 'logging', optionText: t.menu_logging.replace(/^\S+\s/, '') },
    ];

    const intro = `${t.help_menu_title}\n\n${t.help_menu_unsupported}`;

    const listResult = await this.evolutionClient.sendList(remoteJid, {
      title: t.help_menu_title.replace(/\*/g, ''),
      description: t.help_menu_unsupported,
      footer: t.help_footer,
      button: t.menu_button,
      sections: [
        {
          title: t.menu_section,
          rows: options.map((o) => ({ title: o.label, rowId: o.rowId, description: null })),
        },
      ],
    }) as Record<string, any> | null;

    const listOk = listResult && !listResult['error'] && !listResult['message']?.['error'];

    if (!listOk) {
      console.log('sendList failed, falling back to poll:', listResult);
      const pollResult = await this.evolutionClient.sendPoll(
        remoteJid,
        `${intro}\n\n${t.help_footer}`,
        options.map((o) => o.optionText)
      ) as Record<string, any> | null;
      const pollOk = pollResult && !pollResult['error'];
      if (!pollOk) {
        console.log('sendPoll failed, falling back to text:', pollResult);
        await this.evolutionClient.sendTextMessage(
          remoteJid,
          `${intro}\n\n` +
          `${t.help_menu_sections.logging}\n\n` +
          `${t.help_menu_sections.reports}\n\n` +
          `${t.help_menu_sections.footer}`
        );
      }
    }
  }

  private async handlePollVote(envelope: WahaWebhookEnvelope) {
    const payload = envelope.payload as WahaPollVotePayload;
    const vote = payload?.vote;
    const poll = payload?.poll;
    if (!vote || !poll || !poll.fromMe) {
      return { status: 'ignored' };
    }

    const selected = vote.selectedOptions?.[0];
    if (!selected) {
      return { status: 'no_selection' };
    }

    const remoteJid = poll.to;
    const senderJid = await this.evolutionClient.resolvePhoneJid(vote.from);

    const user: User | undefined = await this.db.query.users.findFirst({
      where: eq(users.whatsappNumber, senderJid),
    });
    const timezone = user?.timezone ?? inferTimezoneFromPhone(senderJid);
    const lang: Language = user?.language ? (user.language as Language) : 'id';

    const action = await this.routeMenuOption(selected, remoteJid, lang, timezone);
    return { status: 'processed_poll_vote', action };
  }

  private matchMenuOption(messageText: string): string | null {
    const norm = messageText.trim().toLowerCase();
    const idLabels = [
      'laporan hari ini', 'laporan minggu ini', 'laporan bulan ini',
      'cek budget', 'cara catat transaksi', 'cara catat',
    ];
    const enLabels = [
      'today\'s report', 'this week\'s report', 'this month\'s report',
      'check budget', 'how to log',
    ];
    const all = [...idLabels, ...enLabels];
    const found = all.find((l) => norm.includes(l) || l.includes(norm));
    if (!found) return null;

    if (found.includes('hari ini') || found.includes('today')) return 'Laporan Hari Ini';
    if (found.includes('minggu') || found.includes('week')) return 'Laporan Minggu Ini';
    if (found.includes('bulan') || found.includes('month')) return 'Laporan Bulan Ini';
    if (found.includes('budget')) return 'Cek Budget';
    return 'Cara Catat Transaksi';
  }

  private async routeMenuOption(selected: string, remoteJid: string, lang: Language, timezone: string) {
    const t = this.i18n.getT(lang);
    const norm = selected.toLowerCase();

    if (norm.includes('laporan') || norm.includes('report') || norm.includes('pengeluaran') || norm.includes('expense')) {
      let period: 'today' | 'week' | 'month' = 'today';
      if (norm.includes('minggu') || norm.includes('week')) period = 'week';
      else if (norm.includes('bulan') || norm.includes('month')) period = 'month';
      await this.report.generateSummary(remoteJid, { period }, lang, timezone);
      return `report_${period}`;
    }

    if (norm.includes('budget')) {
      await this.budget.checkBudget(remoteJid, lang, timezone);
      return 'budget';
    }

    if (norm.includes('cara') || norm.includes('how to') || norm.includes('catat') || norm.includes('log')) {
      await this.evolutionClient.sendTextMessage(
        remoteJid,
        `${t.help_menu_title}\n\n${t.help_menu_sections.logging}`
      );
      return 'logging';
    }

    return 'unknown';
  }

  private detectLanguage(messageText: string): Language {
    const indonesianWords = /\b(pengeluaran|pemasukan|budget|makan|makanan|minum|belanja|transport|gaji|laporan|hari ini|minggu|bulan|tahun|kemarin)\b/i;
    if (indonesianWords.test(messageText)) return 'id';
    return 'en';
  }

  private parseTimezoneCommand(messageText: string): string | null {
    const trimmed = messageText.trim().toLowerCase();
    const match = trimmed.match(/(?:^|\/)(?:set|change|ganti|atur)\s+(?:timezone|zona waktu|waktu)\s+([a-z_\/\+\-0-9]+)/) ||
      trimmed.match(/^timezone\s+([a-z_\/\+\-0-9]+)/);
    if (!match) return null;
    const candidate = match[1]!;
    return isValidTimezone(candidate) ? candidate : null;
  }

  private async handleTimezoneCommand(remoteJid: string, senderJid: string, timezone: string, _lang: Language) {
    const existing = await this.db.query.users.findFirst({
      where: eq(users.whatsappNumber, senderJid),
    });

    if (existing) {
      await this.db.update(users)
        .set({ timezone })
        .where(eq(users.whatsappNumber, senderJid));
    } else {
      await this.db.insert(users).values({
        whatsappNumber: senderJid,
        timezone,
        onboardingStep: 'completed',
        isActive: true,
      });
    }

    await this.evolutionClient.sendTextMessage(remoteJid, `✅ Timezone set to *${timezone}*`);
    return { status: 'timezone_updated', timezone };
  }
}

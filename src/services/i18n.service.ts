import id from '@/translations/id.json' with { type: 'json' };
import en from '@/translations/en.json' with { type: 'json' };

import type { Language } from '@/types';

export class I18nService {
  private dictionaries: Record<Language, any> = { id, en };

  getT(lang: Language = 'id') {
    const dict = this.dictionaries[lang] || this.dictionaries['id'];

    return {
      ...dict,
      onboarding_budget_prompt: (name: string) => dict.onboarding_budget_prompt.replace('{{name}}', name),
      onboarding_completed: (name: string) => dict.onboarding_completed.replace('{{name}}', name),
      budget_update_success: (amount: string) => dict.budget_update_success.replace('{{amount}}', amount),
      report_title: (period: string) => dict.report_title.replace('{{period}}', period),
      transaction_success: (type: string, amount: string, category: string) => 
        dict.transaction_success
          .replace('{{type}}', type === 'income' ? (lang === 'id' ? 'Pemasukan' : 'Income') : (lang === 'id' ? 'Pengeluaran' : 'Expense'))
          .replace('{{amount}}', amount)
          .replace('{{category}}', category),
      
      // Help sections (flattened in JSON)
      help_menu_sections: {
        logging: dict.help_logging,
        reports: dict.help_reports,
        footer: dict.help_footer
      },
      group_welcome: dict.group_welcome,
      
      // Budget & Errors
      budget_status_encouragement: dict.budget_status_encouragement,
      budget_update_footer: dict.budget_update_footer,
      error_budget_parse: dict.error_budget_parse,
      report_oldest_hint: dict.report_oldest_hint,
  
      // Label conversion helper
      label: (key: string) => dict[`label_${key}`] || key
    };
  }
}


import { useI18n } from '../lib/i18n';
import type { Group, Scope } from '../lib/api';

interface ScopeSelectorProps {
  groups: Group[];
  scope: Scope;
  onScopeChange: (scope: Scope) => void;
}

export default function ScopeSelector({ groups, scope, onScopeChange }: ScopeSelectorProps) {
  const { t } = useI18n();
  if (groups.length === 0) return null;
  const value = scope.scope === 'group' ? scope.group.jid : 'personal';
  return (
    <select
      className="scope-select"
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        if (v === 'personal') {
          onScopeChange({ scope: 'personal' });
        } else {
          const group = groups.find((g) => g.jid === v);
          if (group) onScopeChange({ scope: 'group', group });
        }
      }}
      aria-label={t('scopeLabel')}
    >
      <option value="personal">{t('scopePersonal')}</option>
      {groups.map((g) => (
        <option key={g.jid} value={g.jid}>
          {g.name}
        </option>
      ))}
    </select>
  );
}

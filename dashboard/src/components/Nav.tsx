import Icon from './Icon';
import { useI18n } from '../lib/i18n';

interface NavProps {
  route: string;
  onNavigate: (to: string) => void;
  onToggleLanguage: () => void;
  onLogout: () => void;
}

export default function Nav({ route, onNavigate, onToggleLanguage, onLogout }: NavProps) {
  const { t, lang } = useI18n();
  return (
    <nav className="nav">
      <div className="nav-inner">
        <div className="logo" role="button" tabIndex={0} onClick={() => onNavigate('/')}
             onKeyDown={(e) => { if (e.key === 'Enter') onNavigate('/'); }}>
          <span className="logo-mark"><Icon name="balance" size={16} /></span>
          <span>Expense Tracker</span>
        </div>
        <div className="nav-links">
          <button
            className={route === '/' ? 'nav-link active' : 'nav-link'}
            onClick={() => onNavigate('/')}
          >
            {t('overview')}
          </button>
          <button
            className={route === '/transactions' ? 'nav-link active' : 'nav-link'}
            onClick={() => onNavigate('/transactions')}
          >
            {t('manageTransactions')}
          </button>
        </div>
        <div className="nav-actions">
          <button
            onClick={onToggleLanguage}
            className="nav-btn lang-toggle"
            aria-label={t('languageLabel')}
          >
            {lang === 'id' ? 'EN' : 'ID'}
          </button>
          <button onClick={onLogout} className="nav-btn">
            {t('logout')}
          </button>
        </div>
      </div>
    </nav>
  );
}

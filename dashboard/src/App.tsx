import { useEffect, useState } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Transactions from './components/Transactions';
import Nav from './components/Nav';
import { I18nProvider, useI18n, type Language } from './lib/i18n';
import { api, type MeResponse, clearToken, updateLanguage } from './lib/api';
import { navigate, useRoute } from './lib/router';

export default function App() {
  return (
    <I18nProvider>
      <AppInner />
    </I18nProvider>
  );
}

function AppInner() {
  const [session, setSession] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const { t, setLang } = useI18n();

  useEffect(() => {
    if (session) {
      setLang(session.language === 'id' ? 'id' : 'en');
    }
  }, [session, setLang]);

  useEffect(() => {
    const token = localStorage.getItem('expense_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api<MeResponse>('/auth/me')
      .then(setSession)
      .catch(() => {
        clearToken();
        setSession(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = (user: MeResponse) => {
    setSession(user);
  };

  const handleLogout = () => {
    clearToken();
    setSession(null);
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">{t('loading')}</p>
      </div>
    );
  }

  if (!session) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Shell
      session={session}
      onLogout={handleLogout}
      onLanguageChange={(lang: Language) => setSession((s) => (s ? { ...s, language: lang } : s))}
    />
  );
}

function Shell({
  session,
  onLogout,
  onLanguageChange,
}: {
  session: MeResponse;
  onLogout: () => void;
  onLanguageChange: (lang: Language) => void;
}) {
  const { t, lang, setLang } = useI18n();
  const route = useRoute();
  const [banner, setBanner] = useState('');

  const toggleLanguage = async () => {
    const next: Language = lang === 'id' ? 'en' : 'id';
    setBanner('');
    try {
      await updateLanguage(next);
      setLang(next);
      onLanguageChange(next);
    } catch {
      setBanner(t('errFailedToSave'));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav
        route={route}
        onNavigate={navigate}
        onToggleLanguage={toggleLanguage}
        onLogout={onLogout}
      />
      <main className="mx-auto px-4 py-8 max-w-5xl">
        {banner && (
          <div className="card" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c', marginBottom: 24 }}>
            {banner}
          </div>
        )}
        {route === '/transactions'
          ? <Transactions session={session} />
          : <Dashboard session={session} onNavigate={navigate} />}
      </main>
    </div>
  );
}

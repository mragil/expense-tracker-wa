import { useEffect, useState } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { I18nProvider, useI18n, type Language } from './lib/i18n';
import { api, type MeResponse, clearToken } from './lib/api';

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
  const { t } = useI18n();

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
    <Dashboard
      session={session}
      onLogout={() => { clearToken(); setSession(null); }}
      onLanguageChange={(lang: Language) => setSession((s) => (s ? { ...s, language: lang } : s))}
    />
  );
}

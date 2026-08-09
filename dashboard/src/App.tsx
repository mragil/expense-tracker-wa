import { useEffect, useState } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { api, type MeResponse, clearToken } from './lib/api';

export default function App() {
  const [session, setSession] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <Login onLogin={setSession} />;
  }

  return <Dashboard session={session} onLogout={() => { clearToken(); setSession(null); }} />;
}

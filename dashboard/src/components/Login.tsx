import { useState } from 'react';
import { api, setToken, type MeResponse, type VerifyResponse, type OtpResponse } from '../lib/api';

interface LoginProps {
  onLogin: (user: MeResponse) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState('');

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api<OtpResponse>('/auth/request-otp', {
        method: 'POST',
        body: { phone },
      });
      if (!res.ok) {
        setError(res.error === 'unknown_number' ? 'This WhatsApp number is not registered with ExpenseBot.' : 'Failed to send code. Try again.');
        return;
      }
      setStep('code');
      setInfo(`Code sent to ${phone}. Check your WhatsApp.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api<VerifyResponse>('/auth/verify', {
        method: 'POST',
        body: { phone, code },
      });
      if (!res.ok || !res.token) {
        const msg = res.error === 'invalid' || res.error === 'used'
          ? 'Invalid or already-used code.'
          : res.error === 'expired'
            ? 'Code expired. Request a new one.'
            : 'Verification failed.';
        setError(msg);
        return;
      }
      setToken(res.token!);
      const me = await api<MeResponse>('/auth/me');
      onLogin(me);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ padding: '0 16px' }}>
      <div className="card w-full max-w-md text-center">
        <div style={{ fontSize: 40 }} className="mb-4">💰</div>
        <h1 style={{ fontSize: 24 }} className="font-bold">Expense Tracker</h1>
        <p className="text-sm text-gray-500 mt-1">Sign in with your WhatsApp number</p>

        {step === 'phone' ? (
          <form onSubmit={handleRequest} style={{ textAlign: 'left', marginTop: 24 }}>
            <label className="text-sm font-medium text-gray-700 mb-2" style={{ display: 'block' }}>
              WhatsApp Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 081234567890"
              className="input"
              required
            />
            <p className="text-xs text-gray-400 mt-2">We'll send a one-time code to this number via WhatsApp.</p>
            {error && <p className="error">{error}</p>}
            {info && <p className="info">{info}</p>}
            <button type="submit" disabled={loading} className="btn-primary mt-4">
              {loading ? 'Sending...' : 'Send Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} style={{ textAlign: 'left', marginTop: 24 }}>
            <label className="text-sm font-medium text-gray-700 mb-2" style={{ display: 'block' }}>
              Enter the 6-digit code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              inputMode="numeric"
              maxLength={6}
              className="input"
              style={{ textAlign: 'center', fontSize: 20, letterSpacing: 8 }}
              required
            />
            {info && <p className="info">{info}</p>}
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary mt-4">
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('phone'); setCode(''); setError(''); setInfo(''); }}
              className="mt-4"
              style={{ width: '100%', fontSize: 14, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ← Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

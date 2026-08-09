import { useState } from 'react';
import { api, setToken, type MeResponse, type VerifyResponse, type OtpResponse } from '../lib/api';
import { useI18n } from '../lib/i18n';

interface LoginProps {
  onLogin: (user: MeResponse) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const { t, lang, setLang } = useI18n();
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
        setError(res.error === 'unknown_number' ? t('errUnknownNumber')
          : res.error === 'rate_limited' ? t('errRateLimited')
          : t('errSendFailed'));
        return;
      }
      setStep('code');
      setInfo(t('codeSent', { phone }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errSendFailed'));
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
          ? t('errInvalidCode')
          : res.error === 'expired'
            ? t('errCodeExpired')
            : res.error === 'rate_limited'
              ? t('errTooManyAttempts')
              : t('errVerifyFailed');
        setError(msg);
        return;
      }
      setToken(res.token!);
      const me = await api<MeResponse>('/auth/me');
      onLogin(me);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errVerifyFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ padding: '0 16px' }}>
      <div className="card w-full max-w-md text-center" style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setLang(lang === 'id' ? 'en' : 'id')}
          className="lang-toggle"
          aria-label={t('languageLabel')}
        >
          {lang === 'id' ? 'EN' : 'ID'}
        </button>
        <div style={{ fontSize: 40 }} className="mb-4">💰</div>
        <h1 style={{ fontSize: 24 }} className="font-bold">{t('appTitle')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('signInSubtitle')}</p>

        {step === 'phone' ? (
          <form onSubmit={handleRequest} style={{ textAlign: 'left', marginTop: 24 }}>
            <label className="text-sm font-medium text-gray-700 mb-2" style={{ display: 'block' }}>
              {t('whatsappNumber')}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('phonePlaceholder')}
              className="input"
              required
            />
            <p className="text-xs text-gray-400 mt-2">{t('otpHint')}</p>
            {error && <p className="error">{error}</p>}
            {info && <p className="info">{info}</p>}
            <button type="submit" disabled={loading} className="btn-primary mt-4">
              {loading ? t('sending') : t('sendCode')}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} style={{ textAlign: 'left', marginTop: 24 }}>
            <label className="text-sm font-medium text-gray-700 mb-2" style={{ display: 'block' }}>
              {t('enterCode')}
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
              {loading ? t('verifying') : t('verifySignIn')}
            </button>
            <button
              type="button"
              onClick={() => { setStep('phone'); setCode(''); setError(''); setInfo(''); }}
              className="mt-4"
              style={{ width: '100%', fontSize: 14, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {t('back')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

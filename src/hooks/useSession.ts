import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { BannerState, SessionUser, ToastState } from '../types';
import { changePin, login as loginApi, logout as logoutApi, me } from '../lib/api';
import { normalizeDocument, readJson, removeItem, SESSION_KEY, writeJson } from '../lib/persistence';

export function useSession() {
  const [session, setSession] = useState<SessionUser | null>(() => readJson<SessionUser | null>(SESSION_KEY, null));
  const [loginDocument, setLoginDocument] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinDraft, setPinDraft] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => readJson<'dark' | 'light'>('transporter:theme', 'dark'));
  const [patientFontLarge, setPatientFontLarge] = useState(() => readJson<boolean>('transporter:patient-font', false));

  useEffect(() => {
    writeJson(SESSION_KEY, session);
  }, [session]);

  useEffect(() => {
    writeJson('transporter:patient-font', patientFontLarge);
  }, [patientFontLarge]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = themeMode;
    }
    writeJson('transporter:theme', themeMode);
  }, [themeMode]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        if (!session?.token) {
          setLoading(false);
          return;
        }

        const sessionResult = await me(session.token);
        if (cancelled) return;

        if (sessionResult.session) {
          setSession({ ...sessionResult.session, token: session.token });
        }
      } catch {
        if (!cancelled) {
          setSession(null);
          removeItem(SESSION_KEY);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const showBanner = useCallback((type: BannerState['type'], message: string) => {
    setBanner({ type, message });
    window.setTimeout(() => {
      setBanner((current) => (current?.message === message ? null : current));
    }, 6500);
  }, []);

  const pushToast = useCallback((type: ToastState['type'], message: string) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  const handleLogin = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setLoginError('');
      setBanner(null);

      try {
        const response = await loginApi(normalizeDocument(loginDocument), loginPin);
        if (!response.session) {
          throw new Error('Resposta de login inválida.');
        }

        const nextSession: SessionUser = {
          name: response.session.name ?? '',
          document: response.session.document ?? '',
          role: response.session.role as SessionUser['role'],
          mustChangePin: Boolean(response.session.mustChangePin),
          token: response.session.token ?? ''
        };

        setSession(nextSession);
        writeJson(SESSION_KEY, nextSession);
        setLoginPin('');
        setPinDraft('');
        setPinConfirm('');
      } catch (error) {
        setLoginError(error instanceof Error ? error.message : 'Falha ao entrar.');
      }
    },
    [loginDocument, loginPin]
  );

  const handleChangePin = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!session?.token) return;

      if (pinDraft.length < 4 || pinDraft !== pinConfirm) {
        showBanner('error', 'O novo PIN precisa ter ao menos 4 dígitos e deve ser confirmado.');
        return;
      }

      try {
        await changePin(session.token, pinDraft);
        const nextSession = { ...session, mustChangePin: false };
        setSession(nextSession);
        writeJson(SESSION_KEY, nextSession);
        setPinDraft('');
        setPinConfirm('');
        pushToast('success', 'PIN atualizado com sucesso.');
      } catch (error) {
        showBanner('error', error instanceof Error ? error.message : 'Não foi possível alterar o PIN.');
      }
    },
    [session, pinConfirm, pinDraft, pushToast, showBanner]
  );

  const handleLogout = useCallback(async () => {
    if (session?.token) {
      await logoutApi(session.token).catch(() => undefined);
    }

    setSession(null);
    removeItem(SESSION_KEY);
  }, [session]);

  return {
    session,
    setSession,
    loginDocument,
    setLoginDocument,
    loginPin,
    setLoginPin,
    loginError,
    setLoginError,
    banner,
    toasts,
    loading,
    pinDraft,
    setPinDraft,
    pinConfirm,
    setPinConfirm,
    themeMode,
    setThemeMode,
    patientFontLarge,
    setPatientFontLarge,
    showBanner,
    pushToast,
    handleLogin,
    handleChangePin,
    handleLogout
  };
}

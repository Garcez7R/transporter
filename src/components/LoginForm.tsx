import type { FormEvent } from 'react';
import type { AccessRole, BannerState, SessionUser } from '../types';
import type { DemoUser } from '../types';

type LoginFormProps = {
  loginDocument: string;
  loginPin: string;
  loginError: string;
  themeMode: 'dark' | 'light';
  patientFontLarge: boolean;
  demoUsers: DemoUser[];
  roleLabels: Record<AccessRole, string>;
  handleLogin: (event: FormEvent<HTMLFormElement>) => void;
  setLoginDocument: (value: string) => void;
  setLoginPin: (value: string) => void;
  toggleTheme: () => void;
  toggleFontSize: () => void;
  dashboardTitle: string;
  roleDescription: string;
};

export function LoginForm({
  loginDocument,
  loginPin,
  loginError,
  themeMode,
  patientFontLarge,
  demoUsers,
  roleLabels,
  handleLogin,
  setLoginDocument,
  setLoginPin,
  toggleTheme,
  toggleFontSize,
  dashboardTitle,
  roleDescription
}: LoginFormProps) {
  return (
    <main className="content-panel login-panel">
      <div className="login-hero">
        <div className="brand-lockup">
          <span className="brand-mark">T</span>
          <div>
            <p className="eyebrow">Transporter</p>
            <h1>Portal do paciente</h1>
          </div>
        </div>
      </div>

      <header className="topbar topbar-v2">
        <div>
          <p className="eyebrow">Acesso seguro</p>
          <h2>Entre com CPF e PIN</h2>
        </div>
        <div className="topbar-actions">
          <button className="cta ghost" type="button" onClick={toggleTheme}>
            {themeMode === 'dark' ? 'Modo claro' : 'Modo escuro'}
          </button>
          <button className="cta ghost font-toggle" type="button" onClick={toggleFontSize}>
            {patientFontLarge ? 'Fonte normal' : 'Fonte maior'}
          </button>
          <div className="topbar-note">
            <strong>PIN inicial</strong>
            <span>0000</span>
          </div>
        </div>
      </header>

      <section className="glass-card login-card login-card-v2 patient-access">
        <div className="section-head">
          <h3>{dashboardTitle}</h3>
          <p>{roleDescription}</p>
        </div>

        <form className="login-form" onSubmit={handleLogin}>
          <label>
            <span>CPF</span>
            <input value={loginDocument} onChange={(event) => setLoginDocument(event.target.value)} placeholder="Digite o CPF" />
          </label>
          <label>
            <span>PIN</span>
            <input
              value={loginPin}
              onChange={(event) => setLoginPin(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              type="password"
              inputMode="numeric"
              placeholder="****"
            />
          </label>
          {loginError ? <p className="form-error">{loginError}</p> : null}
          <button className="cta" type="submit">
            Entrar
          </button>
        </form>

        <div className="demo-access">
          <p className="eyebrow">Acessos de demonstração</p>
          <div className="demo-grid">
            {demoUsers.map((account) => (
              <button
                key={account.role}
                className="demo-card"
                type="button"
                onClick={() => {
                  setLoginDocument(account.document);
                  setLoginPin(account.pin);
                }}
              >
                <strong>{account.name}</strong>
                <span>{roleLabels[account.role]}</span>
                <small>PIN inicial 0000</small>
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

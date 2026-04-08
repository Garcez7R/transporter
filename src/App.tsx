import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { activeTrips, demoUsers, fleet, flowSteps, profiles, defaultRequestForm } from './data';
import { changePin, createRequest, listRequests, login as loginApi, logout as logoutApi, me, updateRequest } from './lib/api';
import { formatDocument, normalizeDocument, readJson, removeItem, SESSION_KEY, currentStamp, writeJson } from './lib/persistence';
import type { AccessRole, RequestFormState, RequestStatus, SessionUser, TripRequest } from './types';

type RequestPatch = Partial<
  Pick<
    TripRequest,
    | 'status'
    | 'driver'
    | 'vehicle'
    | 'notes'
    | 'companions'
    | 'arrivalEta'
    | 'boardingPoint'
    | 'departureAt'
    | 'phoneVisible'
    | 'clientConfirmedAt'
    | 'pinStatus'
  >
> & {
  message?: string;
};

const roleLabels: Record<AccessRole, string> = {
  cliente: 'Cliente',
  operador: 'Operador',
  gerente: 'Gerente',
  motorista: 'Motorista',
  administrador: 'Administrador'
};

const roleDescriptions: Record<AccessRole, string> = {
  cliente: 'Portal de consulta com CPF/CNPJ + PIN.',
  operador: 'Cadastro, triagem e histórico das solicitações de transporte de pacientes.',
  gerente: 'Distribuição da frota e controle operacional da agenda pública.',
  motorista: 'Agenda mobile otimizada para o serviço de transporte.',
  administrador: 'Governança global e acesso irrestrito.'
};

function App() {
  const [session, setSession] = useState<SessionUser | null>(() => readJson<SessionUser | null>(SESSION_KEY, null));
  const [requests, setRequests] = useState<TripRequest[]>([]);
  const [loginDocument, setLoginDocument] = useState('');
  const [loginPin, setLoginPin] = useState('0000');
  const [loginError, setLoginError] = useState('');
  const [appError, setAppError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pinDraft, setPinDraft] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [activeRequestId, setActiveRequestId] = useState('');
  const [requestFilter, setRequestFilter] = useState('');
  const [requestForm, setRequestForm] = useState<RequestFormState>(defaultRequestForm);
  const [messageDraft, setMessageDraft] = useState('');
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    writeJson(SESSION_KEY, session);
  }, [session]);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

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

        await refreshRequests(session.token);
      } catch {
        if (!cancelled) {
          setSession(null);
          removeItem(SESSION_KEY);
          setRequests([]);
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

  useEffect(() => {
    if (!session?.token) return;

    let cancelled = false;
    refreshRequests(session.token).catch(() => {
      if (!cancelled) setAppError('Não foi possível carregar as solicitações.');
    });

    return () => {
      cancelled = true;
    };
  }, [session?.token, session?.role]);

  useEffect(() => {
    if (!requests.length) {
      setActiveRequestId('');
      return;
    }

    const visible = filteredRequests(requests, session, requestFilter);
    if (!visible.some((request) => request.id === activeRequestId)) {
      setActiveRequestId(visible[0]?.id ?? '');
    }
  }, [requests, session, requestFilter, activeRequestId]);

  const visibleRequests = useMemo(
    () => filteredRequests(requests, session, requestFilter),
    [requests, session, requestFilter]
  );
  const activeRequest = visibleRequests.find((request) => request.id === activeRequestId) ?? visibleRequests[0] ?? null;

  async function refreshRequests(token = session?.token) {
    if (!token) {
      setRequests([]);
      return;
    }

    const response = await listRequests(token);
    setRequests(response.rows ?? []);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError('');
    setAppError('');

    try {
      const response = await loginApi(normalizeDocument(loginDocument), loginPin);
      if (!response.session) {
        throw new Error('Resposta de login inválida.');
      }

      const nextSession: SessionUser = {
        name: response.session.name ?? '',
        document: response.session.document ?? '',
        role: response.session.role as AccessRole,
        mustChangePin: Boolean(response.session.mustChangePin),
        token: response.session.token ?? ''
      };

      setSession(nextSession);
      writeJson(SESSION_KEY, nextSession);
      setLoginPin('0000');
      setPinDraft('');
      setPinConfirm('');
      await refreshRequests(nextSession.token);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Falha ao entrar.');
    }
  }

  async function handleChangePin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.token) return;

    if (pinDraft.length < 4 || pinDraft !== pinConfirm) {
      setAppError('O novo PIN precisa ter ao menos 4 dígitos e deve ser confirmado.');
      return;
    }

    try {
      await changePin(session.token, pinDraft);
      const nextSession = { ...session, mustChangePin: false };
      setSession(nextSession);
      writeJson(SESSION_KEY, nextSession);
      setPinDraft('');
      setPinConfirm('');
      await refreshRequests(session.token);
    } catch (error) {
      setAppError(error instanceof Error ? error.message : 'Não foi possível alterar o PIN.');
    }
  }

  async function handleLogout() {
    if (session?.token) {
      await logoutApi(session.token).catch(() => undefined);
    }

    setSession(null);
    removeItem(SESSION_KEY);
    setRequests([]);
    setActiveRequestId('');
  }

  async function handleCreateRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.token || session.role !== 'operador') return;

    try {
      const response = await createRequest(requestForm, session.token);
      const createdId = response.row && 'id' in response.row ? String(response.row.id) : '';
      setRequestForm(defaultRequestForm);
      await refreshRequests(session.token);
      if (createdId) setActiveRequestId(createdId);
    } catch (error) {
      setAppError(error instanceof Error ? error.message : 'Não foi possível criar a solicitação.');
    }
  }

  async function patchRequest(id: string, patch: RequestPatch) {
    if (!session?.token || !id) return;

    try {
      await updateRequest(id, patch, session.token);
      await refreshRequests(session.token);
    } catch (error) {
      setAppError(error instanceof Error ? error.message : 'Não foi possível atualizar a solicitação.');
    }
  }

  async function handleSendMessage() {
    if (!activeRequest || !messageDraft.trim()) return;
    await patchRequest(activeRequest.id, { message: messageDraft.trim() });
    setMessageDraft('');
  }

  async function handleConfirmRead() {
    if (!activeRequest) return;
    await patchRequest(activeRequest.id, {
      clientConfirmedAt: currentStamp(),
      status: 'agendada'
    });
  }

  async function handleResetClientPin() {
    if (!activeRequest) return;
    await patchRequest(activeRequest.id, { pinStatus: 'reset' });
  }

  const operationalSignals = [
    { label: 'Solicitações ativas', value: String(requests.length) },
    { label: 'Em distribuição', value: String(requests.filter((item) => item.status === 'aguardando_distribuicao').length) },
    { label: 'Mensagens novas', value: String(requests.reduce((total, request) => total + request.messages.length, 0)) },
    { label: 'PIN inicial', value: '0000' },
    { label: 'PWA', value: isStandalone ? 'Instalado' : 'Pronto' }
  ];

  async function handleInstallApp() {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice.catch(() => undefined);
    setInstallPrompt(null);
  }

  const dashboardTitle = session ? `${roleLabels[session.role]} em operação` : 'Portal de acesso';

  if (loading) {
    return (
      <div className="app-shell">
        <aside className="hero-panel">
          <div className="brand-lockup">
            <span className="brand-mark">T</span>
            <div>
              <p className="eyebrow">Transporter</p>
              <h1>Carregando operação...</h1>
            </div>
          </div>
        </aside>
        <main className="content-panel">
          <section className="glass-card">Aguarde um instante.</section>
        </main>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app-shell auth-shell">
        <aside className="hero-panel">
          <div className="brand-lockup">
            <span className="brand-mark">T</span>
            <div>
              <p className="eyebrow">Transporter</p>
              <h1>Operação de transporte de pacientes com rastreabilidade, ritmo e clareza.</h1>
            </div>
          </div>

          <p className="hero-copy">
            Plataforma web com suporte a PWA para coordenar solicitações, distribuir viagens,
            reduzir ruído operacional e oferecer ao cliente, ao motorista e à gerência uma visão
            única da agenda de transporte público de pacientes.
          </p>

          <div className="hero-stats">
            <div>
              <strong>5 perfis</strong>
              <span>acesso por responsabilidade</span>
            </div>
            <div>
              <strong>D1 + Workers</strong>
              <span>stack enxuta e escalável</span>
            </div>
            <div>
              <strong>PWA mobile</strong>
              <span>portal pronto para celular</span>
            </div>
          </div>

          <section className="glass-card">
            <div className="section-head">
              <p className="eyebrow">Fluxo ideal</p>
              <h2>Da solicitação à viagem concluída</h2>
            </div>
            <ol className="timeline">
              {flowSteps.map((step, index) => (
                <li key={step}>
                  <span>{index + 1}</span>
                  <p>{step}</p>
                </li>
              ))}
            </ol>
          </section>
        </aside>

        <main className="content-panel login-panel">
          <header className="topbar">
            <div>
              <p className="eyebrow">Acesso seguro</p>
              <h2>Entre com documento e PIN</h2>
            </div>
          </header>

          <section className="glass-card login-card">
            <div className="section-head">
              <h3>{dashboardTitle}</h3>
              <p>{roleDescriptions.cliente}</p>
            </div>

            <form className="login-form" onSubmit={handleLogin}>
              <label>
                <span>CPF/CNPJ</span>
                <input
                  value={loginDocument}
                  onChange={(event) => setLoginDocument(formatDocument(event.target.value))}
                  placeholder="Digite o CPF ou CNPJ"
                />
              </label>
              <label>
                <span>PIN inicial</span>
                <input
                  value={loginPin}
                  onChange={(event) => setLoginPin(event.target.value)}
                  type="password"
                  inputMode="numeric"
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
                      setLoginDocument(formatDocument(account.document));
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
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="hero-panel">
        <div className="brand-lockup">
          <span className="brand-mark">T</span>
          <div>
            <p className="eyebrow">Transporter</p>
            <h1>{dashboardTitle}</h1>
          </div>
        </div>

        <p className="hero-copy">
          {roleDescriptions[session.role]} O acesso está vinculado ao documento {formatDocument(session.document)}.
        </p>

        <div className="hero-stats">
          <div>
            <strong>{roleLabels[session.role]}</strong>
            <span>{session.name}</span>
          </div>
          <div>
            <strong>{session.mustChangePin ? 'Troca pendente' : 'PIN atualizado'}</strong>
            <span>{session.mustChangePin ? 'Primeiro acesso com PIN 0000' : 'Acesso regular'}</span>
          </div>
          <div>
            <strong>{visibleRequests.length}</strong>
            <span>solicitações visíveis</span>
          </div>
        </div>

        <section className="glass-card">
          <div className="section-head">
            <p className="eyebrow">Sinais operacionais</p>
            <h2>Status rápido</h2>
          </div>
          <div className="signals">
            {operationalSignals.map((signal) => (
              <div key={signal.label}>
                <strong>{signal.value}</strong>
                <span>{signal.label}</span>
              </div>
            ))}
          </div>
          {!isStandalone ? (
            <button className="cta ghost install-cta" type="button" onClick={handleInstallApp} disabled={!installPrompt}>
              {installPrompt ? 'Instalar app' : 'Instalação disponível quando o navegador permitir'}
            </button>
          ) : null}
        </section>
      </aside>

      <main className="content-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Visão executiva</p>
            <h2>Central da Solicitação, frota e acessos</h2>
          </div>
          <button className="cta ghost" onClick={handleLogout} type="button">
            Sair
          </button>
        </header>

        {session.mustChangePin && (
          <section className="glass-card alert-card">
            <div className="section-head">
              <p className="eyebrow">Primeiro acesso</p>
              <h2>Troque seu PIN inicial</h2>
            </div>
            <form className="pin-form" onSubmit={handleChangePin}>
              <label>
                <span>Novo PIN</span>
                <input
                  value={pinDraft}
                  onChange={(event) => setPinDraft(event.target.value)}
                  type="password"
                  inputMode="numeric"
                  placeholder="Crie um PIN novo"
                />
              </label>
              <label>
                <span>Confirmar PIN</span>
                <input
                  value={pinConfirm}
                  onChange={(event) => setPinConfirm(event.target.value)}
                  type="password"
                  inputMode="numeric"
                  placeholder="Repita o PIN"
                />
              </label>
              <button className="cta" type="submit">
                Salvar novo PIN
              </button>
            </form>
          </section>
        )}

        {appError ? (
          <section className="glass-card alert-card">
            <p className="form-error">{appError}</p>
          </section>
        ) : null}

        <section className="grid profiles-grid">
          {profiles.map((profile) => (
            <article className={`glass-card profile-card ${session.role === profile.role ? 'profile-active' : ''}`} key={profile.role}>
              <div className="card-top">
                <span className="tag">{roleLabels[profile.role]}</span>
                <strong>{profile.count}</strong>
              </div>
              <h3>{profile.highlight}</h3>
              <p>{profile.description}</p>
            </article>
          ))}
        </section>

        {session.role === 'operador' && (
          <section className="grid two-col">
            <article className="glass-card">
              <div className="section-head">
                <p className="eyebrow">Cadastro rápido</p>
                <h2>Nova solicitação</h2>
              </div>
              <form className="request-form" onSubmit={handleCreateRequest}>
                <input placeholder="Nome do cliente" value={requestForm.clientName} onChange={(event) => setRequestForm({ ...requestForm, clientName: event.target.value })} />
                <input placeholder="CPF/CNPJ" value={requestForm.document} onChange={(event) => setRequestForm({ ...requestForm, document: formatDocument(event.target.value) })} />
                <input placeholder="Telefone" value={requestForm.phone} onChange={(event) => setRequestForm({ ...requestForm, phone: event.target.value })} />
                <input placeholder="Destino" value={requestForm.destination} onChange={(event) => setRequestForm({ ...requestForm, destination: event.target.value })} />
                <input placeholder="Local de embarque" value={requestForm.boardingPoint} onChange={(event) => setRequestForm({ ...requestForm, boardingPoint: event.target.value })} />
                <input placeholder="Saída prevista" value={requestForm.departureAt} onChange={(event) => setRequestForm({ ...requestForm, departureAt: event.target.value })} />
                <input placeholder="Chegada prevista" value={requestForm.arrivalEta} onChange={(event) => setRequestForm({ ...requestForm, arrivalEta: event.target.value })} />
                <input placeholder="Acompanhantes / carga" value={requestForm.companions} onChange={(event) => setRequestForm({ ...requestForm, companions: event.target.value })} />
                <textarea placeholder="Observações" value={requestForm.notes} onChange={(event) => setRequestForm({ ...requestForm, notes: event.target.value })} />
                <button className="cta" type="submit">
                  Gerar protocolo
                </button>
              </form>
            </article>

            <article className="glass-card">
              <div className="section-head">
                <p className="eyebrow">Atendimento</p>
                <h2>Solicitações recentes</h2>
              </div>
              <div className="filter-row">
                <input placeholder="Filtrar por cliente, protocolo ou destino" value={requestFilter} onChange={(event) => setRequestFilter(event.target.value)} />
              </div>
              <div className="request-list">
                {visibleRequests.map((request) => (
                  <article className={`request-row ${request.id === activeRequestId ? 'request-selected' : ''}`} key={request.id} onClick={() => setActiveRequestId(request.id)}>
                    <div>
                      <strong>{request.protocol}</strong>
                      <p>
                        {request.clientName} · {request.destination}
                      </p>
                      <small>
                        {request.boardingPoint} · {request.departureAt}
                      </small>
                    </div>
                    <div className="request-meta">
                      <span className={`status status-${request.status}`}>{request.status}</span>
                      <small>{request.phone}</small>
                    </div>
                  </article>
                ))}
              </div>
            </article>
          </section>
        )}

        {session.role === 'gerente' && (
          <section className="glass-card">
            <div className="section-head">
              <p className="eyebrow">Distribuição</p>
              <h2>Configuração operacional da viagem</h2>
            </div>
            <div className="manager-grid">
              {visibleRequests.map((request) => (
                <article className={`manager-card ${request.id === activeRequestId ? 'request-selected' : ''}`} key={request.id} onClick={() => setActiveRequestId(request.id)}>
                  <strong>{request.protocol}</strong>
                  <p>{request.clientName}</p>
                  <small>{request.destination}</small>
                </article>
              ))}
            </div>

            {activeRequest ? (
              <div className="assignment-panel">
                <div className="assignment-head">
                  <div>
                    <strong>{activeRequest.clientName}</strong>
                    <p>{activeRequest.protocol}</p>
                  </div>
                  <span className={`status status-${activeRequest.status}`}>{activeRequest.status}</span>
                </div>
                <div className="assignment-grid">
                  <label>
                    <span>Motorista</span>
                    <input value={activeRequest.driver} onChange={(event) => patchRequest(activeRequest.id, { driver: event.target.value })} />
                  </label>
                  <label>
                    <span>Veículo</span>
                    <input value={activeRequest.vehicle} onChange={(event) => patchRequest(activeRequest.id, { vehicle: event.target.value })} />
                  </label>
                  <label>
                    <span>Saída</span>
                    <input value={activeRequest.departureAt} onChange={(event) => patchRequest(activeRequest.id, { departureAt: event.target.value })} />
                  </label>
                  <label>
                    <span>Chegada prevista</span>
                    <input value={activeRequest.arrivalEta} onChange={(event) => patchRequest(activeRequest.id, { arrivalEta: event.target.value })} />
                  </label>
                  <label>
                    <span>Status</span>
                    <select value={activeRequest.status} onChange={(event) => patchRequest(activeRequest.id, { status: event.target.value as RequestStatus })}>
                      <option value="rascunho">rascunho</option>
                      <option value="em_atendimento">em_atendimento</option>
                      <option value="aguardando_distribuicao">aguardando_distribuicao</option>
                      <option value="agendada">agendada</option>
                      <option value="em_rota">em_rota</option>
                      <option value="concluida">concluida</option>
                      <option value="cancelada">cancelada</option>
                    </select>
                  </label>
                  <label>
                    <span>Telefone visível</span>
                    <select value={activeRequest.phoneVisible ? 'sim' : 'nao'} onChange={(event) => patchRequest(activeRequest.id, { phoneVisible: event.target.value === 'sim' })}>
                      <option value="sim">sim</option>
                      <option value="nao">nao</option>
                    </select>
                  </label>
                </div>
                <label className="full-width">
                  <span>Observações</span>
                  <textarea value={activeRequest.notes} onChange={(event) => patchRequest(activeRequest.id, { notes: event.target.value })} />
                </label>
              </div>
            ) : null}
          </section>
        )}

        {session.role === 'motorista' && (
          <section className="grid two-col">
            <article className="glass-card">
              <div className="section-head">
                <p className="eyebrow">Agenda mobile</p>
                <h2>Viagens atribuídas</h2>
              </div>
              <div className="request-list">
                {visibleRequests.map((request) => (
                  <article className={`request-row ${request.id === activeRequestId ? 'request-selected' : ''}`} key={request.id} onClick={() => setActiveRequestId(request.id)}>
                    <div>
                      <strong>{request.clientName}</strong>
                      <p>{request.destination}</p>
                      <small>
                        {request.boardingPoint} · {request.departureAt}
                      </small>
                    </div>
                    <div className="request-meta">
                      <span className={`status status-${request.status}`}>{request.status}</span>
                      <small>{request.vehicle || 'Sem veículo'}</small>
                    </div>
                  </article>
                ))}
              </div>
            </article>

            <article className="glass-card">
              <div className="section-head">
                <p className="eyebrow">Ações operacionais</p>
                <h2>Detalhes rápidos</h2>
              </div>
              {activeRequest ? (
                <div className="detail-stack">
                  <p><strong>Cliente:</strong> {activeRequest.clientName}</p>
                  <p><strong>Documento:</strong> {formatDocument(activeRequest.document)}</p>
                  <p><strong>Telefone:</strong> {activeRequest.phoneVisible ? activeRequest.phone : 'oculto'}</p>
                  <p><strong>Embarque:</strong> {activeRequest.boardingPoint}</p>
                  <p><strong>Destino:</strong> {activeRequest.destination}</p>
                  <p><strong>Acompanhantes / carga:</strong> {activeRequest.companions}</p>
                  <a className="cta" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeRequest.boardingPoint)}`} target="_blank" rel="noreferrer">
                    Abrir mapa
                  </a>
                </div>
              ) : null}
            </article>
          </section>
        )}

        {(session.role === 'cliente' || session.role === 'administrador') && (
          <section className="glass-card">
            <div className="section-head">
              <p className="eyebrow">Solicitação central</p>
              <h2>{session.role === 'cliente' ? 'Minhas viagens' : 'Visão global'}</h2>
            </div>
            <div className="request-list">
              {visibleRequests.map((request) => (
                <article className={`request-row ${request.id === activeRequestId ? 'request-selected' : ''}`} key={request.id} onClick={() => setActiveRequestId(request.id)}>
                  <div>
                    <strong>{request.protocol}</strong>
                    <p>
                      {request.clientName} · {request.destination}
                    </p>
                    <small>
                      Embarque: {request.boardingPoint} · Saída: {request.departureAt}
                    </small>
                  </div>
                  <div className="request-meta">
                    <span className={`status status-${request.status}`}>{request.status}</span>
                    <small>{request.driver || 'Sem motorista'}</small>
                    <small>{request.vehicle || 'Sem veículo'}</small>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeRequest ? (
          <section className="grid two-col">
            <article className="glass-card">
              <div className="section-head">
                <p className="eyebrow">Detalhe da viagem</p>
                <h2>Central da solicitação</h2>
              </div>
              <div className="detail-stack">
                <p><strong>Protocolo:</strong> {activeRequest.protocol}</p>
                <p><strong>Cliente:</strong> {activeRequest.clientName}</p>
                <p><strong>Destino:</strong> {activeRequest.destination}</p>
                <p><strong>Motorista:</strong> {activeRequest.driver || 'não atribuído'}</p>
                <p><strong>Veículo:</strong> {activeRequest.vehicle || 'não atribuído'}</p>
                <p><strong>PIN do cliente:</strong> {activeRequest.pinStatus}</p>
                <p><strong>Confirmação:</strong> {activeRequest.clientConfirmedAt ?? 'pendente'}</p>
                <p><strong>Observações:</strong> {activeRequest.notes}</p>
              </div>
            </article>

            <article className="glass-card">
              <div className="section-head">
                <p className="eyebrow">Mensagens e auditoria</p>
                <h2>Histórico e comunicação</h2>
              </div>
              <div className="message-compose">
                <textarea value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} placeholder="Escreva uma mensagem para a operação, motorista ou cliente" />
                <button className="cta" type="button" onClick={handleSendMessage}>
                  Enviar mensagem
                </button>
                {session.role === 'cliente' ? (
                  <button className="cta ghost" type="button" onClick={handleConfirmRead}>
                    Confirmar agenda recebida
                  </button>
                ) : null}
                {session.role !== 'cliente' ? (
                  <button className="cta ghost" type="button" onClick={handleResetClientPin}>
                    Resetar PIN do cliente
                  </button>
                ) : null}
              </div>

              <div className="messages-stack">
                {activeRequest.messages.map((message) => (
                  <article className={`message-item ${message.internal ? 'internal' : 'external'}`} key={message.id}>
                    <div className="message-head">
                      <strong>{message.author}</strong>
                      <span>{message.at}</span>
                    </div>
                    <p>{message.body}</p>
                  </article>
                ))}
              </div>

              <div className="audit-stack">
                {activeRequest.audit.map((item) => (
                  <div className="audit-item" key={item.id}>
                    <strong>{item.label}</strong>
                    <span>{item.at}</span>
                  </div>
                ))}
              </div>
            </article>
          </section>
        ) : null}

        <section className="glass-card">
          <div className="section-head">
            <p className="eyebrow">Arquitetura</p>
            <h2>Base pronta para Cloudflare</h2>
          </div>
          <div className="api-grid">
            <div>
              <strong>Frontend</strong>
              <p>React + TypeScript + Vite com visual responsivo e instalação PWA.</p>
            </div>
            <div>
              <strong>Backend</strong>
              <p>Pages Functions para autenticação, solicitações, mensagens e registros.</p>
            </div>
            <div>
              <strong>Banco</strong>
              <p>Cloudflare D1 para clientes, viagens, mensagens, logs e sessões.</p>
            </div>
            <div>
              <strong>Segurança</strong>
              <p>Estrutura preparada para PIN, tokens e controle por perfil.</p>
            </div>
          </div>
          <div className="pwa-note">
            <strong>PWA</strong>
            <p>Instalável em Android, iPhone com suporte do navegador, Windows e Linux via navegador moderno.</p>
          </div>
        </section>

        {session.role === 'administrador' ? (
          <section className="glass-card">
            <div className="section-head">
              <p className="eyebrow">Governança</p>
              <h2>Usuários com PIN inicial</h2>
            </div>
            <div className="admin-grid">
              {requests.length
                ? [...new Map(requests.map((request) => [request.document, request])).values()].map((request) => (
                    <article className="admin-card" key={request.document}>
                      <strong>{request.clientName}</strong>
                      <p>{request.document}</p>
                      <small>Viagens vinculadas</small>
                    </article>
                  ))
                : null}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function filteredRequests(requests: TripRequest[], session: SessionUser | null, filterText = '') {
  const normalizedFilter = filterText.trim().toLowerCase();

  const base = requests.filter((request) => {
    if (!session) return true;
    if (session.role === 'cliente') return normalizeDocument(request.document) === normalizeDocument(session.document);
    if (session.role === 'motorista') return request.driver.toLowerCase() === session.name.toLowerCase();
    return true;
  });

  if (!normalizedFilter) return base;

  return base.filter((request) =>
    [request.protocol, request.clientName, request.destination, request.driver, request.vehicle]
      .join(' ')
      .toLowerCase()
      .includes(normalizedFilter)
  );
}

export default App;

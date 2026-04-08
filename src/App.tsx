import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { activeTrips, demoUsers, fleet, flowSteps, profiles, defaultRequestForm } from './data';
import type { AccessRole, DemoUser, RequestFormState, SessionUser, TripRequest } from './types';
import {
  createProtocol,
  createRequestId,
  currentStamp,
  formatDocument,
  normalizeDocument,
  readJson,
  removeItem,
  SESSION_KEY,
  REQUESTS_KEY,
  writeJson
} from './lib/persistence';

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
>;

const roleLabels: Record<AccessRole, string> = {
  cliente: 'Cliente',
  operador: 'Operador',
  gerente: 'Gerente',
  motorista: 'Motorista',
  administrador: 'Administrador'
};

const roleDescriptions: Record<AccessRole, string> = {
  cliente: 'Portal de consulta com CPF/CNPJ + PIN.',
  operador: 'Cadastro, triagem e histórico das solicitações.',
  gerente: 'Distribuição da frota e controle operacional.',
  motorista: 'Agenda mobile otimizada para uso em rota.',
  administrador: 'Governança global e acesso irrestrito.'
};

function App() {
  const [accounts, setAccounts] = useState<DemoUser[]>(() => readJson('transporter:accounts', demoUsers));
  const [session, setSession] = useState<SessionUser | null>(() => readJson<SessionUser | null>(SESSION_KEY, null));
  const [requests, setRequests] = useState<TripRequest[]>(() => readJson<TripRequest[]>(REQUESTS_KEY, activeTrips));
  const [loginDocument, setLoginDocument] = useState('');
  const [loginPin, setLoginPin] = useState('0000');
  const [loginError, setLoginError] = useState('');
  const [pinDraft, setPinDraft] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [activeRequestId, setActiveRequestId] = useState<string>(() => activeTrips[0]?.id ?? '');
  const [requestFilter, setRequestFilter] = useState('');
  const [requestForm, setRequestForm] = useState<RequestFormState>(defaultRequestForm);
  const [messageDraft, setMessageDraft] = useState('');

  useEffect(() => {
    writeJson('transporter:accounts', accounts);
  }, [accounts]);

  useEffect(() => {
    writeJson(SESSION_KEY, session);
  }, [session]);

  useEffect(() => {
    writeJson(REQUESTS_KEY, requests);
  }, [requests]);

  useEffect(() => {
    const visible = filteredRequests(requests, session);
    if (!visible.some((request) => request.id === activeRequestId)) {
      setActiveRequestId(visible[0]?.id ?? '');
    }
  }, [requests, session, activeRequestId]);

  const visibleRequests = useMemo(() => filteredRequests(requests, session, requestFilter), [requests, session, requestFilter]);
  const activeRequest = visibleRequests.find((request) => request.id === activeRequestId) ?? visibleRequests[0] ?? null;
  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError('');

    const document = normalizeDocument(loginDocument);
    const account = accounts.find((item) => normalizeDocument(item.document) === document);

    if (!account) {
      setLoginError('Documento não encontrado. Use um acesso de demonstração ou cadastre o usuário.');
      return;
    }

    if (account.pin !== loginPin) {
      setLoginError('PIN inválido. O PIN inicial de todos os acessos é 0000.');
      return;
    }

    setSession({
      name: account.name,
      document: account.document,
      role: account.role,
      mustChangePin: account.mustChangePin,
      token: crypto.randomUUID()
    });
    setPinDraft('');
    setPinConfirm('');
  }

  function handleChangePin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session) return;
    if (pinDraft.length < 4 || pinDraft !== pinConfirm) {
      return;
    }

    setAccounts((current) =>
      current.map((account) =>
        normalizeDocument(account.document) === normalizeDocument(session.document)
          ? { ...account, pin: pinDraft, mustChangePin: false }
          : account
      )
    );

    setSession((current) => (current ? { ...current, mustChangePin: false } : current));
    setPinDraft('');
    setPinConfirm('');
  }

  function handleLogout() {
    setSession(null);
    removeItem(SESSION_KEY);
  }

  function handleCreateRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || session.role !== 'operador') return;

    const nextIndex = requests.length + 1;
    const request: TripRequest = {
      id: createRequestId(),
      protocol: createProtocol(nextIndex),
      clientName: requestForm.clientName,
      document: normalizeDocument(requestForm.document),
      phone: requestForm.phone,
      destination: requestForm.destination,
      boardingPoint: requestForm.boardingPoint,
      departureAt: requestForm.departureAt,
      arrivalEta: requestForm.arrivalEta,
      status: 'em_atendimento',
      driver: '',
      vehicle: '',
      notes: requestForm.notes,
      companions: requestForm.companions,
      phoneVisible: true,
      pinStatus: 'first_access',
      messages: [
        {
          id: `msg-${crypto.randomUUID().slice(0, 6)}`,
          author: session.name,
          role: session.role,
          body: 'Solicitação criada no painel operacional.',
          at: currentStamp(),
          internal: true
        }
      ],
      audit: [{ id: `audit-${crypto.randomUUID().slice(0, 6)}`, label: `Solicitação criada por ${session.name}`, at: currentStamp() }]
    };

    setRequests((current) => [request, ...current]);
    setRequestForm(defaultRequestForm);
    setActiveRequestId(request.id);
  }

  function patchRequest(id: string, patch: RequestPatch, auditLabel?: string) {
    setRequests((current) =>
      current.map((request) => {
        if (request.id !== id) return request;

        const auditEntry = auditLabel
          ? [{ id: `audit-${crypto.randomUUID().slice(0, 6)}`, label: auditLabel, at: currentStamp() }]
          : [];

        return {
          ...request,
          ...patch,
          audit: [...auditEntry, ...request.audit]
        };
      })
    );
  }

  function handleSendMessage() {
    if (!session || !activeRequest || !messageDraft.trim()) return;

    const message = {
      id: `msg-${crypto.randomUUID().slice(0, 6)}`,
      author: session.name,
      role: session.role,
      body: messageDraft.trim(),
      at: currentStamp(),
      internal: session.role !== 'cliente'
    };

    patchRequest(
      activeRequest.id,
      { status: activeRequest.status === 'rascunho' ? 'em_atendimento' : activeRequest.status },
      `Mensagem enviada por ${session.name}`
    );

    setRequests((current) =>
      current.map((request) =>
        request.id === activeRequest.id ? { ...request, messages: [message, ...request.messages] } : request
      )
    );
    setMessageDraft('');
  }

  function handleConfirmRead() {
    if (!activeRequest || !session) return;

    patchRequest(
      activeRequest.id,
      { clientConfirmedAt: currentStamp(), status: 'agendada' },
      `${session.name} confirmou o recebimento da agenda`
    );
  }

  function handleResetClientPin(id: string) {
    const target = requests.find((request) => request.id === id);
    if (!target) return;

    setAccounts((current) =>
      current.map((account) =>
        normalizeDocument(account.document) === normalizeDocument(target.document)
          ? { ...account, pin: '0000', mustChangePin: true }
          : account
      )
    );

    patchRequest(id, { pinStatus: 'reset' }, 'PIN do cliente redefinido para o acesso inicial 0000');
  }

  const dashboardTitle = session ? `${roleLabels[session.role]} em operação` : 'Portal de acesso';

  const operationalSignals = [
    { label: 'Solicitações ativas', value: String(requests.length) },
    { label: 'Em distribuição', value: String(requests.filter((item) => item.status === 'aguardando_distribuicao').length) },
    { label: 'Mensagens novas', value: String(requests.reduce((total, request) => total + request.messages.length, 0)) },
    { label: 'PIN inicial', value: '0000' }
  ];

  if (!session) {
    return (
      <div className="app-shell auth-shell">
        <aside className="hero-panel">
          <div className="brand-lockup">
            <span className="brand-mark">T</span>
            <div>
              <p className="eyebrow">Transporter</p>
              <h1>Operação de transporte com rastreabilidade, ritmo e clareza.</h1>
            </div>
          </div>

          <p className="hero-copy">
            Plataforma web com suporte a PWA para coordenar solicitações, distribuir viagens,
            reduzir ruído operacional e oferecer ao cliente, ao motorista e à gerência uma visão
            única da agenda.
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
                <input value={loginPin} onChange={(event) => setLoginPin(event.target.value)} type="password" inputMode="numeric" />
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
                <input value={pinDraft} onChange={(event) => setPinDraft(event.target.value)} type="password" inputMode="numeric" placeholder="Crie um PIN novo" />
              </label>
              <label>
                <span>Confirmar PIN</span>
                <input value={pinConfirm} onChange={(event) => setPinConfirm(event.target.value)} type="password" inputMode="numeric" placeholder="Repita o PIN" />
              </label>
              <button className="cta" type="submit">
                Salvar novo PIN
              </button>
            </form>
          </section>
        )}

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
                <input
                  placeholder="CPF/CNPJ"
                  value={requestForm.document}
                  onChange={(event) => setRequestForm({ ...requestForm, document: formatDocument(event.target.value) })}
                />
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
                    <input value={activeRequest.driver} onChange={(event) => patchRequest(activeRequest.id, { driver: event.target.value }, 'Motorista atribuído')} />
                  </label>
                  <label>
                    <span>Veículo</span>
                    <input value={activeRequest.vehicle} onChange={(event) => patchRequest(activeRequest.id, { vehicle: event.target.value }, 'Veículo atribuído')} />
                  </label>
                  <label>
                    <span>Saída</span>
                    <input value={activeRequest.departureAt} onChange={(event) => patchRequest(activeRequest.id, { departureAt: event.target.value }, 'Horário de saída ajustado')} />
                  </label>
                  <label>
                    <span>Chegada prevista</span>
                    <input value={activeRequest.arrivalEta} onChange={(event) => patchRequest(activeRequest.id, { arrivalEta: event.target.value }, 'ETA ajustado')} />
                  </label>
                  <label>
                    <span>Status</span>
                    <select value={activeRequest.status} onChange={(event) => patchRequest(activeRequest.id, { status: event.target.value as TripRequest['status'] }, 'Status operacional atualizado')}>
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
                    <select
                      value={activeRequest.phoneVisible ? 'sim' : 'nao'}
                      onChange={(event) => patchRequest(activeRequest.id, { phoneVisible: event.target.value === 'sim' }, 'Visibilidade do telefone ajustada')}
                    >
                      <option value="sim">sim</option>
                      <option value="nao">nao</option>
                    </select>
                  </label>
                </div>
                <label className="full-width">
                  <span>Observações</span>
                  <textarea value={activeRequest.notes} onChange={(event) => patchRequest(activeRequest.id, { notes: event.target.value }, 'Observações da gerência atualizadas')} />
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
                  <p><strong>Destinos:</strong> {activeRequest.destination}</p>
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
                  <button className="cta ghost" type="button" onClick={() => handleResetClientPin(activeRequest.id)}>
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
        </section>

        {session.role === 'administrador' ? (
          <section className="glass-card">
            <div className="section-head">
              <p className="eyebrow">Governança</p>
              <h2>Usuários com PIN inicial</h2>
            </div>
            <div className="admin-grid">
              {accounts.map((account) => (
                <article className="admin-card" key={account.document}>
                  <strong>{account.name}</strong>
                  <p>{roleLabels[account.role]}</p>
                  <small>Documento {formatDocument(account.document)}</small>
                  <small>{account.mustChangePin ? 'Troca de PIN pendente' : 'PIN alterado'}</small>
                </article>
              ))}
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

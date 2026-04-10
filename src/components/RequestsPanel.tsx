import type { FormEvent } from 'react';
import type { AccessRole, ClientFormState, RequestFormState, RequestStatus, SessionUser, TripRequest } from '../types';

type RequestState = {
  requestFilter: string;
  setRequestFilter: (value: string) => void;
  requestForm: RequestFormState;
  setRequestForm: (value: RequestFormState) => void;
  requestCompanion: 'nao' | 'sim';
  setRequestCompanion: (value: 'nao' | 'sim') => void;
  requestCompanionName: string;
  setRequestCompanionName: (value: string) => void;
  requestCompanionCpf: string;
  setRequestCompanionCpf: (value: string) => void;
  requestDate: string;
  setRequestDate: (value: string) => void;
  requestTime: string;
  setRequestTime: (value: string) => void;
  consultDate: string;
  setConsultDate: (value: string) => void;
  consultTime: string;
  setConsultTime: (value: string) => void;
  showInlinePatient: boolean;
  setShowInlinePatient: (value: boolean) => void;
  clientForm: ClientFormState;
  setClientForm: (value: ClientFormState) => void;
  visibleRequests: TripRequest[];
  activeRequestId: string;
  setActiveRequestId: (value: string) => void;
  activeRequest: TripRequest | null;
};

type RequestActions = {
  handleCreateRequest: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleLookupPatient: () => Promise<void>;
  handleInlinePatientSave: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleDeleteRequest: (id: string) => Promise<void>;
  openClientModal: (client: { id: number; name: string; document: string; phone?: string; cep?: string; address?: string }) => void;
};

type ClientState = {
  clients: Array<{ id: number; name: string; document: string; phone?: string; cep?: string; address?: string }>;
  operatorClientFilter: string;
  setOperatorClientFilter: (value: string) => void;
};

type RequestsPanelProps = {
  session: SessionUser;
  roleLabels: Record<AccessRole, string>;
  statusLabels: Record<RequestStatus, string>;
  operatorView: 'novo' | 'recentes' | 'pacientes';
  setOperatorView: (value: 'novo' | 'recentes' | 'pacientes') => void;
  activeNav: string;
  setActiveNav: (id: string) => void;
  requestState: RequestState;
  requestActions: RequestActions;
  clientState: ClientState;
  helpers: {
    formatAddressDisplay: (address: string, cep?: string | null) => string;
    formatSchedule: (value: string) => string;
    buildMapQuery: (request: TripRequest) => string;
    confirmAction?: (message: string, onConfirm: () => void) => void;
  };
};

export function RequestsPanel({
  session,
  roleLabels,
  statusLabels,
  operatorView,
  setOperatorView,
  activeNav,
  setActiveNav,
  requestState,
  requestActions,
  clientState,
  helpers
}: RequestsPanelProps) {
  const {
    requestFilter,
    setRequestFilter,
    requestForm,
    setRequestForm,
    requestCompanion,
    setRequestCompanion,
    requestCompanionName,
    setRequestCompanionName,
    requestCompanionCpf,
    setRequestCompanionCpf,
    requestDate,
    setRequestDate,
    requestTime,
    setRequestTime,
    consultDate,
    setConsultDate,
    consultTime,
    setConsultTime,
    showInlinePatient,
    setShowInlinePatient,
    clientForm,
    setClientForm,
    visibleRequests,
    activeRequestId,
    setActiveRequestId,
    activeRequest
  } = requestState;

  const { handleCreateRequest, handleLookupPatient, handleInlinePatientSave, handleDeleteRequest, openClientModal } = requestActions;
  const { clients, operatorClientFilter, setOperatorClientFilter } = clientState;
  const { formatAddressDisplay, formatSchedule } = helpers;

  const requestEmptyText = requestFilter.trim()
    ? 'Nenhuma solicitação corresponde ao filtro aplicado.'
    : session.role === 'motorista'
    ? 'Nenhuma viagem atribuída até agora.'
    : session.role === 'cliente'
    ? 'Nenhuma viagem registrada para este CPF.'
    : 'Nenhuma solicitação registrada no momento.';

  return (
    <>
      {session.role === 'operador' && (
        <section className="glass-card panel-card" id="solicitacoes">
          <div className="section-head">
            <p className="eyebrow">Atendimento</p>
            <div className="section-toolbar">
              <h2>Solicitações</h2>
              <div className="toolbar-actions">
                <button
                  className={`cta ghost ${operatorView === 'novo' ? 'active' : ''}`}
                  type="button"
                  onClick={() => {
                    setOperatorView('novo');
                    setActiveNav('solicitacoes');
                  }}
                >
                  Nova solicitação
                </button>
                <button
                  className={`cta ghost ${operatorView === 'recentes' ? 'active' : ''}`}
                  type="button"
                  onClick={() => {
                    setOperatorView('recentes');
                    setActiveNav('solicitacoes');
                  }}
                >
                  Solicitações recentes
                </button>
                <button
                  className={`cta ghost ${operatorView === 'pacientes' ? 'active' : ''}`}
                  type="button"
                  onClick={() => {
                    setOperatorView('pacientes');
                    setActiveNav('solicitacoes');
                  }}
                >
                  Pacientes
                </button>
              </div>
            </div>
          </div>

          {operatorView === 'novo' ? (
            <div className="operator-grid">
              <form className="request-form" onSubmit={handleCreateRequest}>
                <div className="input-action">
                  <input
                    placeholder="CPF"
                    value={requestForm.document}
                    onChange={(event) => {
                      setRequestForm({ ...requestForm, document: event.target.value });
                    }}
                  />
                  <button className="cta ghost" type="button" onClick={handleLookupPatient}>
                    Buscar CPF
                  </button>
                </div>
                <input placeholder="Nome do paciente" value={requestForm.clientName} onChange={(event) => setRequestForm({ ...requestForm, clientName: event.target.value })} />
                <input placeholder="Telefone" value={requestForm.phone} onChange={(event) => setRequestForm({ ...requestForm, phone: event.target.value })} />
                <input placeholder="Destino" value={requestForm.destination} onChange={(event) => setRequestForm({ ...requestForm, destination: event.target.value })} />
                <div className="input-action">
                  <input
                    placeholder="CEP"
                    value={requestForm.cep}
                    onChange={(event) => setRequestForm({ ...requestForm, cep: event.target.value })}
                    onBlur={(event) =>
                      handleLookupPatient()
                    }
                  />
                  <button className="cta ghost" type="button" onClick={handleLookupPatient}>
                    Buscar CEP
                  </button>
                </div>
                <input placeholder="Rua" value={requestForm.street} onChange={(event) => setRequestForm({ ...requestForm, street: event.target.value })} />
                <input placeholder="Número" value={requestForm.number} onChange={(event) => setRequestForm({ ...requestForm, number: event.target.value })} />
                <input placeholder="Bairro" value={requestForm.neighborhood} onChange={(event) => setRequestForm({ ...requestForm, neighborhood: event.target.value })} />
                <input placeholder="Cidade" value={requestForm.city} onChange={(event) => setRequestForm({ ...requestForm, city: event.target.value })} />
                <label>
                  <span>Data e hora da viagem</span>
                  <div className="input-group">
                    <input type="date" value={requestDate} onChange={(event) => setRequestDate(event.target.value)} />
                    <input type="time" value={requestTime} onChange={(event) => setRequestTime(event.target.value)} />
                  </div>
                </label>
                <label>
                  <span>Data e hora da consulta</span>
                  <div className="input-group">
                    <input type="date" value={consultDate} onChange={(event) => setConsultDate(event.target.value)} />
                    <input type="time" value={consultTime} onChange={(event) => setConsultTime(event.target.value)} />
                  </div>
                </label>
                <label>
                  <span>Acompanhante</span>
                  <select value={requestCompanion} onChange={(event) => setRequestCompanion(event.target.value as 'nao' | 'sim')}>
                    <option value="nao">não</option>
                    <option value="sim">sim</option>
                  </select>
                </label>
                {requestCompanion === 'sim' ? (
                  <>
                    <input placeholder="Nome do acompanhante" value={requestCompanionName} onChange={(event) => setRequestCompanionName(event.target.value)} />
                    <input placeholder="CPF do acompanhante" value={requestCompanionCpf} onChange={(event) => setRequestCompanionCpf(event.target.value)} />
                  </>
                ) : null}
                <textarea placeholder="Observações" value={requestForm.notes} onChange={(event) => setRequestForm({ ...requestForm, notes: event.target.value })} />
                <button className="cta" type="submit">
                  Gerar protocolo
                </button>
              </form>

              {showInlinePatient ? (
                <div className="glass-card inline-card">
                  <div className="section-head">
                    <p className="eyebrow">Cadastro rápido</p>
                    <h3>Novo paciente</h3>
                  </div>
                  <form className="request-form" onSubmit={handleInlinePatientSave}>
                    <input placeholder="Nome completo" value={clientForm.name} onChange={(event) => setClientForm({ ...clientForm, name: event.target.value })} />
                    <input placeholder="CPF" value={clientForm.document} onChange={(event) => setClientForm({ ...clientForm, document: event.target.value })} />
                    <input placeholder="Telefone" value={clientForm.phone} onChange={(event) => setClientForm({ ...clientForm, phone: event.target.value })} />
                    <div className="input-action">
                      <input placeholder="CEP" value={clientForm.cep} onChange={(event) => setClientForm({ ...clientForm, cep: event.target.value })} />
                      <button className="cta ghost" type="button" onClick={() => handleLookupPatient()}>
                        Buscar CEP
                      </button>
                    </div>
                    <input placeholder="Rua" value={clientForm.street} onChange={(event) => setClientForm({ ...clientForm, street: event.target.value })} />
                    <input placeholder="Número" value={clientForm.number} onChange={(event) => setClientForm({ ...clientForm, number: event.target.value })} />
                    <input placeholder="Bairro" value={clientForm.neighborhood} onChange={(event) => setClientForm({ ...clientForm, neighborhood: event.target.value })} />
                    <input placeholder="Cidade" value={clientForm.city} onChange={(event) => setClientForm({ ...clientForm, city: event.target.value })} />
                    <div className="form-actions">
                      <button className="cta ghost" type="button" onClick={() => setShowInlinePatient(false)}>
                        Cancelar
                      </button>
                      <button className="cta" type="submit">
                        Salvar paciente
                      </button>
                    </div>
                  </form>
                </div>
              ) : null}
            </div>
          ) : operatorView === 'recentes' ? (
            <>
              <div className="filter-row">
                <input placeholder="Filtrar por paciente, protocolo ou destino" value={requestFilter} onChange={(event) => setRequestFilter(event.target.value)} />
              </div>
              <div className="admin-table">
                <div className="admin-row admin-row-head">
                  <span>Protocolo</span>
                  <span>Paciente</span>
                  <span>Saída</span>
                  <span>Status</span>
                  <span>Ação</span>
                </div>
                <div className="admin-table-body operator-scroll">
                  {visibleRequests.length ? (
                    visibleRequests.map((request) => (
                      <div className="admin-row" key={request.id}>
                        <strong>{request.protocol}</strong>
                        <div className="admin-cell">
                          <strong>{request.clientName}</strong>
                          <small>{formatAddressDisplay(request.boardingPoint, request.boardingCep ?? request.clientCep)}</small>
                        </div>
                        <span>{formatSchedule(request.departureAt)}</span>
                        <span className={`status status-${request.status}`}>{statusLabels[request.status]}</span>
                        <div className="table-actions">
                          <button
                            className="cta ghost"
                            type="button"
                            onClick={() => {
                              setActiveRequestId(request.id);
                              setActiveNav('detalhes');
                            }}
                          >
                            Editar
                          </button>
                          <button
                            className="cta ghost danger"
                            type="button"
                            onClick={() => {
                              if (helpers.confirmAction) {
                                helpers.confirmAction('Deseja excluir esta solicitação?', () => handleDeleteRequest(request.id));
                              } else if (window.confirm('Deseja excluir esta solicitação?')) {
                                handleDeleteRequest(request.id);
                              }
                            }}
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">
                      <div className="empty-icon"></div>
                      <strong>Solicitações vazias</strong>
                      <p>{requestEmptyText}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="filter-row">
                <input
                  placeholder="Buscar por nome ou CPF"
                  value={operatorClientFilter}
                  onChange={(event) => {
                    setOperatorClientFilter(event.target.value);
                  }}
                />
              </div>
              <div className="admin-table">
                <div className="admin-row admin-row-head">
                  <span>Paciente</span>
                  <span>CPF</span>
                  <span>Telefone</span>
                  <span>CEP</span>
                  <span>Endereço</span>
                </div>
                <div className="admin-table-body operator-scroll">
                  {clients.length ? (
                    clients.map((client) => (
                      <div className="admin-row" key={client.id} onClick={() => openClientModal(client)}>
                        <div className="admin-user">
                          <span className="admin-avatar">{client.name.trim().split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span>
                          <strong>{client.name}</strong>
                        </div>
                        <span>{client.document}</span>
                        <span>{client.phone || '-'}</span>
                        <span>{client.cep || '-'}</span>
                        <span>{client.address || '-'}</span>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">
                      <div className="empty-icon"></div>
                      <strong>Nenhum paciente encontrado</strong>
                      <p>Use a busca acima para localizar um CPF cadastrado.</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {session.role === 'gerente' && (
        <section className="glass-card panel-card" id="distribuicao">
          <div className="section-head">
            <p className="eyebrow">Distribuição</p>
            <h2>Configuração operacional da viagem</h2>
          </div>
          <div className="manager-grid">
            {visibleRequests.length ? (
              visibleRequests.map((request) => (
                <article className={`manager-card ${request.id === activeRequestId ? 'request-selected' : ''}`} key={request.id} onClick={() => setActiveRequestId(request.id)}>
                  <strong>{request.protocol}</strong>
                  <p>{request.clientName}</p>
                  <small>{request.destination}</small>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <div className="empty-icon"></div>
                <strong>Sem viagens para distribuir</strong>
                <p>Assim que o operador registrar uma solicitação ela aparecerá aqui.</p>
              </div>
            )}
          </div>
          {activeRequest ? (
            <div className="assignment-panel">
              <div className="assignment-head">
                <div>
                  <strong>{activeRequest.clientName}</strong>
                  <p>{activeRequest.protocol}</p>
                </div>
                <span className={`status status-${activeRequest.status}`}>{statusLabels[activeRequest.status]}</span>
              </div>
              <div className="assignment-grid">
                <label>
                  <span>CEP do embarque</span>
                  <div className="input-action">
                    <input value={activeRequest.boardingCep || ''} readOnly />
                    <button className="cta ghost" type="button">
                      Buscar CEP
                    </button>
                  </div>
                </label>
                <label>
                  <span>Rua</span>
                  <input value={activeRequest.boardingPoint} readOnly />
                </label>
                <label>
                  <span>Número</span>
                  <input value="" readOnly />
                </label>
                <label>
                  <span>Bairro</span>
                  <input value="" readOnly />
                </label>
                <label>
                  <span>Cidade</span>
                  <input value="" readOnly />
                </label>
                <label>
                  <span>Motorista</span>
                  <input value={activeRequest.driver} readOnly />
                </label>
                <label>
                  <span>Veículo</span>
                  <input value={activeRequest.vehicle} readOnly />
                </label>
                <label>
                  <span>Data e hora da viagem</span>
                  <div className="input-group">
                    <input type="date" value="" readOnly />
                    <input type="time" value="" readOnly />
                  </div>
                </label>
                <label>
                  <span>Data e hora da consulta</span>
                  <div className="input-group">
                    <input type="date" value="" readOnly />
                    <input type="time" value="" readOnly />
                  </div>
                </label>
                <label>
                  <span>Status</span>
                  <select value={activeRequest.status} disabled>
                    <option value="rascunho">Rascunho</option>
                    <option value="em_atendimento">Em atendimento</option>
                    <option value="aguardando_distribuicao">Aguardando distribuição</option>
                    <option value="agendada">Agendada</option>
                    <option value="em_rota">Em rota</option>
                    <option value="concluida">Concluída</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </label>
                <label>
                  <span>Telefone visível</span>
                  <select value={activeRequest.phoneVisible ? 'sim' : 'nao'} disabled>
                    <option value="sim">sim</option>
                    <option value="nao">nao</option>
                  </select>
                </label>
              </div>
              <label className="full-width">
                <span>Observações</span>
                <textarea value={activeRequest.notes} readOnly />
              </label>
            </div>
          ) : null}
        </section>
      )}

      {session.role === 'motorista' && (
        <section className="grid two-col" id="agenda">
          <article className="glass-card panel-card">
            <div className="section-head">
              <p className="eyebrow">Agenda mobile</p>
              <h2>Viagens atribuídas</h2>
            </div>
            <div className="request-list">
              {visibleRequests.length ? (
                visibleRequests.map((request) => (
                  <article className={`request-row ${request.id === activeRequestId ? 'request-selected' : ''}`} key={request.id} onClick={() => setActiveRequestId(request.id)}>
                    <div>
                      <strong>{request.clientName}</strong>
                      <p>{request.destination}</p>
                      <small>
                        {formatAddressDisplay(request.boardingPoint, request.boardingCep ?? request.clientCep)} · {formatSchedule(request.departureAt)}
                      </small>
                    </div>
                    <div className="request-meta">
                      <span className={`status status-${request.status}`}>{statusLabels[request.status]}</span>
                      <small>{request.vehicle || 'Sem veículo'}</small>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <div className="empty-icon"></div>
                  <strong>Agenda livre</strong>
                  <p>{requestEmptyText}</p>
                </div>
              )}
            </div>
          </article>

          <article className="glass-card panel-card">
            <div className="section-head">
              <p className="eyebrow">Ações operacionais</p>
              <h2>Detalhes rápidos</h2>
            </div>
            {activeRequest ? (
              <div className="detail-stack">
                <p>
                  <strong>Paciente:</strong> {activeRequest.clientName}
                </p>
                <p>
                  <strong>CPF:</strong> {activeRequest.document}
                </p>
                <p>
                  <strong>Telefone:</strong> {activeRequest.phoneVisible ? activeRequest.phone : 'oculto'}
                </p>
                <p>
                  <strong>Endereço:</strong> {activeRequest.clientAddress || 'não informado'}
                </p>
                <p>
                  <strong>CEP:</strong> {activeRequest.clientCep || 'não informado'}
                </p>
                <p>
                  <strong>Embarque:</strong> {formatAddressDisplay(activeRequest.boardingPoint, activeRequest.boardingCep ?? activeRequest.clientCep)}
                </p>
                <p>
                  <strong>Destino:</strong> {activeRequest.destination}
                </p>
                <p>
                  <strong>Acompanhantes / carga:</strong> {activeRequest.companions}
                </p>
                <a
                  className="cta"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(helpers.buildMapQuery(activeRequest) || activeRequest.boardingPoint)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir mapa
                </a>
              </div>
            ) : null}
          </article>
        </section>
      )}

      {(session.role === 'cliente' || session.role === 'administrador') && (
        <section className="glass-card panel-card" id="viagens">
          <div className="section-head">
            <p className="eyebrow">Solicitação central</p>
            <h2>{session.role === 'cliente' ? 'Minhas viagens' : 'Visão global'}</h2>
          </div>
          <div className="request-list">
            {visibleRequests.length ? (
              visibleRequests.map((request) => (
                <article className={`request-row ${request.id === activeRequestId ? 'request-selected' : ''}`} key={request.id} onClick={() => setActiveRequestId(request.id)}>
                  <div>
                    <strong>{request.protocol}</strong>
                    <p>
                      {request.clientName} · {request.destination}
                    </p>
                    <small>
                      Embarque: {formatAddressDisplay(request.boardingPoint, request.boardingCep ?? request.clientCep)} · Saída: {formatSchedule(request.departureAt)}
                    </small>
                  </div>
                  <div className="request-meta">
                    <span className={`status status-${request.status}`}>{statusLabels[request.status]}</span>
                    <small>{request.driver || 'Sem motorista'}</small>
                    <small>{request.vehicle || 'Sem veículo'}</small>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <div className="empty-icon"></div>
                <strong>Nenhuma viagem encontrada</strong>
                <p>{requestEmptyText}</p>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}

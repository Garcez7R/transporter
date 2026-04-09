import type { FormEvent } from 'react';
import type { RequestStatus, SessionUser, TripRequest } from '../types';

type RequestDetailsProps = {
  activeRequest: TripRequest;
  session: SessionUser;
  canEditTrip: boolean;
  tripForm: {
    destination: string;
    destinationFacility: string;
    boardingPoint: string;
    departureAt: string;
    arrivalEta: string;
    notes: string;
    companions: string;
    status: RequestStatus;
    driver: string;
    vehicle: string;
    phoneVisible: boolean;
  };
  setTripForm: (value: RequestDetailsProps['tripForm']) => void;
  tripCompanion: 'nao' | 'sim';
  setTripCompanion: (value: 'nao' | 'sim') => void;
  tripCompanionName: string;
  setTripCompanionName: (value: string) => void;
  tripCompanionCpf: string;
  setTripCompanionCpf: (value: string) => void;
  tripDate: string;
  setTripDate: (value: string) => void;
  tripTime: string;
  setTripTime: (value: string) => void;
  tripConsultDate: string;
  setTripConsultDate: (value: string) => void;
  tripConsultTime: string;
  setTripConsultTime: (value: string) => void;
  messageDraft: string;
  setMessageDraft: (value: string) => void;
  handleSaveTrip: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleSendMessage: () => Promise<void>;
  handleConfirmRead: () => Promise<void>;
  handleResetClientPin: () => Promise<void>;
  statusLabels: Record<RequestStatus, string>;
  formatTime: (value: string) => string;
  formatAddressDisplay: (address: string, cep?: string | null) => string;
  buildMapQuery: (request: TripRequest) => string;
};

export function RequestDetails({
  activeRequest,
  session,
  canEditTrip,
  tripForm,
  setTripForm,
  tripCompanion,
  setTripCompanion,
  tripCompanionName,
  setTripCompanionName,
  tripCompanionCpf,
  setTripCompanionCpf,
  tripDate,
  setTripDate,
  tripTime,
  setTripTime,
  tripConsultDate,
  setTripConsultDate,
  tripConsultTime,
  setTripConsultTime,
  messageDraft,
  setMessageDraft,
  handleSaveTrip,
  handleSendMessage,
  handleConfirmRead,
  handleResetClientPin,
  statusLabels,
  formatTime,
  formatAddressDisplay,
  buildMapQuery
}: RequestDetailsProps) {
  return (
    <section className="grid two-col" id="detalhes">
      <article className="glass-card panel-card">
        <div className="section-head">
          <p className="eyebrow">Detalhe da viagem</p>
          <h2>Central da solicitação</h2>
        </div>
        <div className="detail-stack">
          <p>
            <strong>Protocolo:</strong> {activeRequest.protocol}
          </p>
          <p>
            <strong>Paciente:</strong> {activeRequest.clientName}
          </p>
          <p>
            <strong>Destino:</strong> {activeRequest.destination}
          </p>
          <p>
            <strong>Hospital/Clínica/Posto:</strong> {activeRequest.destinationFacility || 'Não informado'}
          </p>
          {session.role !== 'operador' ? (
            <>
              <p>
                <strong>Motorista:</strong> {activeRequest.driver || 'não atribuído'}
              </p>
              <p>
                <strong>Veículo:</strong> {activeRequest.vehicle || 'não atribuído'}
              </p>
              <p>
                <strong>PIN do paciente:</strong> {activeRequest.pinStatus}
              </p>
              <p>
                <strong>Confirmação:</strong> {activeRequest.clientConfirmedAt ?? 'pendente'}
              </p>
            </>
          ) : null}
          <p>
            <strong>Observações:</strong> {activeRequest.notes}
          </p>
        </div>

        {canEditTrip ? (
          <form className="request-form" onSubmit={handleSaveTrip}>
            <input
              placeholder="Cidade de destino"
              value={tripForm.destination}
              onChange={(event) => setTripForm({ ...tripForm, destination: event.target.value })}
            />
            <input
              placeholder="Hospital / Clínica / Posto"
              value={tripForm.destinationFacility}
              onChange={(event) => setTripForm({ ...tripForm, destinationFacility: event.target.value })}
            />
            <input
              placeholder="Endereço completo"
              value={tripForm.boardingPoint}
              onChange={(event) => setTripForm({ ...tripForm, boardingPoint: event.target.value })}
            />
            <label>
              <span>Data e hora da viagem</span>
              <div className="input-group">
                <input type="date" value={tripDate} onChange={(event) => setTripDate(event.target.value)} />
                <input type="time" value={tripTime} onChange={(event) => setTripTime(formatTime(event.target.value))} />
              </div>
            </label>
            <label>
              <span>Data e hora da consulta</span>
              <div className="input-group">
                <input type="date" value={tripConsultDate} onChange={(event) => setTripConsultDate(event.target.value)} />
                <input type="time" value={tripConsultTime} onChange={(event) => setTripConsultTime(formatTime(event.target.value))} />
              </div>
            </label>
            <label>
              <span>Acompanhante</span>
              <select value={tripCompanion} onChange={(event) => setTripCompanion(event.target.value as 'nao' | 'sim')}>
                <option value="nao">não</option>
                <option value="sim">sim</option>
              </select>
            </label>
            {tripCompanion === 'sim' ? (
              <>
                <input
                  placeholder="Nome do acompanhante"
                  value={tripCompanionName}
                  onChange={(event) => setTripCompanionName(event.target.value)}
                />
                <input
                  placeholder="CPF do acompanhante"
                  value={tripCompanionCpf}
                  onChange={(event) => setTripCompanionCpf(event.target.value)}
                />
              </>
            ) : null}
            <textarea
              placeholder="Observações"
              value={tripForm.notes}
              onChange={(event) => setTripForm({ ...tripForm, notes: event.target.value })}
            />
            <label>
              <span>Status</span>
              <select value={tripForm.status} onChange={(event) => setTripForm({ ...tripForm, status: event.target.value as RequestStatus })}>
                <option value="rascunho">Rascunho</option>
                <option value="em_atendimento">Em atendimento</option>
                <option value="aguardando_distribuicao">Aguardando distribuição</option>
                <option value="agendada">Agendada</option>
                <option value="em_rota">Em rota</option>
                <option value="concluida">Concluída</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </label>
            {(session.role === 'gerente' || session.role === 'administrador') && (
              <>
                <input
                  placeholder="Motorista"
                  value={tripForm.driver}
                  onChange={(event) => setTripForm({ ...tripForm, driver: event.target.value })}
                />
                <input
                  placeholder="Veículo"
                  value={tripForm.vehicle}
                  onChange={(event) => setTripForm({ ...tripForm, vehicle: event.target.value })}
                />
                <label>
                  <span>Telefone visível</span>
                  <select
                    value={tripForm.phoneVisible ? 'sim' : 'nao'}
                    onChange={(event) => setTripForm({ ...tripForm, phoneVisible: event.target.value === 'sim' })}
                  >
                    <option value="sim">sim</option>
                    <option value="nao">nao</option>
                  </select>
                </label>
              </>
            )}
            <div className="form-actions">
              <button
                className="cta ghost"
                type="button"
                onClick={() => {
                  setTripForm({
                    destination: activeRequest.destination,
                    destinationFacility: activeRequest.destinationFacility,
                    boardingPoint: activeRequest.boardingPoint,
                    departureAt: activeRequest.departureAt,
                    arrivalEta: activeRequest.arrivalEta,
                    notes: activeRequest.notes,
                    companions: activeRequest.companions,
                    status: activeRequest.status,
                    driver: activeRequest.driver,
                    vehicle: activeRequest.vehicle,
                    phoneVisible: Boolean(activeRequest.phoneVisible)
                  });
                  const parsed = activeRequest.companions ? activeRequest.companions.match(/sim:\s*(.+)\s+\((.+)\)/i) : null;
                  setTripCompanion(parsed ? 'sim' : 'nao');
                  setTripCompanionName(parsed?.[1]?.trim() ?? '');
                  setTripCompanionCpf(parsed?.[2]?.trim() ?? '');
                  const departure = { date: '', time: '' };
                  const consult = { date: '', time: '' };
                  setTripDate(departure.date);
                  setTripTime(departure.time);
                  setTripConsultDate(consult.date);
                  setTripConsultTime(consult.time);
                }}
              >
                Cancelar
              </button>
              <button className="cta" type="submit">
                Salvar alterações
              </button>
            </div>
          </form>
        ) : null}
      </article>

      <article className="glass-card panel-card">
        <div className="section-head">
          <p className="eyebrow">{session.role === 'cliente' ? 'Mensagens' : 'Mensagens e auditoria'}</p>
          <div className="section-toolbar">
            <h2>{session.role === 'cliente' ? 'Comunicação' : 'Histórico e comunicação'}</h2>
            <button className={`status status-${activeRequest.status} status-pill`} type="button">
              {statusLabels[activeRequest.status]}
            </button>
          </div>
        </div>
        <div className="message-compose">
          <textarea value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} placeholder="Escreva uma mensagem para a operação, motorista ou paciente" />
          <button className="cta" type="button" onClick={handleSendMessage}>
            Enviar mensagem
          </button>
          {session.role === 'cliente' ? (
            <button className="cta ghost" type="button" onClick={handleConfirmRead}>
              Confirmar agenda recebida
            </button>
          ) : null}
          {(session.role === 'operador' || session.role === 'gerente' || session.role === 'administrador') ? (
            <button className="cta ghost" type="button" onClick={handleResetClientPin}>
              Resetar PIN do paciente
            </button>
          ) : null}
        </div>

        <div className="messages-stack">
          {activeRequest.messages.length ? (
            activeRequest.messages.map((message) => (
              <article className={`message-item ${message.internal ? 'internal' : 'external'}`} key={message.id}>
                {session.role === 'cliente' ? null : (
                  <div className="message-head">
                    <strong>{message.author}</strong>
                    <span>{message.at}</span>
                  </div>
                )}
                <p>{message.body}</p>
              </article>
            ))
          ) : (
            <div className="empty-state compact">
              <div className="empty-icon"></div>
              <strong>Sem mensagens</strong>
              <p>Quando houver comunicação, ela aparecerá aqui.</p>
            </div>
          )}
        </div>

        {session.role === 'cliente' ? null : (
          <div className="audit-stack">
            {activeRequest.audit.filter((item) => !item.label.includes('.')).length ? (
              activeRequest.audit
                .filter((item) => !item.label.includes('.'))
                .map((item) => (
                  <div className="audit-item" key={item.id}>
                    <strong>{item.label}</strong>
                    {item.details ? <small>{item.details}</small> : null}
                    {item.actor ? <span>{item.actor}</span> : null}
                    <span>{item.at}</span>
                  </div>
                ))
            ) : (
              <div className="empty-state compact">
                <div className="empty-icon"></div>
                <strong>Sem auditoria</strong>
                <p>As mudanças relevantes serão registradas aqui.</p>
              </div>
            )}
          </div>
        )}
      </article>
    </section>
  );
}

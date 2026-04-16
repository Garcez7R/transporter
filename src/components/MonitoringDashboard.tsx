import { useMemo, useState } from 'react';
import type { AccessRole, ClientRow, MonitoringSnapshot, TripRequest, UserRow } from '../types';
import { splitDateTime } from '../lib/utils';

type MonitoringDashboardProps = {
  userRole: AccessRole;
  requests: TripRequest[];
  users: UserRow[];
  clients: ClientRow[];
  snapshot?: MonitoringSnapshot | null;
};

export function MonitoringDashboard({ userRole, requests, users, clients, snapshot }: MonitoringDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'ops' | 'audit'>('overview');

  const overview = useMemo(() => {
    const activeStatuses = ['em_atendimento', 'agendada', 'em_rota'];
    const byStatus = requests.reduce<Record<string, number>>((acc, request) => {
      acc[request.status] = (acc[request.status] ?? 0) + 1;
      return acc;
    }, {});

    const byDate = requests.reduce<Record<string, number>>((acc, request) => {
      const date = splitDateTime(request.departureAt).date || 'sem-data';
      acc[date] = (acc[date] ?? 0) + 1;
      return acc;
    }, {});

    const topDates = Object.entries(byDate).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return {
      activeRequests: requests.filter((request) => activeStatuses.includes(request.status)).length,
      inRoute: byStatus.em_rota ?? 0,
      pendingDispatch: byStatus.aguardando_distribuicao ?? 0,
      completed: byStatus.concluida ?? 0,
      topDates
    };
  }, [requests]);

  const roleCounts = useMemo(() => {
    return users.reduce<Record<string, number>>((acc, user) => {
      acc[user.role] = (acc[user.role] ?? 0) + 1;
      return acc;
    }, {});
  }, [users]);

  const summary = snapshot?.summary ?? {
    activeRequests: overview.activeRequests,
    inRoute: overview.inRoute,
    pendingDispatch: overview.pendingDispatch,
    completed: overview.completed,
    clients: clients.length,
    gpsPings: 0,
    fuelLogs: 0
  };

  const topDates = snapshot?.topDates ?? overview.topDates.map(([date, count]) => ({ date, count }));
  const resolvedRoleCounts = snapshot?.roleCounts ?? Object.entries(roleCounts).map(([role, count]) => ({ role, count }));
  const recentAudit = snapshot?.recentAudit ?? [];
  const conflicts = snapshot?.conflicts ?? [];
  const suggestions = snapshot?.suggestions ?? [];

  return (
    <div className="monitoring-dashboard admin-monitoring">
      <div className="section-head">
        <p className="eyebrow">Monitoramento operacional</p>
        <h2>Leituras unificadas do backend</h2>
      </div>

      <div className="settings-tabs">
        <button className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          Visão geral
        </button>
        <button className={`tab-button ${activeTab === 'ops' ? 'active' : ''}`} onClick={() => setActiveTab('ops')}>
          Operação
        </button>
        {userRole === 'administrador' ? (
          <button className={`tab-button ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>
            Auditoria beta
          </button>
        ) : null}
      </div>

      {activeTab === 'overview' ? (
        <div className="dashboard-metrics">
          <div className="metric-card glass-card">
            <div className="metric-content">
              <strong>{summary.activeRequests}</strong>
              <span>Solicitações ativas</span>
            </div>
          </div>
          <div className="metric-card glass-card">
            <div className="metric-content">
              <strong>{summary.inRoute}</strong>
              <span>Em rota</span>
            </div>
          </div>
          <div className="metric-card glass-card">
            <div className="metric-content">
              <strong>{summary.pendingDispatch}</strong>
              <span>Aguardando distribuição</span>
            </div>
          </div>
          <div className="metric-card glass-card">
            <div className="metric-content">
              <strong>{summary.clients}</strong>
              <span>Pacientes cadastrados</span>
            </div>
          </div>
          <div className="metric-card glass-card">
            <div className="metric-content">
              <strong>{summary.gpsPings}</strong>
              <span>Pings de GPS</span>
            </div>
          </div>
          <div className="metric-card glass-card">
            <div className="metric-content">
              <strong>{summary.fuelLogs}</strong>
              <span>Abastecimentos</span>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'ops' ? (
        <div className="grid two-col">
          <article className="glass-card panel-card">
            <div className="section-head compact">
              <p className="eyebrow">Carga por dia</p>
              <h3>Concentração operacional</h3>
            </div>
            <div className="timeline">
              {topDates.length ? (
                topDates.map(({ date, count }, index) => (
                  <li key={date}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{date}</strong>
                      <small>{count} solicitações previstas</small>
                    </div>
                  </li>
                ))
              ) : (
                <li>
                  <span>0</span>
                  <div>
                    <strong>Sem agenda consolidada</strong>
                    <small>As leituras aparecem quando houver solicitações com data.</small>
                  </div>
                </li>
              )}
            </div>
          </article>

          <article className="glass-card panel-card">
            <div className="section-head compact">
              <p className="eyebrow">Equipe</p>
              <h3>Distribuição por perfil</h3>
            </div>
            <div className="timeline">
              {resolvedRoleCounts.map(({ role, count }, index) => (
                <li key={role}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{role}</strong>
                    <small>{count} usuário(s) no cadastro</small>
                  </div>
                </li>
              ))}
            </div>
          </article>

          <article className="glass-card panel-card">
            <div className="section-head compact">
              <p className="eyebrow">Conflitos</p>
              <h3>Guardrails do backend</h3>
            </div>
            <div className="timeline">
              {conflicts.length ? (
                conflicts.slice(0, 6).map((conflict, index) => (
                  <li key={conflict.id}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{conflict.title}</strong>
                      <small>{conflict.detail}</small>
                    </div>
                  </li>
                ))
              ) : (
                <li>
                  <span>0</span>
                  <div>
                    <strong>Sem conflitos críticos</strong>
                    <small>As regras atuais não encontraram sobreposição ou excesso de carga.</small>
                  </div>
                </li>
              )}
            </div>
          </article>

          <article className="glass-card panel-card">
            <div className="section-head compact">
              <p className="eyebrow">Sugestões</p>
              <h3>Agrupamentos automáticos</h3>
            </div>
            <div className="timeline">
              {suggestions.length ? (
                suggestions.slice(0, 6).map((suggestion, index) => (
                  <li key={suggestion.id}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{suggestion.title}</strong>
                      <small>{suggestion.detail} · {suggestion.count} solicitação(ões)</small>
                    </div>
                  </li>
                ))
              ) : (
                <li>
                  <span>0</span>
                  <div>
                    <strong>Sem agrupamentos fortes</strong>
                    <small>As sugestões aparecem quando houver concentração por data e destino.</small>
                  </div>
                </li>
              )}
            </div>
          </article>
        </div>
      ) : null}

      {activeTab === 'audit' && userRole === 'administrador' ? (
        <article className="glass-card panel-card">
          <div className="section-head compact">
            <p className="eyebrow">Auditoria central</p>
            <h3>Eventos recentes</h3>
          </div>
          <div className="audit-stack">
            {recentAudit.length ? (
              recentAudit.map((item) => (
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
                <strong>Sem eventos recentes</strong>
                <p>Os registros de auditoria aparecem aqui conforme a operação evolui.</p>
              </div>
            )}
          </div>
        </article>
      ) : null}
    </div>
  );
}

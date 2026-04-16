import { useMemo, useState } from 'react';
import type { AccessRole, ClientRow, TripRequest, UserRow } from '../types';
import { splitDateTime } from '../lib/utils';

type MonitoringDashboardProps = {
  userRole: AccessRole;
  requests: TripRequest[];
  users: UserRow[];
  clients: ClientRow[];
};

export function MonitoringDashboard({ userRole, requests, users, clients }: MonitoringDashboardProps) {
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

  return (
    <div className="monitoring-dashboard admin-monitoring">
      <div className="section-head">
        <p className="eyebrow">Monitoramento beta</p>
        <h2>Leituras operacionais confiáveis</h2>
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
              <strong>{overview.activeRequests}</strong>
              <span>Solicitações ativas</span>
            </div>
          </div>
          <div className="metric-card glass-card">
            <div className="metric-content">
              <strong>{overview.inRoute}</strong>
              <span>Em rota</span>
            </div>
          </div>
          <div className="metric-card glass-card">
            <div className="metric-content">
              <strong>{overview.pendingDispatch}</strong>
              <span>Aguardando distribuição</span>
            </div>
          </div>
          <div className="metric-card glass-card">
            <div className="metric-content">
              <strong>{clients.length}</strong>
              <span>Pacientes cadastrados</span>
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
              {overview.topDates.length ? (
                overview.topDates.map(([date, count], index) => (
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
              {Object.entries(roleCounts).map(([role, count], index) => (
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
        </div>
      ) : null}

      {activeTab === 'audit' && userRole === 'administrador' ? (
        <article className="glass-card panel-card">
          <div className="section-head compact">
            <p className="eyebrow">Auditoria beta</p>
            <h3>Estado atual</h3>
          </div>
          <div className="detail-stack">
            <p><strong>Solicitações auditáveis:</strong> {requests.length}</p>
            <p><strong>Usuários visíveis:</strong> {users.length}</p>
            <p><strong>Pacientes visíveis:</strong> {clients.length}</p>
            <p><strong>Observação:</strong> a trilha de auditoria detalhada ainda depende de endpoint consolidado no backend.</p>
          </div>
        </article>
      ) : null}
    </div>
  );
}

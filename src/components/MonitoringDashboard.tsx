import { useState, useEffect } from 'react';
import type { AccessRole } from '../types';

type MonitoringDashboardProps = {
  userRole: AccessRole;
  requests: any[];
  users: any[];
  clients: any[];
};

export function MonitoringDashboard({ userRole, requests, users, clients }: MonitoringDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'security' | 'audit'>('overview');
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');

  // Basic monitoring for operators
  if (userRole === 'operador') {
    return (
      <div className="monitoring-dashboard operator-monitoring">
        <div className="section-head">
          <p className="eyebrow">Monitoramento</p>
          <h2>Status Operacional</h2>
        </div>

        <div className="monitoring-grid">
          <div className="metric-card glass-card">
            <div className="metric-header">
              <span className="metric-icon">📊</span>
              <span className="metric-title">Solicitações Ativas</span>
            </div>
            <div className="metric-value">{requests.filter(r => ['em_atendimento', 'agendada', 'em_rota'].includes(r.status)).length}</div>
          </div>

          <div className="metric-card glass-card">
            <div className="metric-header">
              <span className="metric-icon">🚑</span>
              <span className="metric-title">Em Rota</span>
            </div>
            <div className="metric-value">{requests.filter(r => r.status === 'em_rota').length}</div>
          </div>

          <div className="metric-card glass-card">
            <div className="metric-header">
              <span className="metric-icon">⏳</span>
              <span className="metric-title">Aguardando</span>
            </div>
            <div className="metric-value">{requests.filter(r => r.status === 'aguardando_distribuicao').length}</div>
          </div>

          <div className="metric-card glass-card">
            <div className="metric-header">
              <span className="metric-icon">✅</span>
              <span className="metric-title">Concluídas Hoje</span>
            </div>
            <div className="metric-value">
              {requests.filter(r => {
                const today = new Date().toDateString();
                return r.status === 'concluida' && new Date(r.updatedAt || r.createdAt).toDateString() === today;
              }).length}
            </div>
          </div>
        </div>

        <div className="recent-activity glass-card">
          <h3>Atividade Recente</h3>
          <div className="activity-list">
            {requests.slice(0, 10).map(request => (
              <div key={request.id} className="activity-item">
                <div className="activity-icon">
                  {request.status === 'em_rota' ? '🚗' :
                   request.status === 'concluida' ? '✅' :
                   request.status === 'cancelada' ? '❌' : '📋'}
                </div>
                <div className="activity-content">
                  <strong>{request.protocol}</strong>
                  <small>{request.clientName} - {request.destinationFacility}</small>
                  <span className={`status status-${request.status}`}>{request.status.replace('_', ' ')}</span>
                </div>
                <div className="activity-time">
                  {new Date(request.updatedAt || request.createdAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Advanced monitoring for managers and admins
  return (
    <div className="monitoring-dashboard admin-monitoring">
      <div className="section-head">
        <div className="section-toolbar">
          <h2>Centro de Monitoramento</h2>
          <div className="toolbar-actions">
            <select value={timeRange} onChange={(e) => setTimeRange(e.target.value as any)}>
              <option value="1h">Última hora</option>
              <option value="24h">Últimas 24h</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
            </select>
          </div>
        </div>
      </div>

      <div className="monitoring-tabs">
        <button
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Visão Geral
        </button>
        <button
          className={`tab-button ${activeTab === 'performance' ? 'active' : ''}`}
          onClick={() => setActiveTab('performance')}
        >
          ⚡ Performance
        </button>
        <button
          className={`tab-button ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          🔒 Segurança
        </button>
        {userRole === 'administrador' && (
          <button
            className={`tab-button ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            📋 Auditoria
          </button>
        )}
      </div>

      <div className="monitoring-content">
        {activeTab === 'overview' && (
          <div className="overview-grid">
            <div className="metric-card glass-card large">
              <div className="metric-header">
                <span className="metric-icon">📈</span>
                <span className="metric-title">Taxa de Conclusão</span>
              </div>
              <div className="metric-value">
                {requests.length > 0
                  ? Math.round((requests.filter(r => r.status === 'concluida').length / requests.length) * 100)
                  : 0}%
              </div>
              <div className="metric-trend positive">+5.2%</div>
            </div>

            <div className="metric-card glass-card">
              <div className="metric-header">
                <span className="metric-icon">👥</span>
                <span className="metric-title">Usuários Ativos</span>
              </div>
              <div className="metric-value">{users.filter(u => u.active !== false).length}</div>
            </div>

            <div className="metric-card glass-card">
              <div className="metric-header">
                <span className="metric-icon">🚗</span>
                <span className="metric-title">Viagens em Andamento</span>
              </div>
              <div className="metric-value">{requests.filter(r => r.status === 'em_rota').length}</div>
            </div>

            <div className="metric-card glass-card">
              <div className="metric-header">
                <span className="metric-icon">⚠️</span>
                <span className="metric-title">Alertas</span>
              </div>
              <div className="metric-value">2</div>
            </div>
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="performance-metrics">
            <div className="metric-card glass-card">
              <h3>Tempo Médio de Resposta</h3>
              <div className="metric-value">4.2 min</div>
              <div className="metric-chart">
                {/* Placeholder for performance chart */}
                <div className="chart-placeholder">📈 Gráfico de Performance</div>
              </div>
            </div>

            <div className="metric-card glass-card">
              <h3>Taxa de Ocupação da Frota</h3>
              <div className="metric-value">78%</div>
              <div className="metric-chart">
                <div className="chart-placeholder">🚗 Gráfico de Ocupação</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="security-dashboard">
            <div className="security-grid">
              <div className="metric-card glass-card">
                <div className="metric-header">
                  <span className="metric-icon">🔐</span>
                  <span className="metric-title">Tentativas de Login</span>
                </div>
                <div className="metric-value">1,247</div>
                <div className="metric-subtext">Últimas 24h</div>
              </div>

              <div className="metric-card glass-card">
                <div className="metric-header">
                  <span className="metric-icon">🚫</span>
                  <span className="metric-title">Tentativas Bloqueadas</span>
                </div>
                <div className="metric-value">3</div>
                <div className="metric-subtext">Suspeitas de ataque</div>
              </div>

              <div className="metric-card glass-card">
                <div className="metric-header">
                  <span className="metric-icon">📱</span>
                  <span className="metric-title">Sessões Ativas</span>
                </div>
                <div className="metric-value">{users.filter(u => u.lastLogin && new Date(u.lastLogin) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length}</div>
              </div>
            </div>

            <div className="recent-security-events glass-card">
              <h3>Eventos de Segurança Recentes</h3>
              <div className="security-events">
                <div className="security-event">
                  <div className="event-icon">🔐</div>
                  <div className="event-content">
                    <strong>Login suspeito detectado</strong>
                    <small>IP: 192.168.1.100 - Usuário: operador1</small>
                  </div>
                  <div className="event-time">2 min atrás</div>
                </div>
                <div className="security-event">
                  <div className="event-icon">🚫</div>
                  <div className="event-content">
                    <strong>Tentativa de acesso negado</strong>
                    <small>Recurso: /api/admin/users - IP: 10.0.0.50</small>
                  </div>
                  <div className="event-time">15 min atrás</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'audit' && userRole === 'administrador' && (
          <div className="audit-logs">
            <div className="audit-filters">
              <input type="text" placeholder="Buscar nos logs..." />
              <select>
                <option>Todas as ações</option>
                <option>Criação</option>
                <option>Edição</option>
                <option>Exclusão</option>
                <option>Login</option>
              </select>
            </div>

            <div className="audit-entries">
              <div className="audit-entry">
                <div className="entry-icon">👤</div>
                <div className="entry-content">
                  <strong>Usuário criado</strong>
                  <small>Operador: admin - Recurso: Usuários - ID: 12345</small>
                </div>
                <div className="entry-time">2024-01-15 14:30</div>
              </div>
              <div className="audit-entry">
                <div className="entry-icon">📋</div>
                <div className="entry-content">
                  <strong>Solicitação atualizada</strong>
                  <small>Operador: operador1 - Status: agendada → em_rota</small>
                </div>
                <div className="entry-time">2024-01-15 14:25</div>
              </div>
              <div className="audit-entry">
                <div className="entry-icon">🔒</div>
                <div className="entry-content">
                  <strong>Login realizado</strong>
                  <small>Usuário: gerente1 - IP: 192.168.1.50</small>
                </div>
                <div className="entry-time">2024-01-15 14:20</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
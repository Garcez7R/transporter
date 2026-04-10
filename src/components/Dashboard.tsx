import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from 'recharts';
import type { TripRequest, RequestStatus } from '../types';

type DashboardProps = {
  requests: TripRequest[];
  isLoading?: boolean;
};

const COLORS = {
  primary: '#3fb950',
  secondary: '#4fd7ff',
  warning: '#ffb454',
  danger: '#ff5a5f',
  muted: '#8d99a8'
};

const STATUS_COLORS = {
  rascunho: COLORS.muted,
  em_atendimento: COLORS.secondary,
  aguardando_distribuicao: COLORS.warning,
  agendada: COLORS.primary,
  em_rota: '#2ea043',
  concluida: '#168553',
  cancelada: COLORS.danger
};

export function Dashboard({ requests, isLoading = false }: DashboardProps) {
  const metrics = useMemo(() => {
    const total = requests.length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRequests = requests.filter(r => {
      const requestDate = new Date(r.departureAt);
      requestDate.setHours(0, 0, 0, 0);
      return requestDate.getTime() === today.getTime();
    });

    const pendingRequests = requests.filter(r =>
      ['rascunho', 'em_atendimento', 'aguardando_distribuicao'].includes(r.status)
    );

    const completedRequests = requests.filter(r => r.status === 'concluida');

    return {
      total,
      today: todayRequests.length,
      pending: pendingRequests.length,
      completed: completedRequests.length,
      completionRate: total > 0 ? Math.round((completedRequests.length / total) * 100) : 0
    };
  }, [requests]);

  const statusData = useMemo(() => {
    const statusCounts = requests.reduce((acc, request) => {
      acc[request.status] = (acc[request.status] || 0) + 1;
      return acc;
    }, {} as Record<RequestStatus, number>);

    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: count,
      color: STATUS_COLORS[status as RequestStatus] || COLORS.muted
    }));
  }, [requests]);

  const dailyData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date;
    });

    return last7Days.map(date => {
      const dayRequests = requests.filter(r => {
        const requestDate = new Date(r.departureAt);
        return requestDate.toDateString() === date.toDateString();
      });

      return {
        date: date.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' }),
        total: dayRequests.length,
        completed: dayRequests.filter(r => r.status === 'concluida').length
      };
    });
  }, [requests]);

  const driverPerformance = useMemo(() => {
    const driverStats = requests.reduce((acc, request) => {
      if (!request.driver) return acc;

      if (!acc[request.driver]) {
        acc[request.driver] = { total: 0, completed: 0 };
      }

      acc[request.driver]!.total++;
      if (request.status === 'concluida') {
        acc[request.driver]!.completed++;
      }

      return acc;
    }, {} as Record<string, { total: number; completed: number }>);

    return Object.entries(driverStats)
      .map(([driver, stats]) => ({
        driver: driver.length > 15 ? driver.substring(0, 15) + '...' : driver,
        fullName: driver,
        total: stats.total,
        completed: stats.completed,
        rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [requests]);

  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <div className="skeleton-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-card"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* KPIs Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon">📊</div>
          <div className="kpi-content">
            <span className="kpi-value">{metrics.total}</span>
            <span className="kpi-label">Total de solicitações</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon">📅</div>
          <div className="kpi-content">
            <span className="kpi-value">{metrics.today}</span>
            <span className="kpi-label">Solicitações hoje</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon">⏳</div>
          <div className="kpi-content">
            <span className="kpi-value">{metrics.pending}</span>
            <span className="kpi-label">Pendentes</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon">✅</div>
          <div className="kpi-content">
            <span className="kpi-value">{metrics.completed}</span>
            <span className="kpi-label">Concluídas</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon">📈</div>
          <div className="kpi-content">
            <span className="kpi-value">{metrics.completionRate}%</span>
            <span className="kpi-label">Taxa de conclusão</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Status Distribution */}
        <div className="chart-card">
          <h3>Distribuição por Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Daily Activity */}
        <div className="chart-card">
          <h3>Atividade Diária (7 dias)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="total"
                stackId="1"
                stroke={COLORS.primary}
                fill={COLORS.primary}
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="completed"
                stackId="2"
                stroke="#168553"
                fill="#168553"
                fillOpacity={0.8}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Driver Performance */}
        <div className="chart-card">
          <h3>Performance por Motorista</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={driverPerformance} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="driver" type="category" width={80} />
              <Tooltip
                formatter={(value, name) => [
                  name === 'total' ? `${value} viagens` : `${value}% concluídas`,
                  name === 'total' ? 'Total' : 'Taxa'
                ]}
                labelFormatter={(label) => {
                  const driver = driverPerformance.find(d => d.driver === label);
                  return driver?.fullName || label;
                }}
              />
              <Bar dataKey="total" fill={COLORS.secondary} />
              <Bar dataKey="rate" fill={COLORS.primary} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Trends */}
        <div className="chart-card">
          <h3>Tendências de Conclusão</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="completed"
                stroke={COLORS.primary}
                strokeWidth={3}
                dot={{ fill: COLORS.primary, strokeWidth: 2, r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
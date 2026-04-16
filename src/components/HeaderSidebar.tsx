import { useEffect, useMemo, useState } from 'react';
import type { AccessRole, SessionUser, TripRequest } from '../types';
import { splitDateTime } from '../lib/utils';

type NavItem = {
  id: string;
  label: string;
};

type SidebarQuickFilter = {
  id: string;
  label: string;
  count: number;
  helper: string;
  tone?: 'neutral' | 'accent' | 'warning' | 'danger';
};

type SidebarLocation = {
  label: string;
  count: number;
};

type SidebarConflict = {
  id: string;
  title: string;
  detail: string;
  tone: 'warning' | 'danger';
};

type HeaderSidebarProps = {
  session: SessionUser;
  roleLabels: Record<AccessRole, string>;
  internalNavItems: NavItem[];
  activeNav: string;
  onNavItemClick: (item: NavItem) => void;
  visibleRequestsCount: number;
  pendingToday: number;
  unreadMessages: number;
  pendingDispatch: number;
  inRoute: number;
  pendingConfirmations: number;
  pendingPinChange: number;
  requests: TripRequest[];
  selectedDate: string;
  onDateSelect: (date: string) => void;
  onDatePresetSelect: (preset: 'today' | 'tomorrow' | 'week' | 'clear') => void;
  quickFilters: SidebarQuickFilter[];
  onQuickFilterSelect: (id: string) => void;
  locations: SidebarLocation[];
  activeLocation: string;
  onLocationSelect: (location: string) => void;
  conflicts: SidebarConflict[];
  onConflictSelect: (conflictId: string) => void;
};

type CalendarDay = {
  iso: string;
  day: number;
  isToday: boolean;
  agendaCount: number;
  criticalCount: number;
  routeCount: number;
};

const weekLabels = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfWeekMonday(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + offset);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function buildCalendarDays(monthCursor: Date, requests: TripRequest[]) {
  const monthStart = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
  const monthEnd = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
  const monthLength = monthEnd.getDate();
  const todayIso = toIsoDate(new Date());
  const leadingEmptyDays = (() => {
    const startWeekday = monthStart.getDay();
    return startWeekday === 0 ? 6 : startWeekday - 1;
  })();

  const agendaMap = new Map<string, { agendaCount: number; criticalCount: number; routeCount: number }>();
  requests.forEach((request) => {
    const { date } = splitDateTime(request.departureAt);
    if (!date) return;
    const current = agendaMap.get(date) ?? { agendaCount: 0, criticalCount: 0, routeCount: 0 };
    current.agendaCount += 1;
    if (['aguardando_distribuicao', 'em_atendimento'].includes(request.status)) current.criticalCount += 1;
    if (request.status === 'em_rota') current.routeCount += 1;
    agendaMap.set(date, current);
  });

  const days: Array<CalendarDay | null> = Array.from({ length: leadingEmptyDays }, () => null);
  for (let dayNumber = 1; dayNumber <= monthLength; dayNumber += 1) {
    const cursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), dayNumber);
    const iso = toIsoDate(cursor);
    const signal = agendaMap.get(iso) ?? { agendaCount: 0, criticalCount: 0, routeCount: 0 };
    days.push({
      iso,
      day: dayNumber,
      isToday: iso === todayIso,
      agendaCount: signal.agendaCount,
      criticalCount: signal.criticalCount,
      routeCount: signal.routeCount
    });
  }

  const trailingEmptyDays = (7 - (days.length % 7)) % 7;
  for (let index = 0; index < trailingEmptyDays; index += 1) {
    days.push(null);
  }

  return days;
}

export function HeaderSidebar({
  session,
  roleLabels,
  internalNavItems,
  activeNav,
  onNavItemClick,
  visibleRequestsCount,
  pendingToday,
  unreadMessages,
  pendingDispatch,
  inRoute,
  pendingConfirmations,
  pendingPinChange,
  requests,
  selectedDate,
  onDateSelect,
  onDatePresetSelect,
  quickFilters,
  onQuickFilterSelect,
  locations,
  activeLocation,
  onLocationSelect,
  conflicts,
  onConflictSelect
}: HeaderSidebarProps) {
  const [monthCursor, setMonthCursor] = useState(() => {
    if (selectedDate) {
      const [year, month] = selectedDate.split('-').map(Number);
      if (year && month) return new Date(year, month - 1, 1);
    }
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  });

  useEffect(() => {
    if (!selectedDate) return;
    const [year, month] = selectedDate.split('-').map(Number);
    if (!year || !month) return;
    setMonthCursor(new Date(year, month - 1, 1));
  }, [selectedDate]);

  const calendarDays = useMemo(() => buildCalendarDays(monthCursor, requests), [monthCursor, requests]);
  const monthLabel = monthCursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const operationHighlights = useMemo(() => {
    const shared = [
      { label: 'Agenda visível', value: visibleRequestsCount, tone: 'neutral' },
      { label: 'Hoje', value: pendingToday, tone: 'accent' }
    ];

    if (session.role === 'operador') {
      return [
        ...shared,
        { label: 'Mensagens', value: unreadMessages, tone: 'warning' },
        { label: 'Sem confirmação', value: pendingConfirmations, tone: 'danger' }
      ];
    }

    if (session.role === 'gerente') {
      return [
        ...shared,
        { label: 'Sem motorista', value: pendingDispatch, tone: 'danger' },
        { label: 'Em rota', value: inRoute, tone: 'warning' }
      ];
    }

    if (session.role === 'motorista') {
      return [
        ...shared,
        { label: 'Em rota', value: inRoute, tone: 'warning' },
        { label: 'Mensagens', value: unreadMessages, tone: 'neutral' }
      ];
    }

    return [
      ...shared,
      { label: 'Confirmações', value: pendingConfirmations, tone: 'warning' },
      { label: 'PIN pendente', value: pendingPinChange, tone: 'danger' }
    ];
  }, [
    inRoute,
    pendingConfirmations,
    pendingDispatch,
    pendingPinChange,
    pendingToday,
    session.role,
    unreadMessages,
    visibleRequestsCount
  ]);

  return (
    <aside className="saas-sidebar">
      <div className="saas-sidebar-panel">
        <div className="saas-sidebar-brand">
          <div className="saas-sidebar-crest" aria-hidden="true">
            <span>T</span>
          </div>
          <div className="saas-sidebar-copy">
            <strong>Transporter</strong>
            <span>Central operacional</span>
          </div>
        </div>

        <div className="saas-sidebar-meta">
          <section className="saas-sidebar-module">
            <span className="saas-module-label">Operação</span>
            <div className="saas-module-card">
              <span>Canal</span>
              <strong>Transporte em saúde</strong>
            </div>
          </section>

          <section className="saas-sidebar-module">
            <span className="saas-module-label">Sessão</span>
            <div className="saas-sidebar-session">
              <div className="saas-sidebar-row">
                <span>Perfil</span>
                <strong>{roleLabels[session.role]}</strong>
              </div>
              <div className="saas-sidebar-row">
                <span>Usuário</span>
                <strong>{session.name}</strong>
              </div>
              <div className="saas-sidebar-row">
                <span>Solicitações</span>
                <strong>{visibleRequestsCount}</strong>
              </div>
            </div>
          </section>
        </div>

        <section className="saas-sidebar-module">
          <span className="saas-module-label">Radar operacional</span>
          <div className="saas-ops-grid">
            {operationHighlights.map((item) => (
              <div key={item.label} className={`saas-ops-card tone-${item.tone}`}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="saas-sidebar-module">
          <div className="saas-calendar-head">
            <span className="saas-module-label">Agenda operacional</span>
            <div className="saas-calendar-nav">
              <button type="button" className="saas-calendar-arrow" onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>
                ‹
              </button>
              <strong>{monthLabel}</strong>
              <button type="button" className="saas-calendar-arrow" onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>
                ›
              </button>
            </div>
          </div>

          <div className="saas-calendar-presets">
            <button type="button" className="saas-filter-chip" onClick={() => onDatePresetSelect('today')}>Hoje</button>
            <button type="button" className="saas-filter-chip" onClick={() => onDatePresetSelect('tomorrow')}>Amanhã</button>
            <button type="button" className="saas-filter-chip" onClick={() => onDatePresetSelect('week')}>Semana</button>
            <button type="button" className="saas-filter-chip" onClick={() => onDatePresetSelect('clear')}>Limpar</button>
          </div>

          <div className="saas-calendar">
            <div className="saas-calendar-weekdays">
              {weekLabels.map((label, index) => (
                <span key={`${label}-${index}`}>{label}</span>
              ))}
            </div>
            <div className="saas-calendar-grid">
              {calendarDays.map((day, index) => (
                day ? (
                  <button
                    key={day.iso}
                    type="button"
                    className={[
                      'saas-calendar-day',
                      day.isToday ? 'today' : '',
                      selectedDate === day.iso ? 'selected' : '',
                      day.criticalCount > 0 ? 'critical' : '',
                      day.routeCount > 0 ? 'in-route' : ''
                    ].filter(Boolean).join(' ')}
                    onClick={() => onDateSelect(day.iso)}
                  >
                    <span>{day.day}</span>
                    {day.agendaCount > 0 ? (
                      <small>{day.agendaCount}</small>
                    ) : null}
                  </button>
                ) : (
                  <span key={`empty-${index}`} className="saas-calendar-empty" aria-hidden="true"></span>
                )
              ))}
            </div>
          </div>

          <div className="saas-calendar-legend">
            <span><i className="tone-neutral"></i> agenda</span>
            <span><i className="tone-warning"></i> em rota</span>
            <span><i className="tone-danger"></i> crítico</span>
          </div>
        </section>

        {quickFilters.length ? (
          <section className="saas-sidebar-module">
            <span className="saas-module-label">Leituras rápidas</span>
            <div className="saas-quick-list">
              {quickFilters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  className={`saas-quick-card tone-${filter.tone ?? 'neutral'}`}
                  onClick={() => onQuickFilterSelect(filter.id)}
                >
                  <div>
                    <strong>{filter.label}</strong>
                    <span>{filter.helper}</span>
                  </div>
                  <b>{filter.count}</b>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {locations.length ? (
          <section className="saas-sidebar-module">
            <span className="saas-module-label">Hotspots do período</span>
            <div className="saas-hotspots">
              {locations.map((location) => (
                <button
                  key={location.label}
                  type="button"
                  className={`saas-hotspot ${activeLocation === location.label ? 'active' : ''}`}
                  onClick={() => onLocationSelect(location.label)}
                >
                  <span>{location.label}</span>
                  <strong>{location.count}</strong>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {conflicts.length ? (
          <section className="saas-sidebar-module">
            <span className="saas-module-label">Conflitos operacionais</span>
            <div className="saas-conflict-list">
              {conflicts.map((conflict) => (
                <button
                  key={conflict.id}
                  type="button"
                  className={`saas-conflict-card tone-${conflict.tone}`}
                  onClick={() => onConflictSelect(conflict.id)}
                >
                  <strong>{conflict.title}</strong>
                  <span>{conflict.detail}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <nav className="saas-sidebar-nav" aria-label="Navegação interna">
          {internalNavItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`saas-nav-link ${activeNav === item.id ? 'active' : ''}`}
              onClick={() => onNavItemClick(item)}
            >
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
      </div>
    </aside>
  );
}

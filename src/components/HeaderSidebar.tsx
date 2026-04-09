import type { AccessRole, SessionUser, TripRequest } from '../types';

type NavItem = {
  id: string;
  label: string;
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
};

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
  pendingPinChange
}: HeaderSidebarProps) {
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

        <div className="saas-sidebar-actions">
          {session.role === 'operador' ? (
            <>
              <div className="saas-action-item">
                <span>Solicitações hoje</span>
                <strong>{pendingToday}</strong>
              </div>
              <div className="saas-action-item">
                <span>Mensagens não lidas</span>
                <strong>{unreadMessages}</strong>
              </div>
            </>
          ) : null}
          {session.role === 'gerente' ? (
            <>
              <div className="saas-action-item">
                <span>Sem motorista</span>
                <strong>{pendingDispatch}</strong>
              </div>
              <div className="saas-action-item">
                <span>Em rota</span>
                <strong>{inRoute}</strong>
              </div>
            </>
          ) : null}
          {session.role === 'administrador' ? (
            <>
              <div className="saas-action-item">
                <span>Confirmações pendentes</span>
                <strong>{pendingConfirmations}</strong>
              </div>
              <div className="saas-action-item">
                <span>PINs para trocar</span>
                <strong>{pendingPinChange}</strong>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

import type { FormEvent } from 'react';
import type { AccessRole, SessionUser, UserFormState, UserRow } from '../types';

type UserTableProps = {
  session: SessionUser;
  users: UserRow[];
  userRoleFilter: AccessRole | 'todos';
  setUserRoleFilter: (value: AccessRole | 'todos') => void;
  userForm: UserFormState;
  setUserForm: (value: UserFormState) => void;
  handleCreateUser: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleResetUserPin: (user: UserRow) => Promise<void>;
  canViewUsers: boolean;
  roleLabels: Record<AccessRole, string>;
};

export function UserTable({
  session,
  users,
  userRoleFilter,
  setUserRoleFilter,
  userForm,
  setUserForm,
  handleCreateUser,
  handleResetUserPin,
  canViewUsers,
  roleLabels
}: UserTableProps) {
  if (!canViewUsers) return null;

  return (
    <section className="glass-card" id="usuarios">
      <div className="section-head">
        <p className="eyebrow">{session.role === 'gerente' ? 'Equipe' : 'Governança'}</p>
        <h2>{session.role === 'gerente' ? 'Operadores' : 'Usuários'}</h2>
      </div>
      {session.role === 'administrador' ? (
        <form className="admin-create-form" onSubmit={handleCreateUser}>
          <input placeholder="Nome" value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} />
          <input placeholder="CPF" value={userForm.document} onChange={(event) => setUserForm({ ...userForm, document: event.target.value })} />
          <select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value as AccessRole })}>
            <option value="cliente">paciente</option>
            <option value="operador">operador</option>
            <option value="gerente">gerente</option>
            <option value="motorista">motorista</option>
            <option value="administrador">administrador</option>
          </select>
          <button className="cta" type="submit">
            Criar usuário (PIN inicial 0000)
          </button>
        </form>
      ) : null}
      {session.role === 'administrador' ? (
        <div className="filter-row">
          <select value={userRoleFilter} onChange={(event) => setUserRoleFilter(event.target.value as AccessRole | 'todos')}>
            <option value="todos">Todos os perfis</option>
            <option value="cliente">Pacientes</option>
            <option value="operador">Operadores</option>
            <option value="gerente">Gerentes</option>
            <option value="motorista">Motoristas</option>
            <option value="administrador">Administradores</option>
          </select>
        </div>
      ) : null}
      {users.length ? (
        <div className="admin-table">
          <div className="admin-row admin-row-head">
            <span>Usuário</span>
            <span>Perfil</span>
            <span>CPF</span>
            <span>Status do PIN</span>
            <span>Ação</span>
          </div>
          <div className="admin-table-body">
            {users
              .filter((user) => (userRoleFilter === 'todos' ? true : user.role === userRoleFilter))
              .map((user) => (
                <div className="admin-row" key={user.id}>
                  <div className="admin-user">
                    <span className="admin-avatar">{user.name.trim().split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span>
                    <strong>{user.name}</strong>
                  </div>
                  <span>{roleLabels[user.role as AccessRole] ?? user.role}</span>
                  <span>{user.document.replace(/\D/g, '')}</span>
                  <span>{user.pinMustChange ? 'PIN inicial pendente' : 'PIN alterado'}</span>
                  <span>
                    {session.role === 'administrador' ? (
                      <button className="cta ghost" type="button" onClick={() => handleResetUserPin(user)}>
                        Resetar PIN
                      </button>
                    ) : (
                      '-'
                    )}
                  </span>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon"></div>
          <strong>Nenhum usuário cadastrado</strong>
          <p>Cadastre o primeiro operador, gerente, motorista ou paciente.</p>
        </div>
      )}
    </section>
  );
}

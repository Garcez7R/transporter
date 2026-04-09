import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { AccessRole, BannerState, SessionUser, ToastState, UserFormState, UserRow } from '../types';
import type { UserRow as ApiUserRow } from '../lib/api';
import { createUser, listUsers, resetUserPin } from '../lib/api';
import { normalizeDocument } from '../lib/persistence';

function normalizeApiUser(user: ApiUserRow): UserRow {
  return {
    id: user.id,
    name: user.name,
    document: user.document,
    role: user.role as AccessRole,
    pinMustChange: Boolean(user.pinMustChange),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt
  };
}

export type UseUsersResult = {
  users: UserRow[];
  userRoleFilter: AccessRole | 'todos';
  setUserRoleFilter: (value: AccessRole | 'todos') => void;
  userForm: UserFormState;
  setUserForm: (value: UserFormState) => void;
  handleCreateUser: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleResetUserPin: (user: UserRow) => Promise<void>;
};

export function useUsers(session: SessionUser | null, showBanner: (type: BannerState['type'], message: string) => void, pushToast: (type: ToastState['type'], message: string) => void): UseUsersResult {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userRoleFilter, setUserRoleFilter] = useState<AccessRole | 'todos'>('todos');
  const [userForm, setUserForm] = useState<UserFormState>({ name: '', document: '', role: 'operador' });

  useEffect(() => {
    if (!session?.token || !(session.role === 'administrador' || session.role === 'gerente')) {
      setUsers([]);
      return;
    }

    let cancelled = false;

    listUsers(session.token)
      .then((response) => {
        if (!cancelled) setUsers((response.rows ?? []).map(normalizeApiUser));
      })
      .catch(() => {
        if (!cancelled) showBanner('error', 'Não foi possível carregar os usuários.');
      });

    return () => {
      cancelled = true;
    };
  }, [session?.token, session?.role]);

  useEffect(() => {
    if (!session) return;
    if (session.role === 'gerente') {
      setUserRoleFilter('operador');
    }
  }, [session?.role]);

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.token || session.role !== 'administrador') return;

    try {
      await createUser(
        {
          name: userForm.name.trim(),
          document: normalizeDocument(userForm.document),
          role: userForm.role
        },
        session.token
      );

      setUserForm({ name: '', document: '', role: 'operador' });
      const response = await listUsers(session.token);
      setUsers((response.rows ?? []).map(normalizeApiUser));
      pushToast('success', 'Usuário criado com sucesso.');
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Não foi possível criar o usuário.');
    }
  }

  async function handleResetUserPin(user: UserRow) {
    if (!session?.token) return;

    try {
      await resetUserPin(user.id, session.token);
      pushToast('success', 'PIN resetado para 0000.');
      const response = await listUsers(session.token);
      setUsers((response.rows ?? []).map(normalizeApiUser));
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Não foi possível resetar o PIN.');
    }
  }

  return {
    users,
    userRoleFilter,
    setUserRoleFilter,
    userForm,
    setUserForm,
    handleCreateUser,
    handleResetUserPin
  };
}

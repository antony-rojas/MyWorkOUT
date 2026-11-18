import { useState } from 'react';
import { ArrowRight, Check, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import type { ManagedUser, UserRole } from '../types/workout';

interface UserManagementPanelProps {
  users: ManagedUser[];
  currentSessionUserId: string;
  activeProfileUserId: string | null;
  isConnectedToSheets: boolean;
  isSyncing: boolean;
  onCreateUser: (input: { nombre: string; password: string; rol: UserRole }) => Promise<void>;
  onUpdateUser: (
    id: string,
    updates: { nombre: string; password?: string; rol: UserRole }
  ) => Promise<void>;
  onDeleteUser: (id: string) => Promise<void>;
  onEnterProfile: (userId: string) => void;
  onRefreshUsers: () => Promise<void>;
}

export function UserManagementPanel({
  users,
  currentSessionUserId,
  activeProfileUserId,
  isConnectedToSheets,
  isSyncing,
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
  onEnterProfile,
  onRefreshUsers,
}: UserManagementPanelProps) {
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('usuario');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingPassword, setEditingPassword] = useState('');
  const [editingRole, setEditingRole] = useState<UserRole>('usuario');

  const [busyId, setBusyId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const clean = newName.trim();
    if (!clean) {
      setErrorMsg('Escribe un nombre para crear el usuario.');
      return;
    }
    if (!newPassword.trim()) {
      setErrorMsg('Asigna una contraseña para el usuario.');
      return;
    }
    if (users.some((u) => u.nombre.toLowerCase() === clean.toLowerCase())) {
      setErrorMsg('Ese usuario ya existe.');
      return;
    }

    setIsCreating(true);
    try {
      await onCreateUser({
        nombre: clean,
        password: newPassword.trim(),
        rol: newRole,
      });
      setNewName('');
      setNewPassword('');
      setNewRole('usuario');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo crear el usuario.');
    } finally {
      setIsCreating(false);
    }
  };

  const startEdit = (user: ManagedUser) => {
    setErrorMsg(null);
    setEditingId(user.id);
    setEditingName(user.nombre);
    setEditingPassword(user.password);
    setEditingRole(user.rol);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
    setEditingPassword('');
    setErrorMsg(null);
  };

  const handleSaveEdit = async (id: string) => {
    setErrorMsg(null);
    const clean = editingName.trim();
    if (!clean) {
      setErrorMsg('El nombre no puede quedar vacío.');
      return;
    }
    if (users.some((u) => u.id !== id && u.nombre.toLowerCase() === clean.toLowerCase())) {
      setErrorMsg('Ya existe otro usuario con ese nombre.');
      return;
    }

    setBusyId(id);
    try {
      await onUpdateUser(id, {
        nombre: clean,
        password: editingPassword.trim() || undefined,
        rol: editingRole,
      });
      setEditingId(null);
      setEditingName('');
      setEditingPassword('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo actualizar el usuario.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (user: ManagedUser) => {
    if (user.id === currentSessionUserId) {
      setErrorMsg('No puedes eliminar el usuario con el que tienes sesión iniciada.');
      return;
    }
    setErrorMsg(null);
    setBusyId(user.id);
    try {
      await onDeleteUser(user.id);
      if (editingId === user.id) {
        cancelEdit();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo eliminar el usuario.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Administrar usuarios
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Crea usuarios o ingresa a su perfil.
          </p>
        </div>

        {isConnectedToSheets && (
          <button
            type="button"
            onClick={onRefreshUsers}
            disabled={isSyncing}
            aria-label="Actualizar usuarios"
            className="p-1.5 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      <form onSubmit={handleCreate} className="mt-3 space-y-2">
        <div className="grid grid-cols-2 gap-1.5">
          <input
            id="new-user-name"
            type="text"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            placeholder="Usuario"
            aria-label="Nombre de usuario"
            className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-600"
          />
          <input
            id="new-user-pass"
            type="text"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            placeholder="Contraseña"
            aria-label="Contraseña"
            className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-600"
          />
        </div>

        <div className="flex gap-1.5">
          <select
            id="new-user-role"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as UserRole)}
            aria-label="Tipo de usuario"
            className="flex-1 h-8 px-2 text-xs font-medium bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-600 cursor-pointer"
          >
            <option value="usuario">Usuario</option>
            <option value="superadmin">Superadmin</option>
          </select>

          <button
            type="submit"
            disabled={isCreating || !newName.trim() || !newPassword.trim()}
            className="h-8 px-3 inline-flex items-center gap-1 text-xs font-medium text-white bg-slate-900 dark:bg-blue-600 rounded-lg hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Crear
          </button>
        </div>
      </form>

      {errorMsg && (
        <p className="mt-2 text-xs font-medium text-red-700 dark:text-red-400" role="alert">
          {errorMsg}
        </p>
      )}

      <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
        {users.map((user) => {
          const isEditing = editingId === user.id;
          const isBusy = busyId === user.id;
          const isViewingProfile = activeProfileUserId === user.id;

          return (
            <div key={user.id} className="py-2.5">
              {isEditing ? (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      placeholder="Nombre"
                      aria-label={`Editar nombre de ${user.nombre}`}
                      className="h-8 px-2 text-xs bg-white dark:bg-slate-950 border border-blue-500 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={editingPassword}
                      onChange={(e) => setEditingPassword(e.target.value)}
                      placeholder="Contraseña"
                      aria-label={`Editar contraseña de ${user.nombre}`}
                      className="h-8 px-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <select
                      value={editingRole}
                      onChange={(e) => setEditingRole(e.target.value as UserRole)}
                      aria-label={`Editar rol de ${user.nombre}`}
                      className="h-7 px-2 text-xs font-medium bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-200"
                    >
                      <option value="usuario">Usuario</option>
                      <option value="superadmin">Superadmin</option>
                    </select>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(user.id)}
                        disabled={isBusy}
                        aria-label="Guardar cambio"
                        className="p-1 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={isBusy}
                        aria-label="Cancelar edición"
                        className="p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                      {user.nombre}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {user.rol === 'superadmin' ? 'Superadmin' : 'Usuario'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEnterProfile(user.id)}
                      className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border transition-colors cursor-pointer ${
                        isViewingProfile
                          ? 'bg-slate-900 dark:bg-blue-600 text-white border-slate-900 dark:border-blue-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span>{isViewingProfile ? 'Activo' : 'Ingresar'}</span>
                      {!isViewingProfile && <ArrowRight className="w-3 h-3" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(user)}
                      disabled={isBusy}
                      aria-label={`Editar ${user.nombre}`}
                      className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {user.id !== currentSessionUserId && (
                      <button
                        type="button"
                        onClick={() => handleDelete(user)}
                        disabled={isBusy}
                        aria-label={`Eliminar ${user.nombre}`}
                        className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

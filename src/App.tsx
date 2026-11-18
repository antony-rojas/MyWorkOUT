import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dumbbell, LogOut, Menu, Settings, X } from 'lucide-react';
import { LoginView } from './components/LoginView';
import { SettingsView, type ThemeMode } from './components/SettingsView';
import { UserManagementPanel } from './components/UserManagementPanel';
import { UserProfileView } from './components/UserProfileView';
import { WeeklyComparisonTable } from './components/WeeklyComparisonTable';
import { WorkoutPlanManager } from './components/WorkoutPlanManager';
import type {
  ManagedUser,
  UserRole,
  WorkoutEntry,
  WorkoutFormInput,
  WorkoutPlan,
} from './types/workout';
import {
  addPlanToScript,
  addUserToScript,
  appendWorkoutBatchToScript,
  DEFAULT_SUPERADMIN_NAME,
  DEFAULT_SUPERADMIN_PASS,
  deletePlanFromScript,
  deleteUserFromScript,
  deleteWorkoutFromScript,
  ensureDefaultSuperadmin,
  fetchDataFromScript,
  getSamplePlans,
  getSampleUsers,
  getSampleWorkouts,
  getSavedAppsScriptUrl,
  getSavedSessionUserId,
  loadLocalPlans,
  loadLocalUsers,
  loadLocalWorkouts,
  saveAppsScriptUrl,
  saveLocalPlans,
  saveLocalUsers,
  saveLocalWorkouts,
  saveSessionUserId,
  updatePlanInScript,
  updateUserInScript,
} from './utils/appsScriptBridge';

type MainTab = 'entrenamientos' | 'configuracion';

const THEME_STORAGE_KEY = 'workout_tracker_theme_v1';

function getInitialTheme(): ThemeMode {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());
  const [activeTab, setActiveTab] = useState<MainTab>('entrenamientos');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [scriptUrl, setScriptUrl] = useState<string>(() => getSavedAppsScriptUrl());
  const [entries, setEntries] = useState<WorkoutEntry[]>(() =>
    getSavedAppsScriptUrl() ? [] : loadLocalWorkouts()
  );
  const [users, setUsers] = useState<ManagedUser[]>(() =>
    getSavedAppsScriptUrl() ? ensureDefaultSuperadmin([]) : loadLocalUsers()
  );
  const [plans, setPlans] = useState<WorkoutPlan[]>(() =>
    getSavedAppsScriptUrl() ? [] : loadLocalPlans()
  );

  const [sessionUserId, setSessionUserId] = useState<string>(() => getSavedSessionUserId());
  const [activeProfileUserId, setActiveProfileUserId] = useState<string | null>(() =>
    getSavedSessionUserId() || null
  );

  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(getSavedAppsScriptUrl()));
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  const sessionUser = useMemo(
    () => users.find((u) => u.id === sessionUserId) ?? null,
    [users, sessionUserId]
  );

  const syncFromSheets = useCallback(async (urlToUse: string) => {
    setIsLoading(true);
    setSyncError(null);
    try {
      const { workouts, users: remoteUsers, plans: remotePlans } =
        await fetchDataFromScript(urlToUse);
      setEntries(workouts);
      setUsers(remoteUsers);
      setPlans(remotePlans);
    } catch (err) {
      setSyncError(
        err instanceof Error
          ? `No se pudo leer desde Apps Script: ${err.message}`
          : 'No se pudo conectar con la URL de Google Apps Script.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (scriptUrl) {
      void syncFromSheets(scriptUrl);
    }
  }, [scriptUrl, syncFromSheets]);

  const handleConnect = async (url: string) => {
    setIsLoading(true);
    setSyncError(null);
    try {
      const { workouts, users: remoteUsers, plans: remotePlans } =
        await fetchDataFromScript(url);
      saveAppsScriptUrl(url);
      setScriptUrl(url);
      setEntries(workouts);
      setUsers(remoteUsers);
      setPlans(remotePlans);
    } catch (err) {
      setSyncError(
        err instanceof Error
          ? `Error al verificar el puente: ${err.message}`
          : 'Verifica que la URL esté implementada como Aplicación web con acceso para cualquier persona.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    saveAppsScriptUrl('');
    setScriptUrl('');
    setSyncError(null);
    setEntries(loadLocalWorkouts());
    setUsers(loadLocalUsers());
    setPlans(loadLocalPlans());
  };

  // --- Auth ---
  const handleLogin = (username: string, password: string): string | null => {
    const cleanUser = username.trim().toLowerCase();
    const match = users.find(
      (u) => u.nombre.trim().toLowerCase() === cleanUser && u.password === password
    );

    if (match) {
      setSessionUserId(match.id);
      saveSessionUserId(match.id);
      setActiveProfileUserId(match.id);
      setActiveTab('entrenamientos');
      return null;
    }

    if (
      cleanUser === DEFAULT_SUPERADMIN_NAME &&
      password === DEFAULT_SUPERADMIN_PASS
    ) {
      const ensured = ensureDefaultSuperadmin(users);
      setUsers(ensured);
      if (!scriptUrl) saveLocalUsers(ensured);
      const admin = ensured.find(
        (u) => u.nombre.toLowerCase() === DEFAULT_SUPERADMIN_NAME
      )!;
      setSessionUserId(admin.id);
      saveSessionUserId(admin.id);
      setActiveProfileUserId(admin.id);
      setActiveTab('entrenamientos');
      return null;
    }

    return 'Usuario o contraseña incorrectos.';
  };

  const handleLogout = () => {
    setSessionUserId('');
    saveSessionUserId('');
    setActiveProfileUserId(null);
    setActiveTab('entrenamientos');
    setMobileSidebarOpen(false);
  };

  // --- Workout Plans CRUD (Superadmin) ---
  const handleCreatePlan = async (nombre: string): Promise<WorkoutPlan> => {
    setSyncError(null);
    if (scriptUrl) {
      const created = await addPlanToScript(scriptUrl, nombre, []);
      setPlans((prev) => [...prev, created]);
      return created;
    } else {
      const now = new Date().toISOString();
      const created: WorkoutPlan = {
        id: crypto.randomUUID
          ? crypto.randomUUID()
          : `plan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nombre: nombre.trim(),
        ejercicios: [],
        createdAt: now,
        updatedAt: now,
      };
      setPlans((prev) => {
        const next = [...prev, created];
        saveLocalPlans(next);
        return next;
      });
      return created;
    }
  };

  const handleUpdatePlan = async (updatedPlan: WorkoutPlan) => {
    setSyncError(null);
    const now = new Date().toISOString();
    const nextPlan: WorkoutPlan = { ...updatedPlan, updatedAt: now };
    if (scriptUrl) {
      await updatePlanInScript(scriptUrl, nextPlan);
      setPlans((prev) => prev.map((p) => (p.id === nextPlan.id ? nextPlan : p)));
    } else {
      setPlans((prev) => {
        const next = prev.map((p) => (p.id === nextPlan.id ? nextPlan : p));
        saveLocalPlans(next);
        return next;
      });
    }
  };

  const handleDeletePlan = async (id: string) => {
    setSyncError(null);
    if (scriptUrl) {
      await deletePlanFromScript(scriptUrl, id);
      setPlans((prev) => prev.filter((p) => p.id !== id));
    } else {
      setPlans((prev) => {
        const next = prev.filter((p) => p.id !== id);
        saveLocalPlans(next);
        return next;
      });
    }
  };

  // --- User Management CRUD (Superadmin) ---
  const handleCreateUser = async (input: {
    nombre: string;
    password: string;
    rol: UserRole;
  }) => {
    setSyncError(null);
    if (scriptUrl) {
      const created = await addUserToScript(scriptUrl, input);
      setUsers((prev) => [...prev, created]);
    } else {
      const now = new Date().toISOString();
      const created: ManagedUser = {
        id: crypto.randomUUID
          ? crypto.randomUUID()
          : `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nombre: input.nombre.trim(),
        password: input.password,
        rol: input.rol,
        assignedPlanIds: [],
        createdAt: now,
        updatedAt: now,
      };
      setUsers((prev) => {
        const next = [...prev, created];
        saveLocalUsers(next);
        return next;
      });
    }
  };

  const handleUpdateUser = async (
    id: string,
    updates: { nombre: string; password?: string; rol: UserRole }
  ) => {
    const target = users.find((u) => u.id === id);
    if (!target) return;
    const previousName = target.nombre;
    const cleanName = updates.nombre.trim();
    setSyncError(null);

    if (scriptUrl) {
      await updateUserInScript(scriptUrl, {
        id,
        nombre: cleanName,
        password: updates.password,
        rol: updates.rol,
        previousName,
      });
    }

    const now = new Date().toISOString();
    setUsers((prev) => {
      const next = prev.map((u) =>
        u.id === id
          ? {
              ...u,
              nombre: cleanName,
              password: updates.password || u.password,
              rol: updates.rol,
              updatedAt: now,
            }
          : u
      );
      if (!scriptUrl) saveLocalUsers(next);
      return next;
    });

    if (previousName.toLowerCase() !== cleanName.toLowerCase()) {
      setEntries((prev) => {
        const next = prev.map((e) =>
          e.usuario.toLowerCase() === previousName.toLowerCase()
            ? { ...e, usuario: cleanName }
            : e
        );
        if (!scriptUrl) saveLocalWorkouts(next);
        return next;
      });
    }
  };

  const handleDeleteUser = async (id: string) => {
    setSyncError(null);
    if (scriptUrl) {
      await deleteUserFromScript(scriptUrl, id);
    }
    setUsers((prev) => {
      const next = prev.filter((u) => u.id !== id);
      if (!scriptUrl) saveLocalUsers(next);
      return next;
    });
    if (activeProfileUserId === id) {
      setActiveProfileUserId(sessionUser?.id ?? null);
    }
  };

  // --- Workout Logging ---
  const handleSaveProfileSets = async (inputs: WorkoutFormInput[]) => {
    setSyncError(null);
    if (scriptUrl) {
      const created = await appendWorkoutBatchToScript(scriptUrl, inputs);
      setEntries((prev) => [...created, ...prev]);
    } else {
      const now = new Date().toISOString();
      const created: WorkoutEntry[] = inputs.map((input, idx) => ({
        id: crypto.randomUUID
          ? crypto.randomUUID()
          : `local-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        ...input,
        createdAt: now,
      }));
      setEntries((prev) => {
        const next = [...created, ...prev];
        saveLocalWorkouts(next);
        return next;
      });
    }
  };

  const handleDeleteWorkout = async (id: string) => {
    setDeletingId(id);
    setSyncError(null);
    try {
      if (scriptUrl) {
        await deleteWorkoutFromScript(scriptUrl, id);
      }
      setEntries((prev) => {
        const next = prev.filter((item) => item.id !== id);
        if (!scriptUrl) saveLocalWorkouts(next);
        return next;
      });
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : 'No se pudo eliminar el registro.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearLocal = () => {
    setEntries([]);
    saveLocalWorkouts([]);
  };

  const handleLoadSampleLocal = () => {
    const sampleWorkouts = getSampleWorkouts();
    const sampleUsers = getSampleUsers();
    const samplePlans = getSamplePlans();
    setEntries(sampleWorkouts);
    saveLocalWorkouts(sampleWorkouts);
    if (plans.length === 0) {
      setPlans(samplePlans);
      saveLocalPlans(samplePlans);
    }
    if (users.length <= 1) {
      setUsers(sampleUsers);
      saveLocalUsers(sampleUsers);
    }
  };

  const existingExercises = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of plans) {
      for (const ej of p.ejercicios) {
        if (ej.trim() && !map.has(ej.toLowerCase())) {
          map.set(ej.toLowerCase(), ej.trim());
        }
      }
    }
    for (const item of entries) {
      const clean = item.ejercicio.trim();
      if (clean && !map.has(clean.toLowerCase())) {
        map.set(clean.toLowerCase(), clean);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'es'));
  }, [plans, entries]);

  if (!sessionUser) {
    return <LoginView isSyncing={isLoading} onLogin={handleLogin} />;
  }

  const isSuperadmin = sessionUser.rol === 'superadmin';
  const activeProfileUser = isSuperadmin
    ? users.find((u) => u.id === activeProfileUserId) ?? null
    : sessionUser;

  const visibleEntries = isSuperadmin
    ? entries
    : entries.filter(
        (e) => e.usuario.trim().toLowerCase() === sessionUser.nombre.trim().toLowerCase()
      );

  const sidebarContent = (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {sessionUser.nombre}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isSuperadmin ? 'Superadmin' : 'Usuario'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Salir
          </button>
        </div>

        <nav className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1" aria-label="Navegación principal">
          <button
            type="button"
            onClick={() => {
              setActiveTab('entrenamientos');
              setMobileSidebarOpen(false);
            }}
            className={`w-full h-9 px-3 flex items-center gap-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === 'entrenamientos'
                ? 'bg-slate-900 dark:bg-blue-600 text-white'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Dumbbell className="w-4 h-4 shrink-0" />
            Entrenamientos
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('configuracion');
              setMobileSidebarOpen(false);
            }}
            className={`w-full h-9 px-3 flex items-center gap-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === 'configuracion'
                ? 'bg-slate-900 dark:bg-blue-600 text-white'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            Configuración
          </button>
        </nav>

        {isSuperadmin && !scriptUrl && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400 dark:text-slate-500">Datos locales</span>
            {entries.length > 0 ? (
              <button
                type="button"
                onClick={handleClearLocal}
                className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 underline underline-offset-4 cursor-pointer"
              >
                Vaciar
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLoadSampleLocal}
                className="text-blue-700 dark:text-blue-400 hover:underline underline-offset-4 cursor-pointer"
              >
                Cargar ejemplo
              </button>
            )}
          </div>
        )}
      </div>

      {isSuperadmin && activeTab === 'entrenamientos' && (
        <>
          <WorkoutPlanManager
            plans={plans}
            existingExercises={existingExercises}
            onCreatePlan={handleCreatePlan}
            onUpdatePlan={handleUpdatePlan}
            onDeletePlan={handleDeletePlan}
          />

          <UserManagementPanel
            users={users}
            currentSessionUserId={sessionUser.id}
            activeProfileUserId={activeProfileUser?.id ?? null}
            isConnectedToSheets={Boolean(scriptUrl)}
            isSyncing={isLoading}
            onCreateUser={handleCreateUser}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
            onEnterProfile={(uid) => {
              setActiveProfileUserId(uid);
              setMobileSidebarOpen(false);
            }}
            onRefreshUsers={() => syncFromSheets(scriptUrl)}
          />
        </>
      )}
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Compact mobile bar to toggle Sidebar */}
        <div className="lg:hidden flex items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
              Registro de Entrenamientos
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {sessionUser.nombre} · {activeTab === 'configuracion' ? 'Configuración' : 'Entrenamientos'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMobileSidebarOpen((prev) => !prev)}
            className="h-10 px-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg cursor-pointer shrink-0"
          >
            {mobileSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            {mobileSidebarOpen ? 'Cerrar menú' : 'Menú'}
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Sidebar */}
          <aside
            className={`w-full lg:w-72 xl:w-80 shrink-0 ${
              mobileSidebarOpen ? 'block' : 'hidden lg:block'
            }`}
          >
            {sidebarContent}
          </aside>

          {/* Main Workspace */}
          <section className="flex-1 min-w-0 w-full space-y-6">
            <header className="hidden lg:block space-y-2 pb-1">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 text-balance">
                  Registro de Entrenamientos
                </h1>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="tabular-nums">
                    {visibleEntries.length}{' '}
                    {visibleEntries.length === 1 ? 'serie' : 'series'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {plans.length} {plans.length === 1 ? 'plan' : 'planes'}
                  </span>
                  {isSuperadmin && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>
                        {scriptUrl ? 'Google Sheets' : 'Modo local'}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
                Los planes, usuarios y series registradas se guardan en{' '}
                <strong className="font-semibold text-slate-900 dark:text-slate-100">
                  Google Sheets
                </strong>{' '}
                mediante Google Apps Script, con comparación semanal por cantidad de series.
              </p>
            </header>

            {activeTab === 'configuracion' ? (
              <SettingsView
                theme={theme}
                onChangeTheme={setTheme}
                isSuperadmin={isSuperadmin}
                connectedUrl={scriptUrl}
                isSyncing={isLoading}
                lastError={syncError}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onSync={() => syncFromSheets(scriptUrl)}
              />
            ) : (
              <div className="space-y-6">
                {activeProfileUser ? (
                  <UserProfileView
                    profileUser={activeProfileUser}
                    allPlans={plans}
                    entries={entries}
                    isSuperadminViewing={isSuperadmin}
                    deletingEntryId={deletingId}
                    onSaveProfileSets={handleSaveProfileSets}
                    onDeleteEntry={handleDeleteWorkout}
                    onCloseProfile={() => setActiveProfileUserId(null)}
                  />
                ) : (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Ningún perfil de usuario abierto
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Haz clic en «Ingresar» junto a cualquier usuario en el menú lateral para abrir su perfil.
                    </p>
                  </div>
                )}

                <WeeklyComparisonTable entries={visibleEntries} />
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

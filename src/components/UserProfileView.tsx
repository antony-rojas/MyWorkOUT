import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, History, Plus, Save, Trash2, User, X } from 'lucide-react';
import type { ManagedUser, WorkoutEntry, WorkoutFormInput, WorkoutPlan } from '../types/workout';
import {
  formatFullDateES,
  formatNumberES,
  formatShortDateES,
  getLocalTodayISO,
  normalizeDateString,
} from '../utils/workoutAnalytics';

interface UserProfileViewProps {
  profileUser: ManagedUser;
  allPlans: WorkoutPlan[];
  entries: WorkoutEntry[];
  isSuperadminViewing: boolean;
  deletingEntryId: string | null;
  onSaveProfileSets: (inputs: WorkoutFormInput[]) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
  onCloseProfile?: () => void;
}

interface ExerciseSetRow {
  rowId: string;
  serie: number;
  repeticiones: string;
  peso: string;
}

interface DateHistoryBucket {
  fecha: string;
  sets: WorkoutEntry[];
}

function getExerciseHistoryByDate(
  entries: WorkoutEntry[],
  userName: string,
  exerciseName: string
): DateHistoryBucket[] {
  const cleanUser = userName.trim().toLowerCase();
  const cleanExercise = exerciseName.trim().toLowerCase();

  const matching = entries.filter(
    (e) =>
      e.usuario.trim().toLowerCase() === cleanUser &&
      e.ejercicio.trim().toLowerCase() === cleanExercise
  );

  const byDate = new Map<string, WorkoutEntry[]>();
  for (const item of matching) {
    const dateISO = normalizeDateString(item.fecha);
    if (!byDate.has(dateISO)) {
      byDate.set(dateISO, []);
    }
    byDate.get(dateISO)!.push(item);
  }

  return Array.from(byDate.entries())
    .sort((a, b) => b[0].localeCompare(a[0])) // Newest date first
    .map(([fecha, sets]) => ({
      fecha,
      sets: [...sets].sort((a, b) => Number(a.serie) - Number(b.serie)),
    }));
}

function createInitialSetRows(count = 4): ExerciseSetRow[] {
  const stamp = Date.now();
  return Array.from({ length: count }, (_, idx) => ({
    rowId: `row-${stamp}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    serie: idx + 1,
    repeticiones: '',
    peso: '',
  }));
}

function sanitizeIntegerInput(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

function sanitizeDecimalInput(value: string): string {
  const normalized = value.replace(',', '.').replace(/[^0-9.]/g, '');
  const parts = normalized.split('.');
  if (parts.length <= 1) return normalized;
  return `${parts[0]}.${parts.slice(1).join('')}`;
}

export function UserProfileView({
  profileUser,
  allPlans,
  entries,
  isSuperadminViewing,
  deletingEntryId,
  onSaveProfileSets,
  onDeleteEntry,
  onCloseProfile,
}: UserProfileViewProps) {
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);
  const [openExerciseKey, setOpenExerciseKey] = useState<string | null>(null);
  const [historyModalExercise, setHistoryModalExercise] = useState<string | null>(null);

  const [rowsByExercise, setRowsByExercise] = useState<Record<string, ExerciseSetRow[]>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [exerciseErrors, setExerciseErrors] = useState<Record<string, string>>({});
  const [exerciseSuccess, setExerciseSuccess] = useState<Record<string, string>>({});

  useEffect(() => {
    setOpenPlanId(null);
    setOpenExerciseKey(null);
    setHistoryModalExercise(null);
    setExerciseErrors({});
    setExerciseSuccess({});
  }, [profileUser.id]);

  useEffect(() => {
    if (openPlanId && !allPlans.some((p) => p.id === openPlanId)) {
      setOpenPlanId(null);
      setOpenExerciseKey(null);
    }
  }, [allPlans, openPlanId]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setHistoryModalExercise(null);
      }
    };
    if (historyModalExercise) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [historyModalExercise]);

  const togglePlan = (planId: string) => {
    setOpenPlanId((prev) => {
      const next = prev === planId ? null : planId;
      setOpenExerciseKey(null);
      return next;
    });
  };

  const toggleExercise = (planId: string, exerciseName: string) => {
    const key = `${profileUser.id}:${planId}:${exerciseName}`;
    setOpenExerciseKey((prev) => {
      const next = prev === key ? null : key;
      if (next) {
        setRowsByExercise((current) =>
          current[next] ? current : { ...current, [next]: createInitialSetRows(4) }
        );
      }
      return next;
    });
  };

  const updateSetField = (
    exKey: string,
    rowId: string,
    field: 'repeticiones' | 'peso',
    value: string
  ) => {
    const cleaned = field === 'repeticiones' ? sanitizeIntegerInput(value) : sanitizeDecimalInput(value);
    setRowsByExercise((prev) => ({
      ...prev,
      [exKey]: (prev[exKey] || []).map((row) =>
        row.rowId === rowId ? { ...row, [field]: cleaned } : row
      ),
    }));
  };

  const addSetRow = (exKey: string) => {
    setRowsByExercise((prev) => {
      const current = prev[exKey] || createInitialSetRows(4);
      const last = current[current.length - 1];
      const nextRow: ExerciseSetRow = {
        rowId: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        serie: current.length + 1,
        repeticiones: last?.repeticiones ?? '',
        peso: last?.peso ?? '',
      };
      return {
        ...prev,
        [exKey]: [...current, nextRow],
      };
    });
  };

  const removeSetRow = (exKey: string, rowId: string) => {
    setRowsByExercise((prev) => {
      const current = prev[exKey] || [];
      if (current.length <= 1) return prev;
      const filtered = current
        .filter((r) => r.rowId !== rowId)
        .map((r, idx) => ({ ...r, serie: idx + 1 }));
      return {
        ...prev,
        [exKey]: filtered,
      };
    });
  };

  const handleSaveExercise = async (exKey: string, exerciseName: string) => {
    const rows = rowsByExercise[exKey] || [];
    setExerciseErrors((prev) => {
      const next = { ...prev };
      delete next[exKey];
      return next;
    });
    setExerciseSuccess((prev) => {
      const next = { ...prev };
      delete next[exKey];
      return next;
    });

    const filled = rows.filter(
      (r) => r.repeticiones.trim() !== '' || r.peso.trim() !== ''
    );
    if (filled.length === 0) {
      setExerciseErrors((prev) => ({
        ...prev,
        [exKey]: 'Ingresa al menos las repeticiones de una serie antes de guardar.',
      }));
      return;
    }

    const todayISO = getLocalTodayISO();
    const inputs: WorkoutFormInput[] = [];

    for (const r of filled) {
      const repsNum = Number(r.repeticiones);
      const pesoNum = r.peso.trim() === '' ? 0 : Number(r.peso);

      if (!Number.isFinite(repsNum) || repsNum < 1) {
        setExerciseErrors((prev) => ({
          ...prev,
          [exKey]: `Completa repeticiones válidas (mínimo 1) en S${r.serie}.`,
        }));
        return;
      }
      if (!Number.isFinite(pesoNum) || pesoNum < 0) {
        setExerciseErrors((prev) => ({
          ...prev,
          [exKey]: `Ingresa un peso válido en S${r.serie}.`,
        }));
        return;
      }

      inputs.push({
        usuario: profileUser.nombre,
        fecha: todayISO,
        ejercicio: exerciseName,
        serie: r.serie,
        repeticiones: Math.round(repsNum),
        peso: Math.round(pesoNum * 100) / 100,
      });
    }

    setSavingKey(exKey);
    try {
      await onSaveProfileSets(inputs);
      setExerciseSuccess((prev) => ({
        ...prev,
        [exKey]: `${inputs.length} ${inputs.length === 1 ? 'serie guardada' : 'series guardadas'} (${formatShortDateES(todayISO)}).`,
      }));
      setRowsByExercise((prev) => ({
        ...prev,
        [exKey]: createInitialSetRows(4),
      }));
      setTimeout(() => {
        setExerciseSuccess((prev) => {
          const next = { ...prev };
          delete next[exKey];
          return next;
        });
      }, 3500);
    } catch (err) {
      setExerciseErrors((prev) => ({
        ...prev,
        [exKey]: err instanceof Error ? err.message : 'No se pudieron guardar las series.',
      }));
    } finally {
      setSavingKey(null);
    }
  };

  const userEntries = useMemo(
    () =>
      entries.filter(
        (e) => e.usuario.trim().toLowerCase() === profileUser.nombre.trim().toLowerCase()
      ),
    [entries, profileUser.nombre]
  );

  const modalHistoryBuckets = useMemo(() => {
    if (!historyModalExercise) return [];
    return getExerciseHistoryByDate(userEntries, profileUser.nombre, historyModalExercise);
  }, [historyModalExercise, userEntries, profileUser.nombre]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Perfil de {profileUser.nombre}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{profileUser.rol === 'superadmin' ? 'Superadmin' : 'Usuario'}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {allPlans.length}{' '}
                {allPlans.length === 1 ? 'entrenamiento disponible' : 'entrenamientos disponibles'}
              </span>
            </div>
          </div>
        </div>

        {isSuperadminViewing && onCloseProfile && (
          <button
            type="button"
            onClick={onCloseProfile}
            className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 underline underline-offset-4 self-start sm:self-auto cursor-pointer"
          >
            Cerrar vista de perfil
          </button>
        )}
      </div>

      {allPlans.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            No hay entrenamientos creados todavía
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Una vez que se cree un entrenamiento, estará disponible aquí para todos los usuarios.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
          {allPlans.map((plan) => {
            const isPlanOpen = openPlanId === plan.id;

            return (
              <div key={plan.id} className="bg-white dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => togglePlan(plan.id)}
                  aria-expanded={isPlanOpen}
                  className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isPlanOpen ? (
                      <ChevronDown className="w-4 h-4 text-slate-700 dark:text-slate-200 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                    )}
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {plan.nombre}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 shrink-0">
                    <span className="tabular-nums">
                      {plan.ejercicios.length}{' '}
                      {plan.ejercicios.length === 1 ? 'ejercicio' : 'ejercicios'}
                    </span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {isPlanOpen ? 'Minimizar' : 'Abrir'}
                    </span>
                  </div>
                </button>

                {isPlanOpen && (
                  <div className="px-3 sm:px-4 pb-4 pt-2 bg-slate-50/70 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800">
                    {plan.ejercicios.length === 0 ? (
                      <p className="py-4 text-xs text-slate-500 dark:text-slate-400 text-center">
                        Este entrenamiento aún no tiene ejercicios asignados.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 overflow-hidden">
                        {plan.ejercicios.map((exerciseName, exIdx) => {
                          const exKey = `${profileUser.id}:${plan.id}:${exerciseName}`;
                          const isExerciseOpen = openExerciseKey === exKey;
                          const setRows = rowsByExercise[exKey] || createInitialSetRows(4);
                          const historyBuckets = isExerciseOpen
                            ? getExerciseHistoryByDate(userEntries, profileUser.nombre, exerciseName)
                            : [];
                          const lastSession = historyBuckets[0] ?? null;
                          const extraPastSets = lastSession
                            ? lastSession.sets.filter((s) => Number(s.serie) > setRows.length)
                            : [];

                          const isSaving = savingKey === exKey;
                          const errMsg = exerciseErrors[exKey];
                          const okMsg = exerciseSuccess[exKey];

                          return (
                            <div key={`${plan.id}-${exIdx}-${exerciseName}`}>
                              <div className="px-3.5 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                <button
                                  type="button"
                                  onClick={() => toggleExercise(plan.id, exerciseName)}
                                  aria-expanded={isExerciseOpen}
                                  className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                                >
                                  {isExerciseOpen ? (
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-700 dark:text-slate-200 shrink-0" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                                  )}
                                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                    {exerciseName}
                                  </span>
                                </button>

                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setHistoryModalExercise(exerciseName)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                                  >
                                    <History className="w-3 h-3" />
                                    Ver historial
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => toggleExercise(plan.id, exerciseName)}
                                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 whitespace-nowrap cursor-pointer hidden sm:inline"
                                  >
                                    {isExerciseOpen ? 'Cerrar' : 'Abrir'}
                                  </button>
                                </div>
                              </div>

                              {isExerciseOpen && (
                                <div className="px-3.5 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-900">
                                  <table className="w-full text-left border-collapse table-auto">
                                    <thead>
                                      <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                                        <th className="py-2 px-2 bg-slate-50 dark:bg-slate-800/60 rounded-tl-md whitespace-nowrap">
                                          {lastSession
                                            ? `Últ. (${formatShortDateES(lastSession.fecha)})`
                                            : 'Últ. registro'}
                                        </th>
                                        <th className="py-2 px-2 whitespace-nowrap">Serie</th>
                                        <th className="py-2 px-2 whitespace-nowrap">Reps</th>
                                        <th className="py-2 px-2 whitespace-nowrap">Peso (kg)</th>
                                        <th className="py-2 pl-1 text-right w-7">
                                          <span className="sr-only">Quitar</span>
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm">
                                      {setRows.map((row) => {
                                        const prevSet = lastSession?.sets.find(
                                          (s) => Number(s.serie) === row.serie
                                        );

                                        return (
                                          <tr key={row.rowId}>
                                            <td className="py-2 px-2 bg-slate-50/70 dark:bg-slate-800/30 border-r border-slate-100 dark:border-slate-800 font-mono tabular-nums text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                              {prevSet ? (
                                                <span>
                                                  <span className="text-slate-500 dark:text-slate-400">
                                                    S{prevSet.serie}:
                                                  </span>{' '}
                                                  <span className="font-medium text-slate-900 dark:text-slate-100">
                                                    {formatNumberES(prevSet.peso)} kg
                                                  </span>{' '}
                                                  <span className="text-slate-400 dark:text-slate-500">
                                                    ({prevSet.repeticiones}r)
                                                  </span>
                                                </span>
                                              ) : (
                                                <span className="text-slate-400 dark:text-slate-600">
                                                  —
                                                </span>
                                              )}
                                            </td>

                                            <td className="py-2 px-2 font-mono tabular-nums text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                              S{row.serie}
                                            </td>

                                            <td className="py-2 px-2">
                                              <input
                                                type="text"
                                                inputMode="numeric"
                                                value={row.repeticiones}
                                                onChange={(e) =>
                                                  updateSetField(
                                                    exKey,
                                                    row.rowId,
                                                    'repeticiones',
                                                    e.target.value
                                                  )
                                                }
                                                placeholder="10"
                                                aria-label={`Repeticiones S${row.serie} para ${exerciseName}`}
                                                className="w-14 h-8 px-1.5 text-center text-sm font-mono tabular-nums bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-blue-600"
                                              />
                                            </td>

                                            <td className="py-2 px-2">
                                              <input
                                                type="text"
                                                inputMode="decimal"
                                                value={row.peso}
                                                onChange={(e) =>
                                                  updateSetField(
                                                    exKey,
                                                    row.rowId,
                                                    'peso',
                                                    e.target.value
                                                  )
                                                }
                                                placeholder="60"
                                                aria-label={`Peso kg S${row.serie} para ${exerciseName}`}
                                                className="w-16 h-8 px-1.5 text-center text-sm font-mono tabular-nums bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-blue-600"
                                              />
                                            </td>

                                            <td className="py-2 pl-1 text-right">
                                              {setRows.length > 1 && (
                                                <button
                                                  type="button"
                                                  onClick={() => removeSetRow(exKey, row.rowId)}
                                                  aria-label={`Quitar S${row.serie}`}
                                                  className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors cursor-pointer"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>

                                  {extraPastSets.length > 0 && (
                                    <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                                      Series adicionales del último entrenamiento:{' '}
                                      {extraPastSets
                                        .map(
                                          (s) =>
                                            `S${s.serie}: ${formatNumberES(s.peso)} kg (${s.repeticiones}r)`
                                        )
                                        .join(' · ')}
                                    </p>
                                  )}

                                  {errMsg && (
                                    <p
                                      className="text-xs font-medium text-red-700 dark:text-red-400"
                                      role="alert"
                                    >
                                      {errMsg}
                                    </p>
                                  )}

                                  {okMsg && (
                                    <div
                                      className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                                      role="status"
                                    >
                                      <Check className="w-4 h-4 shrink-0" />
                                      <span>{okMsg}</span>
                                    </div>
                                  )}

                                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => addSetRow(exKey)}
                                      disabled={isSaving}
                                      className="h-8 px-3 inline-flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      Agregar serie
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleSaveExercise(exKey, exerciseName)}
                                      disabled={isSaving}
                                      className="h-8 px-3.5 inline-flex items-center gap-1.5 text-xs font-medium text-white bg-slate-900 dark:bg-blue-600 rounded-lg hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors disabled:opacity-50 cursor-pointer"
                                    >
                                      <Save className="w-3.5 h-3.5" />
                                      {isSaving ? 'Guardando...' : 'Guardar series'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal "Ver historial" por ejercicio y usuario */}
      {historyModalExercise && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs"
          onClick={() => setHistoryModalExercise(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-modal-title"
        >
          <div
            className="w-full max-w-lg max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
              <div>
                <h3
                  id="history-modal-title"
                  className="text-base font-semibold text-slate-900 dark:text-slate-100"
                >
                  Historial · {historyModalExercise}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Todos los registros guardados de {profileUser.nombre} ordenados por fecha
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalExercise(null)}
                aria-label="Cerrar historial"
                className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5">
              {modalHistoryBuckets.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Sin registros guardados todavía
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Cuando guardes series en este ejercicio aparecerán aquí con su fecha.
                  </p>
                </div>
              ) : (
                modalHistoryBuckets.map((bucket) => (
                  <div
                    key={bucket.fecha}
                    className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden"
                  >
                    <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                        {formatFullDateES(bucket.fecha)}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                        {bucket.sets.length}{' '}
                        {bucket.sets.length === 1 ? 'serie' : 'series'}
                      </span>
                    </div>

                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {bucket.sets.map((entry) => (
                          <tr
                            key={entry.id}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                          >
                            <td className="py-2 px-3.5 font-mono tabular-nums font-medium text-slate-700 dark:text-slate-300 w-16">
                              S{entry.serie}
                            </td>
                            <td className="py-2 px-3 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                              {entry.repeticiones} reps
                            </td>
                            <td className="py-2 px-3 font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                              {formatNumberES(entry.peso)} kg
                            </td>
                            <td className="py-2 px-2 text-right w-10">
                              <button
                                type="button"
                                onClick={() => onDeleteEntry(entry.id)}
                                disabled={deletingEntryId === entry.id}
                                aria-label={`Eliminar serie S${entry.serie}`}
                                className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors disabled:opacity-40 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { ArrowLeft, Check, FolderOpen, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import type { WorkoutPlan } from '../types/workout';

interface WorkoutPlanManagerProps {
  plans: WorkoutPlan[];
  existingExercises: string[];
  onCreatePlan: (nombre: string) => Promise<WorkoutPlan>;
  onUpdatePlan: (plan: WorkoutPlan) => Promise<void>;
  onDeletePlan: (id: string) => Promise<void>;
}

const DEFAULT_EXERCISES = [
  'Press de banca',
  'Sentadilla',
  'Peso muerto',
  'Dominadas',
  'Press militar',
  'Remo con barra',
  'Hip thrust',
  'Curl de bíceps',
  'Fondos en paralelas',
];

export function WorkoutPlanManager({
  plans,
  existingExercises,
  onCreatePlan,
  onUpdatePlan,
  onDeletePlan,
}: WorkoutPlanManagerProps) {
  const [newPlanName, setNewPlanName] = useState('');
  const [activePlanId, setActivePlanId] = useState<string | null>(null);

  const [editingListPlanId, setEditingListPlanId] = useState<string | null>(null);
  const [editingListPlanName, setEditingListPlanName] = useState('');
  const [isEditingActiveName, setIsEditingActiveName] = useState(false);

  const [draftName, setDraftName] = useState('');
  const [draftExercises, setDraftExercises] = useState<string[]>([]);
  const [newExerciseName, setNewExerciseName] = useState('');

  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  const activePlan = plans.find((p) => p.id === activePlanId) ?? null;

  useEffect(() => {
    if (activePlan) {
      setDraftName(activePlan.nombre);
      setDraftExercises(activePlan.ejercicios);
      setIsEditingActiveName(false);
    }
  }, [activePlanId, activePlan?.id]);

  const exerciseSuggestions = Array.from(
    new Set([...existingExercises, ...DEFAULT_EXERCISES])
  ).sort((a, b) => a.localeCompare(b, 'es'));

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSavedBanner(null);

    const clean = newPlanName.trim();
    if (!clean) {
      setErrorMsg('Escribe el nombre del entrenamiento.');
      return;
    }
    if (plans.some((p) => p.nombre.toLowerCase() === clean.toLowerCase())) {
      setErrorMsg('Ya existe un entrenamiento con ese nombre.');
      return;
    }

    setIsCreating(true);
    try {
      const created = await onCreatePlan(clean);
      setNewPlanName('');
      setActivePlanId(created.id);
      setDraftName(created.nombre);
      setDraftExercises(created.ejercicios);
      setIsEditingActiveName(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo crear el entrenamiento.');
    } finally {
      setIsCreating(false);
    }
  };

  const startRenameInList = (plan: WorkoutPlan) => {
    setErrorMsg(null);
    setEditingListPlanId(plan.id);
    setEditingListPlanName(plan.nombre);
  };

  const cancelRenameInList = () => {
    setEditingListPlanId(null);
    setEditingListPlanName('');
  };

  const saveRenameInList = async (plan: WorkoutPlan) => {
    const clean = editingListPlanName.trim();
    if (!clean) {
      setErrorMsg('El nombre del entrenamiento no puede quedar vacío.');
      return;
    }
    if (plans.some((p) => p.id !== plan.id && p.nombre.toLowerCase() === clean.toLowerCase())) {
      setErrorMsg('Ya existe otro entrenamiento con ese nombre.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    try {
      await onUpdatePlan({ ...plan, nombre: clean });
      setEditingListPlanId(null);
      setEditingListPlanName('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo cambiar el nombre.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddExerciseToDraft = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const clean = newExerciseName.trim();
    if (!clean) {
      setErrorMsg('Escribe el nombre del ejercicio para agregarlo.');
      return;
    }
    setDraftExercises((prev) => [...prev, clean]);
    setNewExerciseName('');
  };

  const handleRemoveExerciseFromDraft = (index: number) => {
    setDraftExercises((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSavePlan = async () => {
    if (!activePlan) return;
    setErrorMsg(null);
    setSavedBanner(null);

    const cleanName = draftName.trim();
    if (!cleanName) {
      setErrorMsg('El nombre del entrenamiento no puede estar vacío.');
      return;
    }
    if (
      plans.some(
        (p) => p.id !== activePlan.id && p.nombre.toLowerCase() === cleanName.toLowerCase()
      )
    ) {
      setErrorMsg('Ya existe otro entrenamiento con ese nombre.');
      return;
    }

    setIsSaving(true);
    try {
      await onUpdatePlan({
        ...activePlan,
        nombre: cleanName,
        ejercicios: draftExercises,
      });
      setIsEditingActiveName(false);
      setSavedBanner('Entrenamiento guardado.');
      setTimeout(() => setSavedBanner(null), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo guardar el entrenamiento.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingPlanId(id);
    setErrorMsg(null);
    try {
      await onDeletePlan(id);
      if (activePlanId === id) {
        setActivePlanId(null);
      }
      if (editingListPlanId === id) {
        cancelRenameInList();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo eliminar el entrenamiento.');
    } finally {
      setDeletingPlanId(null);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5">
      {!activePlan ? (
        <>
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Crear entrenamiento
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Disponible para todos los usuarios.
            </p>
          </div>

          <form onSubmit={handleCreatePlan} className="mt-3 space-y-2">
            <label htmlFor="new-plan-name" className="sr-only">
              Nombre del entrenamiento
            </label>
            <div className="flex gap-2">
              <input
                id="new-plan-name"
                type="text"
                value={newPlanName}
                onChange={(e) => {
                  setNewPlanName(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Nombre del entrenamiento..."
                className="flex-1 min-w-0 h-9 px-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-600"
              />
              <button
                type="submit"
                disabled={isCreating || !newPlanName.trim()}
                className="h-9 px-3 inline-flex items-center gap-1 text-xs font-medium text-white bg-slate-900 dark:bg-blue-600 rounded-lg hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Crear
              </button>
            </div>
          </form>

          {errorMsg && (
            <p className="mt-2.5 text-xs font-medium text-red-700 dark:text-red-400" role="alert">
              {errorMsg}
            </p>
          )}

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Entrenamientos
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-400 dark:text-slate-500">
                {plans.length}
              </span>
            </div>

            {plans.length === 0 ? (
              <p className="py-3 text-xs text-slate-500 dark:text-slate-400 text-center">
                Sin entrenamientos creados.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {plans.map((plan) => {
                  const isRenaming = editingListPlanId === plan.id;

                  return (
                    <div key={plan.id} className="py-2">
                      {isRenaming ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editingListPlanName}
                            onChange={(e) => setEditingListPlanName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void saveRenameInList(plan);
                              } else if (e.key === 'Escape') {
                                cancelRenameInList();
                              }
                            }}
                            aria-label={`Editar nombre de ${plan.nombre}`}
                            className="flex-1 min-w-0 h-8 px-2 text-xs bg-white dark:bg-slate-950 border border-blue-500 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => saveRenameInList(plan)}
                            disabled={isSaving}
                            aria-label="Guardar nombre"
                            className="p-1 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded cursor-pointer shrink-0"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={cancelRenameInList}
                            disabled={isSaving}
                            aria-label="Cancelar edición"
                            className="p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                              {plan.nombre}
                            </p>
                            <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 shrink-0">
                              {plan.ejercicios.length} ej.
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => startRenameInList(plan)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setErrorMsg(null);
                                setSavedBanner(null);
                                setActivePlanId(plan.id);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                            >
                              <FolderOpen className="w-3 h-3" />
                              Ingresar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(plan.id)}
                              disabled={deletingPlanId === plan.id}
                              aria-label={`Eliminar entrenamiento ${plan.nombre}`}
                              className="ml-auto p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors disabled:opacity-40 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setActivePlanId(null);
                setErrorMsg(null);
                setSavedBanner(null);
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver
            </button>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-mono tabular-nums">
              {draftExercises.length} ej.
            </span>
          </div>

          <div className="mt-3 space-y-3">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Entrenamiento
                </span>
                {!isEditingActiveName && (
                  <button
                    type="button"
                    onClick={() => setIsEditingActiveName(true)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                    Editar
                  </button>
                )}
              </div>

              {isEditingActiveName ? (
                <div className="flex items-center gap-1.5">
                  <input
                    id="edit-plan-name"
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    aria-label="Editar nombre del entrenamiento"
                    className="flex-1 min-w-0 h-9 px-2.5 text-sm font-medium bg-white dark:bg-slate-950 border border-blue-500 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setDraftName(activePlan.nombre);
                      setIsEditingActiveName(false);
                    }}
                    className="h-9 px-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {draftName}
                </h3>
              )}
            </div>

            <form
              onSubmit={handleAddExerciseToDraft}
              className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800"
            >
              <label
                htmlFor="add-exercise-to-plan"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Nombre del ejercicio
              </label>
              <div className="flex gap-1.5">
                <input
                  id="add-exercise-to-plan"
                  type="text"
                  list="plan-exercises-datalist"
                  value={newExerciseName}
                  onChange={(e) => {
                    setNewExerciseName(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Ej. Press inclinado"
                  className="flex-1 min-w-0 h-9 px-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-600"
                />
                <datalist id="plan-exercises-datalist">
                  {exerciseSuggestions.map((ex) => (
                    <option key={ex} value={ex} />
                  ))}
                </datalist>
                <button
                  type="submit"
                  disabled={!newExerciseName.trim()}
                  className="h-9 px-2.5 inline-flex items-center gap-1 text-xs font-medium text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar
                </button>
              </div>
            </form>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-2">
              {draftExercises.length === 0 ? (
                <p className="py-3 text-xs text-slate-500 dark:text-slate-400 text-center">
                  Agrega ejercicios y guarda.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {draftExercises.map((exName, idx) => (
                    <li
                      key={`${exName}-${idx}`}
                      className="py-1.5 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono tabular-nums text-slate-400 dark:text-slate-500 w-4 shrink-0">
                          {idx + 1}.
                        </span>
                        <span className="text-slate-800 dark:text-slate-200 truncate">
                          {exName}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveExerciseFromDraft(idx)}
                        aria-label={`Quitar ${exName}`}
                        className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors cursor-pointer shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {errorMsg && (
              <p className="text-xs font-medium text-red-700 dark:text-red-400" role="alert">
                {errorMsg}
              </p>
            )}

            {savedBanner && (
              <div
                className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                role="status"
              >
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>{savedBanner}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSavePlan}
              disabled={isSaving}
              className="w-full h-9 inline-flex items-center justify-center gap-1.5 px-3 text-xs font-medium text-white bg-slate-900 dark:bg-blue-600 rounded-lg hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? 'Guardando...' : 'Guardar entrenamiento'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

import type { ManagedUser, UserRole, WorkoutEntry, WorkoutFormInput, WorkoutPlan } from '../types/workout';
import { addDays, getLocalTodayISO, getWeekWindows, normalizeDateString } from './workoutAnalytics';

const STORAGE_URL_KEY = 'workout_tracker_apps_script_url_v1';
const STORAGE_LOCAL_DATA_KEY = 'workout_tracker_local_entries_v1';
const STORAGE_LOCAL_USERS_KEY = 'workout_tracker_local_users_v2';
const STORAGE_LOCAL_PLANS_KEY = 'workout_tracker_local_plans_v1';
const STORAGE_SESSION_KEY = 'workout_tracker_session_user_id_v1';

export const DEFAULT_SUPERADMIN_NAME = 'antony';
export const DEFAULT_SUPERADMIN_PASS = '022189';

export const APPS_SCRIPT_TEMPLATE = `// Pega este código en Google Sheets > Extensiones > Apps Script
const WORKOUT_SHEET_NAME = 'Entrenamientos';
const WORKOUT_HEADERS = ['id', 'fecha', 'usuario', 'ejercicio', 'serie', 'repeticiones', 'peso', 'createdAt'];

const USERS_SHEET_NAME = 'Usuarios';
const USER_HEADERS = ['id', 'nombre', 'password', 'rol', 'assignedPlanIds', 'createdAt', 'updatedAt'];

const PLANS_SHEET_NAME = 'Planes';
const PLAN_HEADERS = ['id', 'nombre', 'ejerciciosJson', 'createdAt', 'updatedAt'];

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
  return sheet;
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function safeParseJsonArray(raw) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function doGet() {
  try {
    const workoutSheet = getOrCreateSheet(WORKOUT_SHEET_NAME, WORKOUT_HEADERS);
    const userSheet = getOrCreateSheet(USERS_SHEET_NAME, USER_HEADERS);
    const planSheet = getOrCreateSheet(PLANS_SHEET_NAME, PLAN_HEADERS);
    const tz = Session.getScriptTimeZone();

    var workouts = [];
    const lastWorkoutRow = workoutSheet.getLastRow();
    if (lastWorkoutRow > 1) {
      const values = workoutSheet.getRange(2, 1, lastWorkoutRow - 1, WORKOUT_HEADERS.length).getValues();
      workouts = values
        .filter(function (row) { return row[0] !== '' && row[2] !== ''; })
        .map(function (row) {
          var rawDate = row[1];
          var fechaStr = rawDate instanceof Date
            ? Utilities.formatDate(rawDate, tz, 'yyyy-MM-dd')
            : String(rawDate).slice(0, 10);

          return {
            id: String(row[0]),
            fecha: fechaStr,
            usuario: String(row[2]),
            ejercicio: String(row[3]),
            serie: Number(row[4]) || 1,
            repeticiones: Number(row[5]) || 0,
            peso: Number(row[6]) || 0,
            createdAt: row[7] ? String(row[7]) : ''
          };
        });
    }

    var users = [];
    const lastUserRow = userSheet.getLastRow();
    if (lastUserRow > 1) {
      const userValues = userSheet.getRange(2, 1, lastUserRow - 1, USER_HEADERS.length).getValues();
      users = userValues
        .filter(function (row) { return row[0] !== '' && row[1] !== ''; })
        .map(function (row) {
          return {
            id: String(row[0]),
            nombre: String(row[1]),
            password: String(row[2] || ''),
            rol: String(row[3] || 'usuario') === 'superadmin' ? 'superadmin' : 'usuario',
            assignedPlanIds: safeParseJsonArray(row[4]),
            createdAt: row[5] ? String(row[5]) : '',
            updatedAt: row[6] ? String(row[6]) : ''
          };
        });
    }

    var plans = [];
    const lastPlanRow = planSheet.getLastRow();
    if (lastPlanRow > 1) {
      const planValues = planSheet.getRange(2, 1, lastPlanRow - 1, PLAN_HEADERS.length).getValues();
      plans = planValues
        .filter(function (row) { return row[0] !== '' && row[1] !== ''; })
        .map(function (row) {
          return {
            id: String(row[0]),
            nombre: String(row[1]),
            ejercicios: safeParseJsonArray(row[2]),
            createdAt: row[3] ? String(row[3]) : '',
            updatedAt: row[4] ? String(row[4]) : ''
          };
        });
    }

    return jsonResponse({ status: 'ok', data: workouts, users: users, plans: plans });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action || 'add';

    // --- USUARIOS ---
    if (action === 'addUser') {
      const userSheet = getOrCreateSheet(USERS_SHEET_NAME, USER_HEADERS);
      const now = new Date().toISOString();
      const user = {
        id: body.id || Utilities.getUuid(),
        nombre: String(body.nombre || '').trim(),
        password: String(body.password || '123456'),
        rol: body.rol === 'superadmin' ? 'superadmin' : 'usuario',
        assignedPlanIds: Array.isArray(body.assignedPlanIds) ? body.assignedPlanIds : [],
        createdAt: body.createdAt || now,
        updatedAt: now
      };
      userSheet.appendRow([
        user.id,
        user.nombre,
        user.password,
        user.rol,
        JSON.stringify(user.assignedPlanIds),
        user.createdAt,
        user.updatedAt
      ]);
      return jsonResponse({ status: 'ok', user: user });
    }

    if (action === 'updateUser' && body.id) {
      const userSheet = getOrCreateSheet(USERS_SHEET_NAME, USER_HEADERS);
      const lastUserRow = userSheet.getLastRow();
      var previousName = body.previousName ? String(body.previousName).trim() : '';
      const newName = String(body.nombre || '').trim();
      const now = new Date().toISOString();

      if (lastUserRow > 1) {
        const rows = userSheet.getRange(2, 1, lastUserRow - 1, USER_HEADERS.length).getValues();
        for (var i = 0; i < rows.length; i++) {
          if (String(rows[i][0]) === String(body.id)) {
            if (!previousName) previousName = String(rows[i][1]).trim();
            if (newName) userSheet.getRange(i + 2, 2).setValue(newName);
            if (typeof body.password === 'string' && body.password !== '') {
              userSheet.getRange(i + 2, 3).setValue(body.password);
            }
            if (body.rol === 'superadmin' || body.rol === 'usuario') {
              userSheet.getRange(i + 2, 4).setValue(body.rol);
            }
            if (Array.isArray(body.assignedPlanIds)) {
              userSheet.getRange(i + 2, 5).setValue(JSON.stringify(body.assignedPlanIds));
            }
            userSheet.getRange(i + 2, 7).setValue(now);
            break;
          }
        }
      }

      if (previousName && newName && previousName.toLowerCase() !== newName.toLowerCase()) {
        const workoutSheet = getOrCreateSheet(WORKOUT_SHEET_NAME, WORKOUT_HEADERS);
        const lastWorkoutRow = workoutSheet.getLastRow();
        if (lastWorkoutRow > 1) {
          const userCol = workoutSheet.getRange(2, 3, lastWorkoutRow - 1, 1).getValues();
          for (var j = 0; j < userCol.length; j++) {
            if (String(userCol[j][0]).trim().toLowerCase() === previousName.toLowerCase()) {
              workoutSheet.getRange(j + 2, 3).setValue(newName);
            }
          }
        }
      }

      return jsonResponse({ status: 'ok', updatedAt: now });
    }

    if (action === 'deleteUser' && body.id) {
      const userSheet = getOrCreateSheet(USERS_SHEET_NAME, USER_HEADERS);
      const lastUserRow = userSheet.getLastRow();
      if (lastUserRow > 1) {
        const ids = userSheet.getRange(2, 1, lastUserRow - 1, 1).getValues();
        for (var i = ids.length - 1; i >= 0; i--) {
          if (String(ids[i][0]) === String(body.id)) {
            userSheet.deleteRow(i + 2);
            return jsonResponse({ status: 'ok', deletedId: body.id });
          }
        }
      }
      return jsonResponse({ status: 'error', message: 'Usuario no encontrado' });
    }

    // --- PLANES DE ENTRENAMIENTO ---
    if (action === 'addPlan') {
      const planSheet = getOrCreateSheet(PLANS_SHEET_NAME, PLAN_HEADERS);
      const now = new Date().toISOString();
      const plan = {
        id: body.id || Utilities.getUuid(),
        nombre: String(body.nombre || '').trim(),
        ejercicios: Array.isArray(body.ejercicios) ? body.ejercicios : [],
        createdAt: body.createdAt || now,
        updatedAt: now
      };
      planSheet.appendRow([
        plan.id,
        plan.nombre,
        JSON.stringify(plan.ejercicios),
        plan.createdAt,
        plan.updatedAt
      ]);
      return jsonResponse({ status: 'ok', plan: plan });
    }

    if (action === 'updatePlan' && body.id) {
      const planSheet = getOrCreateSheet(PLANS_SHEET_NAME, PLAN_HEADERS);
      const lastPlanRow = planSheet.getLastRow();
      const now = new Date().toISOString();
      if (lastPlanRow > 1) {
        const rows = planSheet.getRange(2, 1, lastPlanRow - 1, PLAN_HEADERS.length).getValues();
        for (var p = 0; p < rows.length; p++) {
          if (String(rows[p][0]) === String(body.id)) {
            if (body.nombre) planSheet.getRange(p + 2, 2).setValue(String(body.nombre).trim());
            if (Array.isArray(body.ejercicios)) {
              planSheet.getRange(p + 2, 3).setValue(JSON.stringify(body.ejercicios));
            }
            planSheet.getRange(p + 2, 5).setValue(now);
            return jsonResponse({ status: 'ok', updatedAt: now });
          }
        }
      }
      return jsonResponse({ status: 'error', message: 'Entrenamiento no encontrado' });
    }

    if (action === 'deletePlan' && body.id) {
      const planSheet = getOrCreateSheet(PLANS_SHEET_NAME, PLAN_HEADERS);
      const lastPlanRow = planSheet.getLastRow();
      if (lastPlanRow > 1) {
        const ids = planSheet.getRange(2, 1, lastPlanRow - 1, 1).getValues();
        for (var i = ids.length - 1; i >= 0; i--) {
          if (String(ids[i][0]) === String(body.id)) {
            planSheet.deleteRow(i + 2);
            return jsonResponse({ status: 'ok', deletedId: body.id });
          }
        }
      }
      return jsonResponse({ status: 'error', message: 'Entrenamiento no encontrado' });
    }

    // --- ENTRENAMIENTOS (REGISTROS DE SERIES) ---
    const workoutSheet = getOrCreateSheet(WORKOUT_SHEET_NAME, WORKOUT_HEADERS);

    if (action === 'delete' && body.id) {
      const lastRow = workoutSheet.getLastRow();
      if (lastRow > 1) {
        const ids = workoutSheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = ids.length - 1; i >= 0; i--) {
          if (String(ids[i][0]) === String(body.id)) {
            workoutSheet.deleteRow(i + 2);
            return jsonResponse({ status: 'ok', deletedId: body.id });
          }
        }
      }
      return jsonResponse({ status: 'error', message: 'Registro no encontrado' });
    }

    if (action === 'addBatch' && Array.isArray(body.entries)) {
      const savedEntries = [];
      const rowsToAppend = [];
      for (var k = 0; k < body.entries.length; k++) {
        var item = body.entries[k];
        var entry = {
          id: item.id || Utilities.getUuid(),
          fecha: String(item.fecha || '').slice(0, 10),
          usuario: String(item.usuario || '').trim(),
          ejercicio: String(item.ejercicio || '').trim(),
          serie: Number(item.serie) || 1,
          repeticiones: Number(item.repeticiones) || 0,
          peso: Number(item.peso) || 0,
          createdAt: item.createdAt || new Date().toISOString()
        };
        savedEntries.push(entry);
        rowsToAppend.push([
          entry.id,
          entry.fecha,
          entry.usuario,
          entry.ejercicio,
          entry.serie,
          entry.repeticiones,
          entry.peso,
          entry.createdAt
        ]);
      }
      if (rowsToAppend.length > 0) {
        workoutSheet
          .getRange(workoutSheet.getLastRow() + 1, 1, rowsToAppend.length, WORKOUT_HEADERS.length)
          .setValues(rowsToAppend);
      }
      return jsonResponse({ status: 'ok', entries: savedEntries });
    }

    const entry = {
      id: body.id || Utilities.getUuid(),
      fecha: String(body.fecha || '').slice(0, 10),
      usuario: String(body.usuario || '').trim(),
      ejercicio: String(body.ejercicio || '').trim(),
      serie: Number(body.serie) || 1,
      repeticiones: Number(body.repeticiones) || 0,
      peso: Number(body.peso) || 0,
      createdAt: body.createdAt || new Date().toISOString()
    };

    workoutSheet.appendRow([
      entry.id,
      entry.fecha,
      entry.usuario,
      entry.ejercicio,
      entry.serie,
      entry.repeticiones,
      entry.peso,
      entry.createdAt
    ]);

    return jsonResponse({ status: 'ok', entry: entry });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}`;

export function isValidAppsScriptUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'script.google.com' ||
        parsed.hostname === 'script.googleusercontent.com')
    );
  } catch {
    return false;
  }
}

export function getSavedAppsScriptUrl(): string {
  try {
    return localStorage.getItem(STORAGE_URL_KEY) || '';
  } catch {
    return '';
  }
}

export function saveAppsScriptUrl(url: string): void {
  try {
    const trimmed = url.trim();
    if (trimmed) {
      localStorage.setItem(STORAGE_URL_KEY, trimmed);
    } else {
      localStorage.removeItem(STORAGE_URL_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function getSavedSessionUserId(): string {
  try {
    return localStorage.getItem(STORAGE_SESSION_KEY) || '';
  } catch {
    return '';
  }
}

export function saveSessionUserId(userId: string): void {
  try {
    if (userId) {
      localStorage.setItem(STORAGE_SESSION_KEY, userId);
    } else {
      localStorage.removeItem(STORAGE_SESSION_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

function normalizeRemoteEntry(raw: Record<string, unknown>, idx: number): WorkoutEntry {
  return {
    id: raw.id ? String(raw.id) : `row-${idx}-${Date.now()}`,
    fecha: normalizeDateString(raw.fecha),
    usuario: String(raw.usuario ?? '').trim(),
    ejercicio: String(raw.ejercicio ?? '').trim(),
    serie: Math.max(1, Number(raw.serie) || 1),
    repeticiones: Math.max(0, Number(raw.repeticiones) || 0),
    peso: Math.max(0, Number(raw.peso) || 0),
    createdAt: raw.createdAt ? String(raw.createdAt) : undefined,
  };
}

function normalizeRemoteUser(raw: Record<string, unknown>, idx: number): ManagedUser {
  const rol: UserRole = raw.rol === 'superadmin' ? 'superadmin' : 'usuario';
  return {
    id: raw.id ? String(raw.id) : `usr-${idx}-${Date.now()}`,
    nombre: String(raw.nombre ?? '').trim(),
    password: raw.password ? String(raw.password) : '123456',
    rol,
    assignedPlanIds: Array.isArray(raw.assignedPlanIds)
      ? raw.assignedPlanIds.map((item) => String(item))
      : [],
    createdAt: raw.createdAt ? String(raw.createdAt) : undefined,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : undefined,
  };
}

function normalizeRemotePlan(raw: Record<string, unknown>, idx: number): WorkoutPlan {
  return {
    id: raw.id ? String(raw.id) : `plan-${idx}-${Date.now()}`,
    nombre: String(raw.nombre ?? '').trim(),
    ejercicios: Array.isArray(raw.ejercicios)
      ? raw.ejercicios.map((e) => String(e).trim()).filter(Boolean)
      : [],
    createdAt: raw.createdAt ? String(raw.createdAt) : undefined,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : undefined,
  };
}

export function ensureDefaultSuperadmin(users: ManagedUser[]): ManagedUser[] {
  const hasAntony = users.some(
    (u) => u.nombre.toLowerCase() === DEFAULT_SUPERADMIN_NAME.toLowerCase()
  );
  if (hasAntony) return users;
  const now = new Date().toISOString();
  return [
    {
      id: 'usr-antony-superadmin',
      nombre: DEFAULT_SUPERADMIN_NAME,
      password: DEFAULT_SUPERADMIN_PASS,
      rol: 'superadmin',
      assignedPlanIds: [],
      createdAt: now,
      updatedAt: now,
    },
    ...users,
  ];
}

async function postToScript(scriptUrl: string, payload: Record<string, unknown>) {
  const response = await fetch(scriptUrl.trim(), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Error de red (${response.status})`);
  }

  const json = await response.json();
  if (json.status === 'error') {
    throw new Error(json.message || 'Apps Script devolvió un error');
  }
  return json;
}

export async function fetchDataFromScript(scriptUrl: string): Promise<{
  workouts: WorkoutEntry[];
  users: ManagedUser[];
  plans: WorkoutPlan[];
}> {
  const response = await fetch(scriptUrl.trim(), {
    method: 'GET',
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`El servidor respondió con estado ${response.status}`);
  }

  const json = await response.json();
  if (json.status === 'error') {
    throw new Error(json.message || 'Error al leer datos desde Apps Script');
  }

  const rawWorkouts = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
  const workouts: WorkoutEntry[] = rawWorkouts
    .map((item: Record<string, unknown>, idx: number) => normalizeRemoteEntry(item, idx))
    .filter((entry: WorkoutEntry) => entry.usuario !== '' && entry.ejercicio !== '');

  let users: ManagedUser[] = [];
  if (Array.isArray(json.users) && json.users.length > 0) {
    users = json.users
      .map((item: Record<string, unknown>, idx: number) => normalizeRemoteUser(item, idx))
      .filter((u: ManagedUser) => u.nombre !== '');
  } else {
    const derivedNames = new Map<string, string>();
    for (const w of workouts) {
      if (!derivedNames.has(w.usuario.toLowerCase())) {
        derivedNames.set(w.usuario.toLowerCase(), w.usuario);
      }
    }
    users = Array.from(derivedNames.values()).map((nombre, idx) => ({
      id: `derived-${idx}-${nombre.toLowerCase().replace(/\s+/g, '-')}`,
      nombre,
      password:
        nombre.toLowerCase() === DEFAULT_SUPERADMIN_NAME
          ? DEFAULT_SUPERADMIN_PASS
          : '123456',
      rol: nombre.toLowerCase() === DEFAULT_SUPERADMIN_NAME ? 'superadmin' : 'usuario',
      assignedPlanIds: [],
    }));
  }

  users = ensureDefaultSuperadmin(users);

  const rawPlans = Array.isArray(json.plans) ? json.plans : [];
  const plans: WorkoutPlan[] = rawPlans
    .map((item: Record<string, unknown>, idx: number) => normalizeRemotePlan(item, idx))
    .filter((p: WorkoutPlan) => p.nombre !== '');

  return { workouts, users, plans };
}

export async function appendWorkoutBatchToScript(
  scriptUrl: string,
  inputs: WorkoutFormInput[]
): Promise<WorkoutEntry[]> {
  const now = new Date().toISOString();
  const newEntries: WorkoutEntry[] = inputs.map((input, idx) => ({
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : `w-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    ...input,
    usuario: input.usuario.trim(),
    ejercicio: input.ejercicio.trim(),
    fecha: normalizeDateString(input.fecha),
    createdAt: now,
  }));

  const json = await postToScript(scriptUrl, {
    action: 'addBatch',
    entries: newEntries,
  });

  if (Array.isArray(json.entries)) {
    return json.entries.map((item: Record<string, unknown>, idx: number) =>
      normalizeRemoteEntry(item, idx)
    );
  }
  return newEntries;
}

export async function deleteWorkoutFromScript(scriptUrl: string, id: string): Promise<void> {
  await postToScript(scriptUrl, {
    action: 'delete',
    id,
  });
}

export async function addUserToScript(
  scriptUrl: string,
  input: { nombre: string; password: string; rol: UserRole }
): Promise<ManagedUser> {
  const now = new Date().toISOString();
  const payload: ManagedUser = {
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

  const json = await postToScript(scriptUrl, {
    action: 'addUser',
    ...payload,
  });

  return json.user ? normalizeRemoteUser(json.user, 0) : payload;
}

export async function updateUserInScript(
  scriptUrl: string,
  payload: {
    id: string;
    nombre: string;
    password?: string;
    rol?: UserRole;
    assignedPlanIds?: string[];
    previousName: string;
  }
): Promise<void> {
  await postToScript(scriptUrl, {
    action: 'updateUser',
    ...payload,
  });
}

export async function deleteUserFromScript(scriptUrl: string, id: string): Promise<void> {
  await postToScript(scriptUrl, {
    action: 'deleteUser',
    id,
  });
}

export async function addPlanToScript(
  scriptUrl: string,
  nombre: string,
  ejercicios: string[] = []
): Promise<WorkoutPlan> {
  const now = new Date().toISOString();
  const payload: WorkoutPlan = {
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : `plan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    nombre: nombre.trim(),
    ejercicios,
    createdAt: now,
    updatedAt: now,
  };

  const json = await postToScript(scriptUrl, {
    action: 'addPlan',
    ...payload,
  });

  return json.plan ? normalizeRemotePlan(json.plan, 0) : payload;
}

export async function updatePlanInScript(
  scriptUrl: string,
  plan: WorkoutPlan
): Promise<void> {
  await postToScript(scriptUrl, {
    action: 'updatePlan',
    id: plan.id,
    nombre: plan.nombre.trim(),
    ejercicios: plan.ejercicios,
  });
}

export async function deletePlanFromScript(scriptUrl: string, id: string): Promise<void> {
  await postToScript(scriptUrl, {
    action: 'deletePlan',
    id,
  });
}

// --- Local Fallbacks & Sample Data ---
export function getSamplePlans(): WorkoutPlan[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'plan-empuje',
      nombre: 'Empuje (Pecho y Hombro)',
      ejercicios: ['Press de banca', 'Press militar', 'Fondos en paralelas'],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'plan-pierna',
      nombre: 'Pierna Fuerza',
      ejercicios: ['Sentadilla', 'Peso muerto rumano', 'Hip thrust'],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function getSampleUsers(): ManagedUser[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'usr-antony-superadmin',
      nombre: DEFAULT_SUPERADMIN_NAME,
      password: DEFAULT_SUPERADMIN_PASS,
      rol: 'superadmin',
      assignedPlanIds: ['plan-empuje'],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'usr-carlos',
      nombre: 'Carlos',
      password: '123456',
      rol: 'usuario',
      assignedPlanIds: ['plan-empuje'],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'usr-sofia',
      nombre: 'Sofía',
      password: '123456',
      rol: 'usuario',
      assignedPlanIds: ['plan-pierna'],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function loadLocalUsers(): ManagedUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_LOCAL_USERS_KEY);
    if (!raw) {
      const seeded = getSampleUsers();
      localStorage.setItem(STORAGE_LOCAL_USERS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : getSampleUsers();
    const ensured = ensureDefaultSuperadmin(list);
    return ensured;
  } catch {
    return getSampleUsers();
  }
}

export function saveLocalUsers(users: ManagedUser[]): void {
  try {
    localStorage.setItem(STORAGE_LOCAL_USERS_KEY, JSON.stringify(users));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadLocalPlans(): WorkoutPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_LOCAL_PLANS_KEY);
    if (!raw) {
      const seeded = getSamplePlans();
      localStorage.setItem(STORAGE_LOCAL_PLANS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return getSamplePlans();
  }
}

export function saveLocalPlans(plans: WorkoutPlan[]): void {
  try {
    localStorage.setItem(STORAGE_LOCAL_PLANS_KEY, JSON.stringify(plans));
  } catch {
    // Ignore storage quota errors
  }
}

export function getSampleWorkouts(refDate: Date = new Date()): WorkoutEntry[] {
  const { currentStart, previousStart } = getWeekWindows(refDate);
  const twoWeeksAgoStart = addDays(previousStart, -7);
  const d = (base: Date, offset: number) => getLocalTodayISO(addDays(base, offset));

  return [
    {
      id: 'demo-1',
      usuario: 'Carlos',
      fecha: d(currentStart, 0),
      ejercicio: 'Press de banca',
      serie: 1,
      repeticiones: 10,
      peso: 75,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-2',
      usuario: 'Carlos',
      fecha: d(currentStart, 0),
      ejercicio: 'Press de banca',
      serie: 2,
      repeticiones: 8,
      peso: 80,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-3',
      usuario: 'Carlos',
      fecha: d(currentStart, 0),
      ejercicio: 'Press militar',
      serie: 1,
      repeticiones: 10,
      peso: 45,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-4',
      usuario: 'Sofía',
      fecha: d(currentStart, 0),
      ejercicio: 'Sentadilla',
      serie: 1,
      repeticiones: 10,
      peso: 65,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-5',
      usuario: 'Sofía',
      fecha: d(currentStart, 1),
      ejercicio: 'Peso muerto rumano',
      serie: 1,
      repeticiones: 12,
      peso: 60,
      createdAt: new Date().toISOString(),
    },
    // Semana anterior
    {
      id: 'demo-6',
      usuario: 'Carlos',
      fecha: d(previousStart, 1),
      ejercicio: 'Press de banca',
      serie: 1,
      repeticiones: 10,
      peso: 70,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-6b',
      usuario: 'Carlos',
      fecha: d(previousStart, 1),
      ejercicio: 'Press de banca',
      serie: 2,
      repeticiones: 10,
      peso: 72.5,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-7',
      usuario: 'Carlos',
      fecha: d(previousStart, 3),
      ejercicio: 'Press militar',
      serie: 1,
      repeticiones: 8,
      peso: 42.5,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-8',
      usuario: 'Sofía',
      fecha: d(previousStart, 2),
      ejercicio: 'Sentadilla',
      serie: 1,
      repeticiones: 10,
      peso: 60,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-9',
      usuario: 'Sofía',
      fecha: d(previousStart, 4),
      ejercicio: 'Hip thrust',
      serie: 1,
      repeticiones: 10,
      peso: 70,
      createdAt: new Date().toISOString(),
    },
    // Hace 2 semanas (para completar 3 fechas históricas en ejemplo)
    {
      id: 'demo-10',
      usuario: 'Carlos',
      fecha: d(twoWeeksAgoStart, 1),
      ejercicio: 'Press de banca',
      serie: 1,
      repeticiones: 10,
      peso: 67.5,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-11',
      usuario: 'Carlos',
      fecha: d(twoWeeksAgoStart, 1),
      ejercicio: 'Press de banca',
      serie: 2,
      repeticiones: 8,
      peso: 70,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-12',
      usuario: 'Sofía',
      fecha: d(twoWeeksAgoStart, 2),
      ejercicio: 'Sentadilla',
      serie: 1,
      repeticiones: 10,
      peso: 55,
      createdAt: new Date().toISOString(),
    },
  ];
}

export function loadLocalWorkouts(): WorkoutEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_LOCAL_DATA_KEY);
    if (!raw) {
      const seeded = getSampleWorkouts();
      localStorage.setItem(STORAGE_LOCAL_DATA_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return getSampleWorkouts();
  }
}

export function saveLocalWorkouts(entries: WorkoutEntry[]): void {
  try {
    localStorage.setItem(STORAGE_LOCAL_DATA_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage quota errors
  }
}

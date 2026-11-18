import type { UserWeeklyComparison, WorkoutEntry } from '../types/workout';

/**
 * Returns YYYY-MM-DD in local calendar time without UTC timezone drift.
 */
export function getLocalTodayISO(baseDate: Date = new Date()): string {
  const y = baseDate.getFullYear();
  const m = String(baseDate.getMonth() + 1).padStart(2, '0');
  const d = String(baseDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Normalizes incoming date strings (e.g. "2026-11-16", "2026-11-16T00:00:00.000Z")
 * to YYYY-MM-DD.
 */
export function normalizeDateString(raw: unknown): string {
  if (typeof raw !== 'string') {
    return getLocalTodayISO();
  }
  const trimmed = raw.trim();
  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    return isoMatch[1];
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return getLocalTodayISO(parsed);
  }
  return getLocalTodayISO();
}

export function parseLocalDate(dateStr: string): Date {
  const normalized = normalizeDateString(dateStr);
  const [y, m, d] = normalized.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Computes Monday (00:00:00) through Sunday (23:59:59) for the week containing `refDate`,
 * plus the immediately preceding Monday–Sunday week.
 */
export function getWeekWindows(refDate: Date = new Date()) {
  const todayLocal = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  const dayOfWeek = todayLocal.getDay(); // 0 = Sun, 1 = Mon, ...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const currentStart = addDays(todayLocal, diffToMonday);
  const currentEnd = addDays(currentStart, 6);
  const previousStart = addDays(currentStart, -7);
  const previousEnd = addDays(currentStart, -1);

  return {
    currentStart,
    currentEnd,
    previousStart,
    previousEnd,
    currentStartISO: getLocalTodayISO(currentStart),
    currentEndISO: getLocalTodayISO(currentEnd),
    previousStartISO: getLocalTodayISO(previousStart),
    previousEndISO: getLocalTodayISO(previousEnd),
  };
}

export function formatShortDateES(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function formatFullDateES(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatNumberES(value: number, maxDecimals = 1): string {
  return new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: maxDecimals,
  }).format(value);
}

export function computePercentageChange(current: number, previous: number): number | null {
  if (previous === 0) {
    if (current === 0) return 0;
    return null; // No prior baseline
  }
  return ((current - previous) / previous) * 100;
}

export function formatPercentageES(pct: number | null): string {
  if (pct === null) {
    return 'Nuevo';
  }
  const sign = pct > 0 ? '+' : '';
  return `${sign}${new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(pct)}%`;
}

/**
 * Computes weekly comparison per user strictly by number of weekly sets (series).
 */
export function computeWeeklyComparisonByUser(
  entries: WorkoutEntry[],
  refDate: Date = new Date()
): {
  windows: ReturnType<typeof getWeekWindows>;
  rows: UserWeeklyComparison[];
} {
  const windows = getWeekWindows(refDate);
  const byUser = new Map<
    string,
    {
      displayName: string;
      actualSeries: number;
      anteriorSeries: number;
    }
  >();

  for (const entry of entries) {
    const cleanUser = entry.usuario.trim();
    if (!cleanUser) continue;
    const key = cleanUser.toLowerCase();

    if (!byUser.has(key)) {
      byUser.set(key, {
        displayName: cleanUser,
        actualSeries: 0,
        anteriorSeries: 0,
      });
    }

    const bucket = byUser.get(key)!;
    const dateISO = normalizeDateString(entry.fecha);

    if (dateISO >= windows.currentStartISO && dateISO <= windows.currentEndISO) {
      bucket.actualSeries += 1;
    } else if (dateISO >= windows.previousStartISO && dateISO <= windows.previousEndISO) {
      bucket.anteriorSeries += 1;
    }
  }

  const rows: UserWeeklyComparison[] = Array.from(byUser.values())
    .filter((item) => item.actualSeries > 0 || item.anteriorSeries > 0)
    .map((item) => ({
      usuario: item.displayName,
      seriesSemanaActual: item.actualSeries,
      seriesSemanaAnterior: item.anteriorSeries,
      cambioSeriesPct: computePercentageChange(item.actualSeries, item.anteriorSeries),
    }))
    .sort((a, b) => {
      if (b.seriesSemanaActual !== a.seriesSemanaActual) {
        return b.seriesSemanaActual - a.seriesSemanaActual;
      }
      return a.usuario.localeCompare(b.usuario, 'es');
    });

  return { windows, rows };
}

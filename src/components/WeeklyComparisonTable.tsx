import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { WorkoutEntry } from '../types/workout';
import {
  computeWeeklyComparisonByUser,
  formatPercentageES,
  formatShortDateES,
} from '../utils/workoutAnalytics';

interface WeeklyComparisonTableProps {
  entries: WorkoutEntry[];
}

export function WeeklyComparisonTable({ entries }: WeeklyComparisonTableProps) {
  const { windows, rows } = computeWeeklyComparisonByUser(entries);

  const currentRangeLabel = `${formatShortDateES(windows.currentStartISO)} – ${formatShortDateES(
    windows.currentEndISO
  )}`;
  const prevRangeLabel = `${formatShortDateES(windows.previousStartISO)} – ${formatShortDateES(
    windows.previousEndISO
  )}`;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6">
      <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Comparación semanal por usuario
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Series semanales: esta semana ({currentRangeLabel}) vs. anterior ({prevRangeLabel})
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Sin series registradas en estas dos semanas
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Guarda series en cualquier ejercicio para ver el porcentaje de cambio semanal.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                <th className="py-2 pr-3">Usuario</th>
                <th className="py-2 px-2 text-right">Anterior</th>
                <th className="py-2 px-2 text-right">Actual</th>
                <th className="py-2 pl-2 text-right">Cambio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {rows.map((row) => {
                const pct = row.cambioSeriesPct;
                const isPositive = pct !== null && pct > 0.05;
                const isNegative = pct !== null && pct < -0.05;
                const isNew = pct === null && row.seriesSemanaActual > 0;

                return (
                  <tr
                    key={row.usuario}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 pr-3 font-medium text-slate-900 dark:text-slate-100">
                      {row.usuario}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {row.seriesSemanaAnterior}{' '}
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {row.seriesSemanaAnterior === 1 ? 'serie' : 'series'}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                      {row.seriesSemanaActual}{' '}
                      <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                        {row.seriesSemanaActual === 1 ? 'serie' : 'series'}
                      </span>
                    </td>
                    <td className="py-2.5 pl-2 text-right font-mono tabular-nums">
                      <span
                        className={`inline-flex items-center justify-end gap-1 font-medium ${
                          isPositive || isNew
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : isNegative
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {isPositive || isNew ? (
                          <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        ) : isNegative ? (
                          <ArrowDownRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        ) : (
                          <Minus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        )}
                        <span>{formatPercentageES(pct)}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

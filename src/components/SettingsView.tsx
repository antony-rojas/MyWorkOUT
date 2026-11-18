import { Moon, Sun } from 'lucide-react';
import { AppsScriptPanel } from './AppsScriptPanel';

export type ThemeMode = 'light' | 'dark';

interface SettingsViewProps {
  theme: ThemeMode;
  onChangeTheme: (mode: ThemeMode) => void;
  isSuperadmin: boolean;
  connectedUrl: string;
  isSyncing: boolean;
  lastError: string | null;
  onConnect: (url: string) => Promise<void>;
  onDisconnect: () => void;
  onSync: () => Promise<void>;
}

export function SettingsView({
  theme,
  onChangeTheme,
  isSuperadmin,
  connectedUrl,
  isSyncing,
  lastError,
  onConnect,
  onDisconnect,
  onSync,
}: SettingsViewProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6">
        <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Apariencia
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Cambia entre tema claro y tema oscuro en toda la aplicación.
          </p>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Modo de visualización
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tema actual: {theme === 'dark' ? 'Oscuro (Dark Mode)' : 'Claro (Light Mode)'}
            </p>
          </div>

          <div
            className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start sm:self-auto"
            role="group"
            aria-label="Seleccionar tema"
          >
            <button
              type="button"
              onClick={() => onChangeTheme('light')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                theme === 'light'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              Light Mode
            </button>
            <button
              type="button"
              onClick={() => onChangeTheme('dark')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                theme === 'dark'
                  ? 'bg-slate-950 text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              Dark Mode
            </button>
          </div>
        </div>
      </div>

      {isSuperadmin && (
        <AppsScriptPanel
          connectedUrl={connectedUrl}
          isSyncing={isSyncing}
          lastError={lastError}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          onSync={onSync}
        />
      )}
    </div>
  );
}

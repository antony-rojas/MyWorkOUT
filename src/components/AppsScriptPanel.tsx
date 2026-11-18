import { useState } from 'react';
import { Check, Code2, Copy, Link2, RefreshCw, Unlink } from 'lucide-react';
import { APPS_SCRIPT_TEMPLATE, isValidAppsScriptUrl } from '../utils/appsScriptBridge';

interface AppsScriptPanelProps {
  connectedUrl: string;
  isSyncing: boolean;
  lastError: string | null;
  onConnect: (url: string) => Promise<void>;
  onDisconnect: () => void;
  onSync: () => Promise<void>;
}

export function AppsScriptPanel({
  connectedUrl,
  isSyncing,
  lastError,
  onConnect,
  onDisconnect,
  onSync,
}: AppsScriptPanelProps) {
  const [urlInput, setUrlInput] = useState(connectedUrl);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = urlInput.trim();
    if (!isValidAppsScriptUrl(trimmed)) {
      setValidationError(
        'Ingresa una URL válida de implementación web de Google Apps Script (https://script.google.com/macros/s/.../exec).'
      );
      return;
    }
    setValidationError(null);
    await onConnect(trimmed);
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleDisconnect = () => {
    setUrlInput('');
    setValidationError(null);
    onDisconnect();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              Puente Google Apps Script
            </span>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
              ·
            </span>
            <span
              className={
                connectedUrl
                  ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                  : 'text-slate-500 dark:text-slate-400'
              }
            >
              {connectedUrl
                ? 'Conectado a Google Sheets'
                : 'Modo local activo (conecta tu URL para sincronizar con Sheets)'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Visible solo para superadmin. Lee y escribe filas directamente mediante peticiones GET y POST.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {connectedUrl && (
            <button
              type="button"
              onClick={onSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sincronizando...' : 'Actualizar desde Sheets'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowCode((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Code2 className="w-3.5 h-3.5" />
            {showCode ? 'Ocultar código Apps Script' : 'Ver código Apps Script'}
          </button>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3"
      >
        <div className="relative flex-1">
          <label htmlFor="apps-script-url" className="sr-only">
            URL de aplicación web de Google Apps Script
          </label>
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
            <Link2 className="w-4 h-4" />
          </div>
          <input
            id="apps-script-url"
            type="url"
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value);
              if (validationError) setValidationError(null);
            }}
            placeholder="https://script.google.com/macros/s/AKfycb.../exec"
            className="w-full h-10 pl-9 pr-3 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-colors font-mono"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="submit"
            disabled={isSyncing || !urlInput.trim()}
            className="h-10 px-4 text-sm font-medium text-white bg-slate-900 dark:bg-blue-600 rounded-lg hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {connectedUrl ? 'Reconectar' : 'Conectar puente'}
          </button>
          {connectedUrl && (
            <button
              type="button"
              onClick={handleDisconnect}
              className="h-10 px-3.5 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Unlink className="w-3.5 h-3.5" />
              Desconectar
            </button>
          )}
        </div>
      </form>

      {(validationError || lastError) && (
        <p className="mt-3 text-xs text-red-700 dark:text-red-400 font-medium" role="alert">
          {validationError || lastError}
        </p>
      )}

      {showCode && (
        <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Configuración del puente en Google Sheets
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                1. Abre tu hoja de cálculo → Extensiones → Apps Script · 2. Pega el código · 3. Implementar → Nueva implementación → Aplicación web (Acceso: Cualquier persona).
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copied ? 'Código copiado' : 'Copiar código'}
            </button>
          </div>

          <pre className="p-4 rounded-lg bg-slate-900 dark:bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono overflow-x-auto leading-relaxed max-h-72">
            <code>{APPS_SCRIPT_TEMPLATE}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

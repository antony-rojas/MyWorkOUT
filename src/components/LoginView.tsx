import { useState } from 'react';
import { Eye, EyeOff, LogIn } from 'lucide-react';

interface LoginViewProps {
  isSyncing: boolean;
  onLogin: (username: string, password: string) => string | null;
}

export function LoginView({ isSyncing, onLogin }: LoginViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const err = onLogin(username, password);
    if (err) {
      setLoginError(err);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-8">
        <header className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 text-balance">
            Registro de Entrenamientos
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            Todos los usuarios, planes de entrenamiento y series registradas se guardan directamente en{' '}
            <strong className="font-semibold text-slate-900 dark:text-slate-100">Google Sheets</strong> mediante un puente de{' '}
            <strong className="font-semibold text-slate-900 dark:text-slate-100">Google Apps Script</strong>. Inicia sesión con tu usuario para acceder a tu perfil o administrar planes.
          </p>
        </header>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 max-w-md">
          <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Iniciar sesión
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Ingresa con tu usuario y contraseña para continuar.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="login-usuario"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Usuario
              </label>
              <input
                id="login-usuario"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (loginError) setLoginError(null);
                }}
                placeholder="Nombre de usuario"
                required
                className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (loginError) setLoginError(null);
                  }}
                  placeholder="••••••••"
                  required
                  className="w-full h-10 pl-3 pr-10 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  className="absolute inset-y-0 right-2 flex items-center px-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {loginError && (
              <p className="text-xs font-medium text-red-700 dark:text-red-400" role="alert">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSyncing}
              className="w-full h-11 inline-flex items-center justify-center gap-2 px-4 text-sm font-medium text-white bg-slate-900 dark:bg-blue-600 rounded-lg hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              {isSyncing ? 'Sincronizando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

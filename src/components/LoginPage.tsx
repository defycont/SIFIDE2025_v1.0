
import React, { useState } from 'react';
import { auth } from '../firebaseConfig'; // Firebase auth instance

interface LoginPageProps {
  onLoginSuccess: (user: any) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState(''); // Removed pre-filled email
  const [password, setPassword] = useState(''); // Removed pre-filled password
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!auth) {
        setError("Error de configuración: La autenticación de Firebase no está inicializada.");
        setLoading(false);
        return;
      }
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      onLoginSuccess(userCredential.user);
    } catch (err: any) {
      let friendlyMessage = 'Error al iniciar sesión. Verifique sus credenciales.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        friendlyMessage = 'El correo electrónico o la contraseña son incorrectos.';
      } else if (err.code === 'auth/invalid-email') {
        friendlyMessage = 'El formato del correo electrónico no es válido.';
      }
      setError(friendlyMessage);
      console.error("Login error:", err);
    }
    setLoading(false);
  };
  
  const handlePlaceholderLink = (e: React.MouseEvent<HTMLAnchorElement>, featureName: string) => {
    e.preventDefault();
    alert(`La funcionalidad "${featureName}" no está implementada en esta versión.`);
  };


  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-100">
      {/* Panel Izquierdo - Branding e Información */}
      <div className="w-full md:w-2/5 lg:w-1/2 bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 text-white p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden">
        {/* Decorative elements (optional) */}
        <div className="absolute top-0 left-0 w-32 h-32 md:w-64 md:h-64 bg-blue-500/10 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-32 h-32 md:w-64 md:h-64 bg-cyan-500/10 rounded-full translate-x-1/2 translate-y-1/2"></div>
        
        <div className="relative z-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">DEFYCONT ASESORES</h1>
          <p className="mt-3 text-lg sm:text-xl text-slate-300">Su Aliado Estratégico en Asesoría Fiscal Integral.</p>
        </div>

        <div className="relative z-10 mt-10 space-y-6">
          {[
            { icon: "fas fa-chart-line", title: "Análisis Fiscal Preciso", description: "Visualice sus datos fiscales de forma clara y tome decisiones informadas." },
            { icon: "fas fa-cogs", title: "Gestión Simplificada", description: "Optimice su carga tributaria con herramientas intuitivas y eficientes." },
            { icon: "fas fa-file-invoice-dollar", title: "Reportes Detallados", description: "Genere reportes y cédulas fiscales al instante para un control total." },
          ].map(item => (
            <div key={item.title} className="flex items-start">
              <div className="flex-shrink-0">
                <i className={`${item.icon} text-2xl text-cyan-400 w-8 text-center`}></i>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="text-slate-400 text-sm">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="relative z-10 mt-10 pt-8 border-t border-slate-700/50">
          <p className="text-sm text-slate-400">¿Necesita ayuda? Contáctenos:</p>
          <div className="flex flex-col sm:flex-row sm:space-x-6 mt-2 text-sm">
            <a href="tel:+524493528501" className="text-slate-300 hover:text-cyan-400 transition-colors flex items-center">
              <i className="fas fa-phone mr-2"></i>+52 449-352-85-01
            </a>
            <a href="mailto:c.p.cesardiaz@defycont.com" className="text-slate-300 hover:text-cyan-400 transition-colors flex items-center mt-1 sm:mt-0">
              <i className="fas fa-envelope mr-2"></i>c.p.cesardiaz@defycont.com
            </a>
          </div>
        </div>
      </div>

      {/* Panel Derecho - Formulario de Login */}
      <div className="w-full md:w-3/5 lg:w-1/2 bg-slate-50 p-8 sm:p-12 flex items-center justify-center">
        <div className="w-full max-w-md space-y-8">
          <div>
            {/* Placeholder for a more styled logo if available */}
            {/* <img className="mx-auto h-12 w-auto" src="/path-to-your-logo.svg" alt="DEFYCONT" /> */}
            <div className="text-center">
                <span className="inline-block bg-gradient-to-r from-blue-600 to-cyan-500 text-transparent bg-clip-text text-5xl font-extrabold tracking-wider">
                    DC
                </span>
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
              Acceda a su Cuenta
            </h2>
            <p className="mt-2 text-center text-sm text-slate-600">
              o{' '}
              <a href="#" onClick={(e) => handlePlaceholderLink(e, "Solicitar Demostración")} className="font-medium text-blue-600 hover:text-blue-500">
                solicite una demostración
              </a>
            </p>
          </div>

          <form onSubmit={handleLogin} className="mt-8 space-y-6">
            <input type="hidden" name="remember" defaultValue="true" />
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="email-address" className="sr-only">
                  Correo electrónico
                </label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <i className="fas fa-envelope text-slate-400"></i>
                    </div>
                    <input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none rounded-t-md relative block w-full px-3 py-3 pl-10 border border-slate-300 placeholder-slate-500 text-slate-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder="Correo electrónico"
                    />
                </div>
              </div>
              <div>
                <label htmlFor="password" className="sr-only">
                  Contraseña
                </label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <i className="fas fa-lock text-slate-400"></i>
                    </div>
                    <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none rounded-b-md relative block w-full px-3 py-3 pl-10 border border-slate-300 placeholder-slate-500 text-slate-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder="Contraseña"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 text-slate-500 hover:text-slate-700 focus:outline-none"
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                        <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <i className="fas fa-exclamation-circle text-red-400"></i>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {/* <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-900">
                  Recordarme
                </label> */}
              </div>

              <div className="text-sm">
                <a href="#" onClick={(e) => handlePlaceholderLink(e, "Recuperar Contraseña")} className="font-medium text-blue-600 hover:text-blue-500">
                  ¿Olvidó su contraseña?
                </a>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-75 transition-colors"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Procesando...
                  </>
                ) : (
                  "LOGIN"
                )}
              </button>
            </div>
          </form>
           <p className="mt-6 text-center text-sm text-slate-600">
            ¿Nuevo Usuario?{' '}
            <a href="#" onClick={(e) => handlePlaceholderLink(e, "Crear Cuenta")} className="font-medium text-blue-600 hover:text-blue-500">
              Crear una cuenta
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

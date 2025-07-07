
import React, { useState, useEffect, useCallback } from 'react';
import { DashboardController } from './components/DashboardController';
import { LoginPage } from './components/LoginPage';
import { AdminPanel } from './components/AdminPanel'; // Import AdminPanel
import { AppConfig, TaxpayerData, UserProfile, StoredRfcInfo, ActiveTab, CedulaISRMes } from './types';
import { DEFAULT_APP_CONFIG } from './constants';
import { auth } from './firebaseConfig'; 
import { getFullTaxpayerData, saveFullTaxpayerData, getUserProfile, updateUserProfile, getDefaultTaxpayerData, getAllStoredRfcs } from './firebaseUtils';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [activeRfc, setActiveRfc] = useState<string>('');
  const [currentTaxpayerData, setCurrentTaxpayerData] = useState<TaxpayerData>(getDefaultTaxpayerData(DEFAULT_APP_CONFIG.rfc));
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [storedRfcsList, setStoredRfcsList] = useState<StoredRfcInfo[]>([]);

  const [isLoadingRfcData, setIsLoadingRfcData] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  
  const [requestedTab, setRequestedTab] = useState<ActiveTab | null>(null);
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);

  const [currentAppView, setCurrentAppView] = useState<'dashboard' | 'admin'>('dashboard');
  const [totalPerdidasFiscales, setTotalPerdidasFiscales] = useState<number>(0); // Estado para pérdidas fiscales del admin
  const [isrCedulaDataApp, setIsrCedulaDataApp] = useState<CedulaISRMes[]>([]); // Estado para la cédula ISR del Dashboard


  useEffect(() => {
    if (!auth) {
        console.error("Firebase auth is not initialized. App cannot proceed with authentication.");
        setFirebaseError("Error crítico: Firebase Auth no está disponible.");
        setAuthLoading(false);
        return;
    }
    const unsubscribe = auth.onAuthStateChanged(async (user: { uid: string; email: string | null; }) => {
      setCurrentUser(user);
      if (user) {
        const profile = await getUserProfile(user.uid);
        setUserProfile(profile);
        
        const rfcs = await getAllStoredRfcs();
        setStoredRfcsList(rfcs);

        if (profile?.lastActiveRfc && rfcs.some(r => r.rfc === profile.lastActiveRfc)) {
          await switchActiveRfc(profile.lastActiveRfc);
        } else if (rfcs.length > 0) {
          await switchActiveRfc(rfcs[0].rfc);
        }
         else {
          setActiveRfc(''); 
          setCurrentTaxpayerData(getDefaultTaxpayerData(DEFAULT_APP_CONFIG.rfc)); 
        }
      } else {
        setActiveRfc('');
        setUserProfile(null);
        setCurrentTaxpayerData(getDefaultTaxpayerData(DEFAULT_APP_CONFIG.rfc)); 
        setStoredRfcsList([]);
        setCurrentAppView('dashboard'); // Reset to dashboard view on logout
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const switchActiveRfc = async (newRfc: string) => {
    if (!newRfc || newRfc.trim() === "") {
        setFirebaseError("RFC no válido para cargar datos.");
        setActiveRfc('');
        setCurrentTaxpayerData(getDefaultTaxpayerData(DEFAULT_APP_CONFIG.rfc));
        setIsLoadingRfcData(false);
        return;
    }
    setIsLoadingRfcData(true);
    setFirebaseError(null);
    try {
      const rfcKey = newRfc.toUpperCase();
      const data = await getFullTaxpayerData(rfcKey);
      setCurrentTaxpayerData(data);
      setActiveRfc(rfcKey);
      if (currentUser && userProfile) {
        await updateUserProfile(currentUser.uid, { ...userProfile, lastActiveRfc: rfcKey });
      }
    } catch (error: any) {
      console.error(`Error loading data for RFC ${newRfc}:`, error);
      let detailMessage = "Error desconocido.";
      if (error && typeof error === 'object' && error.message) {
        detailMessage = error.message;
      } else if (error) {
        detailMessage = String(error);
      }
      setFirebaseError(`Error al cargar datos para RFC ${newRfc}. ${detailMessage}`);
      setCurrentTaxpayerData(getDefaultTaxpayerData(newRfc)); 
      setActiveRfc(newRfc); 
    }
    setIsLoadingRfcData(false);
  };

  const handleAppConfigChange = useCallback(async (newConfig: AppConfig, rfcToUpdate: string) => {
    if (!rfcToUpdate || rfcToUpdate.trim() === "") {
        setFirebaseError("RFC no válido para guardar configuración.");
        return Promise.reject("RFC no válido");
    }
    setFirebaseError(null);
    setIsLoadingRfcData(true);
    const rfcKey = rfcToUpdate.toUpperCase();
    
    // Optimistically update current config if it's the active one or if no RFC is active (implies new config)
    if (rfcKey === activeRfc || !activeRfc) {
        setCurrentTaxpayerData(prev => ({ ...prev, appConfig: { ...newConfig, rfc: rfcKey } }));
    }

    try {
      // Fetch existing data or get defaults if it's a completely new RFC
      const existingData = await getFullTaxpayerData(rfcKey); 
      const updatedTaxpayerData: TaxpayerData = {
        ...existingData, // This will spread defaults if it's new
        appConfig: { ...newConfig, rfc: rfcKey }, 
      };
      
      // Ensure essential arrays exist if they were missing (e.g. from a very old schema or new RFC)
      if (!existingData.ingresosData || existingData.ingresosData.length === 0) {
         updatedTaxpayerData.ingresosData = getDefaultTaxpayerData(rfcKey).ingresosData;
         updatedTaxpayerData.egresosData = getDefaultTaxpayerData(rfcKey).egresosData;
         updatedTaxpayerData.resicoPfData = getDefaultTaxpayerData(rfcKey).resicoPfData;
      }

      await saveFullTaxpayerData(rfcKey, updatedTaxpayerData);

      // Refresh the list of all RFCs, as a new one might have been added or name changed
      const rfcs = await getAllStoredRfcs(); 
      setStoredRfcsList(rfcs);

      // If the changed RFC wasn't the active one, or if no RFC was active (newly added), switch to it.
      if (rfcKey !== activeRfc || !activeRfc) {
        await switchActiveRfc(rfcKey); 
      } else { 
         // If it was already active, just ensure the local state is fully updated.
         setCurrentTaxpayerData(updatedTaxpayerData); 
      }

      // Update last active RFC in user profile
      if (currentUser && userProfile) {
        await updateUserProfile(currentUser.uid, { ...userProfile, lastActiveRfc: rfcKey });
      }
      setIsLoadingRfcData(false);
      return Promise.resolve();
    } catch (error: any) {
      console.error(`Error guardando AppConfig para RFC ${rfcKey}:`, error);
      let detailMessage = "Error desconocido.";
      if (error && typeof error === 'object' && error.message) {
        detailMessage = error.message;
      } else if (error) {
        detailMessage = String(error);
      }
      setFirebaseError(`Error al guardar configuración para RFC ${rfcKey}. ${detailMessage}`);
      setIsLoadingRfcData(false);
      return Promise.reject(detailMessage);
    }
  }, [activeRfc, currentUser, userProfile]);


  const handleLogout = async () => {
    if (auth) {
        await auth.signOut();
    }
    setCurrentUser(null);
    setActiveRfc('');
    setUserProfile(null);
    setStoredRfcsList([]);
    setClientDropdownOpen(false);
    setCurrentAppView('dashboard'); // Ensure reset to dashboard on logout
  };

  const handleNavigateToConfig = async (rfcForConfig?: string) => {
    setClientDropdownOpen(false); // Close dropdown if open
    setCurrentAppView('dashboard'); // Ensure we are in dashboard view for config tab
    
    if (!activeRfc && !rfcForConfig) {
      // Scenario: Adding a brand new RFC, no current active one and no specific one requested.
      // We set a temporary RFC or let the config page handle "NEW_RFC".
      // The config page should allow inputting the RFC.
      // For now, setting a placeholder to ensure DashboardController renders.
      // The config tab itself will show the input for the RFC.
      const tempRfcForNewConfig = "TEMP_NEW_RFC_" + Date.now(); // Unique temporary key
      setCurrentTaxpayerData(getDefaultTaxpayerData(tempRfcForNewConfig, "Nueva Empresa (Configurar)"));
      setActiveRfc(tempRfcForNewConfig); // Set this temporary RFC as active to show the config page
    } else if (rfcForConfig && rfcForConfig !== activeRfc) {
      // Scenario: Navigating to config for a specific, non-active RFC (e.g., from admin panel)
      await switchActiveRfc(rfcForConfig);
    }
    // If rfcForConfig is undefined and activeRfc exists, it means "configure current client"
    // If rfcForConfig is defined and matches activeRfc, also "configure current client"
    // In these cases, switchActiveRfc is not needed, just set the tab.
    
    setRequestedTab('config'); 
  };
  
  const clearRequestedTab = () => {
    setRequestedTab(null);
  }

  const LoadingIndicator: React.FC<{ message: string }> = ({ message }) => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 text-slate-700 p-4">
      <div className="loading-container">
        <svg className="loading-svg" viewBox="0 0 100 80">
          <defs>
            <linearGradient id="dc-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{stopColor: '#3b82f6', stopOpacity: 1}} /> {/* blue-500 */}
              <stop offset="100%" style={{stopColor: '#06b6d4', stopOpacity: 1}} /> {/* cyan-500 */}
            </linearGradient>
          </defs>
          {/* D shape */}
          <path className="dc-d" d="M15 10 H35 A25 30 0 0 1 35 70 H15 Z" />
          {/* C shape */}
          <path className="dc-c" d="M85 10 A30 30 0 1 0 85 70 A20 20 0 0 1 M55 10 A30 30 0 0 1 55 70" />
        </svg>
        <p className="loading-message">{message}</p>
      </div>
    </div>
  );

  if (authLoading) { 
    return <LoadingIndicator message="Cargando DEFYCONT Fiscal..." />;
  }
  
  if (!currentUser) {
    return <LoginPage onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div id="app-container" className="flex flex-col min-h-screen">
      {firebaseError && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 sticky top-0 z-50" role="alert">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-bold">Error de Conexión o Datos</p>
              <p>{firebaseError}</p>
            </div>
            <button onClick={() => setFirebaseError(null)} className="text-red-700 hover:text-red-900">
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}
       <Navbar 
        userEmail={currentUser.email || 'Usuario'}
        activeRfcName={currentTaxpayerData?.appConfig?.nombreEmpresa || activeRfc}
        activeRfcNumber={activeRfc}
        onLogout={handleLogout}
        storedRfcsList={storedRfcsList}
        onSwitchRfc={async (rfc) => {
            await switchActiveRfc(rfc);
            setCurrentAppView('dashboard'); 
        }}
        onNavigateToConfig={handleNavigateToConfig}
        isClientDropdownOpen={clientDropdownOpen}
        setClientDropdownOpen={setClientDropdownOpen}
        currentView={currentAppView}
        setCurrentView={setCurrentAppView}
      />

      <div className="flex-grow flex flex-col overflow-y-auto"> {/* Added overflow-y-auto */}
        {currentAppView === 'admin' ? (
          <AdminPanel 
            setCurrentAppView={setCurrentAppView}
            storedRfcsList={storedRfcsList}
            userEmail={currentUser.email}
            onNavigateToConfig={handleNavigateToConfig} // Pass this down
            onTotalPerdidasFiscalesChange={setTotalPerdidasFiscales} // Pasar callback al AdminPanel
            isrCedulaData={isrCedulaDataApp} // Pasar los datos de la cédula ISR al AdminPanel
          />
        ) : activeRfc && !isLoadingRfcData ? (
          <DashboardController
            authUserId={currentUser.uid}
            activeRfc={activeRfc}
            initialTaxpayerData={currentTaxpayerData}
            onAppConfigChange={handleAppConfigChange}
            onSwitchRfc={switchActiveRfc} // Pass switchActiveRfc
            requestedTab={requestedTab}
            clearRequestedTab={clearRequestedTab}
            storedRfcsList={storedRfcsList} // Pass storedRfcsList
            totalPerdidasFiscalesAcumuladas={totalPerdidasFiscales} // Pasar el total al DashboardController
            onCedulaIsrDataChange={setIsrCedulaDataApp} // Pasar callback para actualizar los datos ISR
          />
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center p-8 text-center bg-slate-50">
              {isLoadingRfcData ? (
                  <LoadingIndicator message={`Cargando datos del RFC: ${activeRfc}...`} />
              ) : (
                  <div className="bg-white p-8 md:p-12 shadow-xl rounded-lg max-w-lg w-full">
                      <i className="fas fa-rocket fa-3x text-blue-500 mb-6"></i>
                      <h2 className="text-3xl font-bold text-slate-800 mb-3">Comience a Trabajar</h2>
                      <p className="text-slate-600 mb-8 text-base">
                          Seleccione un cliente existente o agregue uno nuevo para empezar a gestionar sus datos fiscales.
                      </p>
                      <div className="space-y-4 md:space-y-0 md:space-x-4 flex flex-col md:flex-row justify-center">
                          <button
                              onClick={() => {
                                  setClientDropdownOpen(true);
                                  setCurrentAppView('dashboard'); 
                              }}
                              disabled={storedRfcsList.length === 0}
                              className="w-full md:w-auto flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                          >
                              <i className="fas fa-users mr-2"></i> Seleccionar Cliente Existente
                          </button>
                          <button
                              onClick={() => handleNavigateToConfig()}
                              className="w-full md:w-auto flex items-center justify-center px-6 py-3 border border-slate-300 text-base font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                          >
                            <i className="fas fa-plus-circle mr-2"></i> Agregar Nuevo Cliente (RFC)
                          </button>
                      </div>
                      {storedRfcsList.length === 0 && (
                          <p className="mt-6 text-sm text-amber-600 bg-amber-50 p-3 rounded-md">
                              <i className="fas fa-info-circle mr-1"></i> No tiene clientes guardados. Comience agregando uno nuevo.
                          </p>
                      )}
                      <p className="text-xs text-slate-400 mt-8">RFC Activo Actual: {activeRfc || "Ninguno seleccionado"}</p>
                  </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
};

interface NavbarProps {
  userEmail: string;
  activeRfcName: string; // Display name for active RFC
  activeRfcNumber: string; // Actual RFC number
  onLogout: () => void;
  storedRfcsList: StoredRfcInfo[];
  onSwitchRfc: (rfc: string) => void;
  onNavigateToConfig: (rfc?:string) => void; 
  isClientDropdownOpen: boolean;
  setClientDropdownOpen: (isOpen: boolean) => void;
  currentView: 'dashboard' | 'admin';
  setCurrentView: (view: 'dashboard' | 'admin') => void;
}

const Navbar: React.FC<NavbarProps> = ({ 
    userEmail, activeRfcName, activeRfcNumber, onLogout, 
    storedRfcsList, onSwitchRfc, onNavigateToConfig,
    isClientDropdownOpen, setClientDropdownOpen,
    currentView, setCurrentView
}) => {
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const handleRfcSelect = (rfc: string) => {
    onSwitchRfc(rfc);
    setClientDropdownOpen(false);
    setCurrentView('dashboard'); 
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setClientDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setClientDropdownOpen]);

  return (
    <nav className="bg-slate-800 text-white shadow-md p-4 sticky top-0 z-40">
      <div className="container mx-auto flex flex-wrap items-center justify-between">
        <div className="flex items-center">
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-lg">DEFYCONT ASESORES</span>
            {currentView === 'dashboard' && (
              <span className="text-xs text-slate-400" title={activeRfcNumber || "N/A"}>
                Cliente: {activeRfcName || "N/A"}
              </span>
            )}
             {currentView === 'admin' && (
              <span className="text-xs text-blue-400">Panel de Administración</span>
            )}
          </div>
          {currentView === 'dashboard' && (
            <div className="relative ml-3" ref={dropdownRef}>
              <button 
                onClick={() => setClientDropdownOpen(!isClientDropdownOpen)}
                className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 transition-colors"
                aria-label="Seleccionar cliente"
                aria-haspopup="true"
                aria-expanded={isClientDropdownOpen}
                disabled={storedRfcsList.length === 0 && currentView === 'dashboard'}
              >
                <i className="fas fa-users fa-fw"></i>
              </button>
              {isClientDropdownOpen && (
                <div className="absolute left-0 mt-2 w-72 bg-white rounded-md shadow-lg py-1 z-50 ring-1 ring-black ring-opacity-5">
                  {storedRfcsList.length > 0 ? (
                    <ul className="max-h-60 overflow-y-auto" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                      {storedRfcsList.map(item => (
                        <li key={item.rfc}>
                          <button
                            onClick={() => handleRfcSelect(item.rfc)}
                            className={`block w-full text-left px-4 py-2 text-sm  hover:bg-slate-100 hover:text-slate-900 ${item.rfc === activeRfcNumber ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-700'}`}
                            role="menuitem"
                          >
                            <span className="font-medium">{item.nombreEmpresa}</span> - <span className={`${item.rfc === activeRfcNumber ? 'text-blue-500' : 'text-slate-500'}`}>{item.rfc}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-4 py-2 text-sm text-slate-500">No hay clientes guardados.</p>
                  )}
                   <div className="border-t border-slate-200 mt-1 pt-1">
                      <button
                          onClick={() => {
                            setClientDropdownOpen(false); // Close dropdown first
                            onNavigateToConfig(); // Then navigate
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50"
                          role="menuitem"
                      >
                          <i className="fas fa-plus-circle mr-2"></i>Ir a Configuración (Agregar Nuevo)
                      </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
            <button
              onClick={() => setCurrentView(currentView === 'dashboard' ? 'admin' : 'dashboard')}
              className={`p-2 rounded-md transition-colors text-sm font-medium
                ${currentView === 'admin' 
                  ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}
              aria-label={currentView === 'dashboard' ? "Ir al Panel de Administración" : "Volver al Dashboard Fiscal"}
            >
              {currentView === 'dashboard' ? (
                <><i className="fas fa-user-shield mr-1 md:mr-2"></i><span className="hidden md:inline">Admin</span></>
              ) : (
                <><i className="fas fa-tachometer-alt mr-1 md:mr-2"></i><span className="hidden md:inline">Dashboard</span></>
              )}
            </button>
            <span className="text-sm text-slate-300 hidden md:block" title={userEmail}>
              <i className="fas fa-user-circle mr-1"></i> {userEmail}
            </span>
            <button 
                onClick={onLogout} 
                className="bg-red-500 hover:bg-red-600 text-white text-xs font-semibold py-1 px-3 rounded-md transition duration-150"
                aria-label="Cerrar sesión"
            >
                <i className="fas fa-sign-out-alt mr-1 md:mr-2"></i>
                <span className="hidden md:inline">Salir</span>
            </button>
        </div>
      </div>
    </nav>
  );
};

export default App;

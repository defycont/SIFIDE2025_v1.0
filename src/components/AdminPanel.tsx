

import React, { useState } from 'react';
import { AdminPanelProps, AdminActiveTab, StoredRfcInfo, AdminUser } from '../types';
import { AdminOverviewTab } from './admin_tabs/AdminOverviewTab';
import { AdminRolesTab } from './admin_tabs/AdminRolesTab';
import { AdminUsuariosTab } from './admin_tabs/AdminUsuariosTab';
import { AdminEmpresasTab } from './admin_tabs/AdminEmpresasTab';
import { AdminPerdidasFiscalesTab } from './admin_tabs/AdminPerdidasFiscalesTab';

const MOCK_USERS: AdminUser[] = [
  { id: '1', nombre: 'César Díaz Bárcenas', correo: 'c.p.cesardiaz@defycont.com', empresaBase: 'DEFYCONT ASESORES', tipoUsuario: 'admin-despacho', numeroSesiones: 41, estatus: 'Activo', ultimaSesion: '2025-06-21', activoSistema: true },
  { id: '2', nombre: 'Juan Sebastian', correo: 'sebastian.staff@defycont.com', empresaBase: 'DEFYCONT ASESORES', tipoUsuario: 'contador-despacho', numeroSesiones: 5, estatus: 'Activo', ultimaSesion: '2025-06-21', activoSistema: true },
  { id: '3', nombre: 'DIAZ', correo: 'noreply@defycont.com', empresaBase: 'DEFYCONT ASESORES', tipoUsuario: 'contador-despacho', numeroSesiones: 1, estatus: 'Inactivo', ultimaSesion: '2025-06-18', activoSistema: false },
  { id: '4', nombre: 'Zoe Maillany', correo: 'zoe.staff@defycont.com', empresaBase: 'DEFYCONT ASESORES', tipoUsuario: 'contador-despacho', numeroSesiones: 1, estatus: 'Activo', ultimaSesion: '2025-06-20', activoSistema: true },
];


export const AdminPanel: React.FC<AdminPanelProps> = ({ setCurrentAppView, storedRfcsList, userEmail, onNavigateToConfig }) => {
  const [activeAdminTab, setActiveAdminTab] = useState<AdminActiveTab>('admin-overview');

  const adminTabs: { id: AdminActiveTab; label: string; icon: string }[] = [
    { id: 'admin-overview', label: 'Resumen Admin', icon: 'fas fa-shield-alt' },
    { id: 'roles', label: 'Roles', icon: 'fas fa-user-tag' },
    { id: 'usuarios', label: 'Usuarios', icon: 'fas fa-users-cog' },
    { id: 'empresas', label: 'Empresas', icon: 'fas fa-building' },
    { id: 'perdidas-fiscales', label: 'Pérdidas Fiscales', icon: 'fas fa-money-bill-wave' },
  ];

  const renderActiveAdminTabContent = () => {
    switch (activeAdminTab) {
      case 'admin-overview':
        return <AdminOverviewTab setActiveAdminTab={setActiveAdminTab} />;
      case 'roles':
        return <AdminRolesTab />;
      case 'usuarios':
        return <AdminUsuariosTab usersData={MOCK_USERS} />;
      case 'empresas':
        return <AdminEmpresasTab storedRfcsList={storedRfcsList} onNavigateToConfig={onNavigateToConfig} />;
      case 'perdidas-fiscales':
        return <AdminPerdidasFiscalesTab />;
      default:
        return <div className="p-6 text-slate-700">Seleccione una pestaña de administración.</div>;
    }
  };

  return (
    <div className="flex-grow flex flex-col bg-slate-100">
      {/* Admin Panel Header */}
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-800">
              <i className="fas fa-tools mr-2 text-blue-600"></i>Panel de Administración
            </h1>
            <button
              onClick={() => setCurrentAppView('dashboard')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition duration-150 text-sm flex items-center"
              aria-label="Volver al Dashboard Fiscal"
            >
              <i className="fas fa-arrow-left mr-2"></i>Volver al Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* Admin Panel Main Content */}
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          {/* Tabs Navigation */}
          <div className="border-b border-slate-200">
            <nav className="flex flex-wrap -mb-px" aria-label="Admin Tabs">
              {adminTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveAdminTab(tab.id)}
                  className={`whitespace-nowrap group inline-flex items-center justify-center py-3 px-4 sm:px-5 border-b-2 font-medium text-sm focus:outline-none transition-colors
                    ${activeAdminTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                  aria-current={activeAdminTab === tab.id ? 'page' : undefined}
                >
                  <i className={`${tab.icon} mr-2 text-base ${activeAdminTab === tab.id ? 'text-blue-500' : 'text-slate-400 group-hover:text-slate-500'}`}></i>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {renderActiveAdminTabContent()}
          </div>
        </div>
      </main>
      
      <footer className="py-4 text-center text-xs text-slate-500">
        Panel de Administración &copy; {new Date().getFullYear()} DEFYCONT ASESORES. {userEmail && `Sesión: ${userEmail}`}
      </footer>
    </div>
  );
};

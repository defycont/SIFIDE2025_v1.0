

import React from 'react';
import { AdminActiveTab } from '../../types';

interface AdminSectionCardProps {
  title: string;
  description: string;
  icon: string;
  colorClass: string; // e.g., 'bg-blue-500'
  onClick?: () => void;
  tabLink?: AdminActiveTab;
  setActiveAdminTab?: (tab: AdminActiveTab) => void;
}

const AdminSectionCard: React.FC<AdminSectionCardProps> = ({ title, description, icon, colorClass, onClick, tabLink, setActiveAdminTab }) => {
  const handleClick = () => {
    if (tabLink && setActiveAdminTab) { // Prioritize tabLink if available
      setActiveAdminTab(tabLink);
    } else if (onClick) { // Fallback to onClick if no tabLink or setActiveAdminTab not provided for it
      onClick();
    }
  };
  
  const hasAction = (tabLink && setActiveAdminTab) || onClick;

  return (
    <button
      onClick={hasAction ? handleClick : undefined}
      className={`p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 w-full text-left focus:outline-none focus:ring-2 focus:ring-offset-2 ${hasAction ? colorClass.replace('bg-', 'focus:ring-') : 'bg-slate-300' } ${!hasAction ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      disabled={!hasAction} 
    >
      <div className="flex items-center">
        <div className={`p-3 rounded-full ${colorClass} text-white mr-4`}>
          <i className={`${icon} fa-lg`}></i>
        </div>
        <div>
          <h3 className="text-xl font-semibold text-slate-800">{title}</h3>
          <p className="text-slate-600 text-sm mt-1">{description}</p>
        </div>
        {hasAction && (
            <i className="fas fa-chevron-right text-slate-400 ml-auto"></i>
        )}
      </div>
    </button>
  );
};

interface AdminOverviewTabProps {
  setActiveAdminTab: (tab: AdminActiveTab) => void;
}

export const AdminOverviewTab: React.FC<AdminOverviewTabProps> = ({ setActiveAdminTab }) => {
  const sections = [
    { 
      category: "Mi Cuenta", 
      items: [
        { title: "Mi Cuenta $ Contalink", description: "Gestionar datos de cuenta y facturación.", icon: "fas fa-dollar-sign", colorClass: "bg-green-500", onClick: () => alert("Funcionalidad 'Mi Cuenta $ Contalink' no implementada.") },
        { title: "Consumo de Timbres", description: "Verificar y administrar timbres fiscales.", icon: "fas fa-stamp", colorClass: "bg-cyan-500", onClick: () => alert("Funcionalidad 'Consumo de Timbres' no implementada.") }
      ]
    },
    { 
      category: "Administración Permisos", 
      items: [
        { title: "Roles", description: "Definir y administrar roles de usuario.", icon: "fas fa-user-tag", colorClass: "bg-indigo-500", tabLink: "roles" as AdminActiveTab },
        { title: "Usuarios", description: "Gestionar accesos y perfiles de usuarios.", icon: "fas fa-users-cog", colorClass: "bg-purple-500", tabLink: "usuarios" as AdminActiveTab },
        { title: "Empresas", description: "Administrar empresas registradas en la plataforma.", icon: "fas fa-building", colorClass: "bg-sky-500", tabLink: "empresas" as AdminActiveTab }
      ]
    },
    {
      category: "Migraciones",
      items: [
        { title: "Carga Masiva", description: "Importar datos de forma masiva.", icon: "fas fa-truck-loading", colorClass: "bg-amber-500", onClick: () => alert("Funcionalidad 'Carga Masiva' no implementada.") },
        { title: "Migración desde otro sistema", description: "Asistente para migrar datos.", icon: "fas fa-exchange-alt", colorClass: "bg-orange-500", onClick: () => alert("Funcionalidad 'Migración desde otro sistema' no implementada.") },
        { title: "Reiniciar Procesos", description: "Herramientas para reiniciar flujos.", icon: "fas fa-history", colorClass: "bg-teal-500", onClick: () => alert("Funcionalidad 'Reiniciar Procesos' no implementada.") }
      ]
    },
    {
      category: "General",
      items: [
        { title: "Configuración de Empresa", description: "Ajustes globales de la plataforma.", icon: "fas fa-cogs", colorClass: "bg-slate-500", onClick: () => alert("Funcionalidad 'Configuración de Empresa' no implementada.") },
        { title: "Tipo Documento", description: "Gestionar tipos de documentos.", icon: "fas fa-file-alt", colorClass: "bg-pink-500", onClick: () => alert("Funcionalidad 'Tipo Documento' no implementada.") },
        { title: "Sucursales", description: "Administrar sucursales.", icon: "fas fa-store-alt", colorClass: "bg-lime-500", onClick: () => alert("Funcionalidad 'Sucursales' no implementada.") },
        { title: "Email", description: "Configuración de plantillas y envío.", icon: "fas fa-envelope-open-text", colorClass: "bg-rose-500", onClick: () => alert("Funcionalidad 'Email' no implementada.") },
        { title: "Direcciones Email", description: "Listas de correos para notificaciones.", icon: "fas fa-at", colorClass: "bg-fuchsia-500", onClick: () => alert("Funcionalidad 'Direcciones Email' no implementada.") },
        { title: "Plantillas de Correo", description: "Editar plantillas de correo.", icon: "fas fa-mail-bulk", colorClass: "bg-violet-500", onClick: () => alert("Funcionalidad 'Plantillas de Correo' no implementada.") },
        { title: "Interfaz", description: "Personalizar apariencia.", icon: "fas fa-palette", colorClass: "bg-emerald-500", onClick: () => alert("Funcionalidad 'Interfaz' no implementada.") }
      ]
    }
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      {sections.map(section => (
        <div key={section.category}>
          <h2 className="text-2xl font-semibold text-slate-700 mb-2 px-1 border-b pb-2">{section.category}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {section.items.map(item => (
              <AdminSectionCard 
                key={item.title} 
                {...item} 
                setActiveAdminTab={setActiveAdminTab} // Pass setActiveAdminTab for all
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

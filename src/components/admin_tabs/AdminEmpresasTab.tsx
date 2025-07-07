

import React, { useState } from 'react';
import { StoredRfcInfo } from '../../types';
import { Pagination } from '../common/Pagination';

interface AdminEmpresasTabProps {
  storedRfcsList: StoredRfcInfo[];
  onNavigateToConfig: (rfc?: string) => void;
}

const ITEMS_PER_PAGE = 10;

export const AdminEmpresasTab: React.FC<AdminEmpresasTabProps> = ({ storedRfcsList, onNavigateToConfig }) => {
  const [currentPage, setCurrentPage] = useState(1);
  
  const handleAddEmpresa = () => {
    onNavigateToConfig(); // Navigates to config page for new RFC
  };

  const handleEditEmpresa = (rfc: StoredRfcInfo) => {
    // Option 1: Navigate to config for this specific RFC
    // onNavigateToConfig(rfc.rfc); 
    // Option 2: Alert, as direct edit here is complex
    alert(`La edición de la empresa '${rfc.nombreEmpresa}' (${rfc.rfc}) se realiza a través de la pestaña 'Configuración' en el dashboard principal después de seleccionarla. Esta acción en el panel de admin es una futura mejora.`);
  };
  
  const handleDeleteEmpresa = (rfc: StoredRfcInfo) => {
    alert(`La eliminación de la empresa '${rfc.nombreEmpresa}' (${rfc.rfc}) es una acción crítica que debe realizarse con precaución y reglas de backend adecuadas. Esta funcionalidad no está implementada directamente aquí.`);
  };

  // Pagination logic
  const totalPages = Math.ceil(storedRfcsList.length / ITEMS_PER_PAGE);
  const paginatedEmpresas = storedRfcsList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);


  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-slate-700"><i className="fas fa-building mr-2"></i>Empresas Registradas</h2>
        <button 
            onClick={handleAddEmpresa}
            className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors flex items-center">
          <i className="fas fa-plus-circle mr-2"></i>Agregar Empresa (Ir a Config.)
        </button>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm text-left text-slate-500">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50">
              <tr>
                {/* <th scope="col" className="px-6 py-3 w-10">
                  <input type="checkbox" className="form-checkbox h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500" />
                </th> */}
                <th scope="col" className="px-6 py-3">
                  Nombre de la Empresa
                </th>
                <th scope="col" className="px-6 py-3">
                  RFC
                </th>
                <th scope="col" className="px-6 py-3 text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedEmpresas.map((empresa) => (
                <tr key={empresa.rfc} className="bg-white border-b hover:bg-slate-50">
                  {/* <td className="px-6 py-4">
                    <input type="checkbox" className="form-checkbox h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500" />
                  </td> */}
                  <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                    {empresa.nombreEmpresa}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {empresa.rfc}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <button onClick={() => handleEditEmpresa(empresa)} className="text-blue-600 hover:text-blue-800 mr-4" title="Editar Empresa">
                      <i className="fas fa-pencil-alt"></i>
                    </button>
                    <button onClick={() => handleDeleteEmpresa(empresa)} className="text-red-500 hover:text-red-700" title="Eliminar Empresa">
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </td>
                </tr>
              ))}
              {storedRfcsList.length === 0 && (
                <tr>
                    <td colSpan={4} className="text-center py-10 text-slate-500">
                        <i className="fas fa-city fa-2x mb-2"></i>
                        <p>No hay empresas registradas.</p>
                    </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {storedRfcsList.length > 0 && totalPages > 1 && (
         <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      )}
    </div>
  );
};

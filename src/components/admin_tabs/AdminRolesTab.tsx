

import React, { useState } from 'react';
import { AdminRole } from '../../types';
import { AdminRoleModal } from './AdminRoleModal';
import { Pagination } from '../common/Pagination';

const INITIAL_ROLES_MOCK: AdminRole[] = [
  { id: '1', nombre: 'Contador Despacho' },
  { id: '2', nombre: 'Solo Lectura' },
  { id: '3', nombre: 'Administrador Cliente' },
  { id: '4', nombre: 'Auxiliar Contable' },
  { id: '5', nombre: 'Auditor Externo' },
];

const ITEMS_PER_PAGE = 5;

export const AdminRolesTab: React.FC = () => {
  const [roles, setRoles] = useState<AdminRole[]>(INITIAL_ROLES_MOCK);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [roleToEdit, setRoleToEdit] = useState<AdminRole | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const handleOpenModal = (role?: AdminRole) => {
    setRoleToEdit(role || null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setRoleToEdit(null);
  };

  const handleSaveRole = (role: AdminRole) => {
    setRoles(prevRoles => {
      const existing = prevRoles.find(r => r.id === role.id);
      if (existing) {
        return prevRoles.map(r => r.id === role.id ? role : r);
      }
      return [...prevRoles, role];
    });
  };

  const handleDeleteRole = (roleId: string) => {
    if (window.confirm("¿Está seguro de que desea eliminar este rol? Esta acción no se puede deshacer.")) {
      setRoles(prevRoles => prevRoles.filter(r => r.id !== roleId));
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(roles.length / ITEMS_PER_PAGE);
  const paginatedRoles = roles.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-slate-700"><i className="fas fa-user-tag mr-2"></i>Gestión de Roles</h2>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors flex items-center">
          <i className="fas fa-plus mr-2"></i>Agregar Rol
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
                  Nombre del Rol
                </th>
                <th scope="col" className="px-6 py-3 text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedRoles.map((rol) => (
                <tr key={rol.id} className="bg-white border-b hover:bg-slate-50">
                  {/* <td className="px-6 py-4">
                    <input type="checkbox" className="form-checkbox h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500" />
                  </td> */}
                  <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                    {rol.nombre}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <button onClick={() => handleOpenModal(rol)} className="text-blue-600 hover:text-blue-800 mr-4" title="Editar Rol">
                      <i className="fas fa-pencil-alt"></i>
                    </button>
                    <button onClick={() => handleDeleteRole(rol.id)} className="text-red-500 hover:text-red-700" title="Eliminar Rol">
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </td>
                </tr>
              ))}
              {roles.length === 0 && (
                <tr>
                    <td colSpan={3} className="text-center py-10 text-slate-500">
                        <i className="fas fa-ghost fa-2x mb-2"></i>
                        <p>No hay roles definidos.</p>
                    </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {roles.length > 0 && totalPages > 1 && (
         <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      )}
      <AdminRoleModal isOpen={isModalOpen} onClose={handleCloseModal} onSave={handleSaveRole} roleToEdit={roleToEdit} />
    </div>
  );
};

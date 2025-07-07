

import React, { useState } from 'react';
import { AdminUser } from '../../types';
import { AdminUserModal } from './AdminUserModal';
import { Pagination } from '../common/Pagination';

interface AdminUsuariosTabProps {
  usersData: AdminUser[]; // Initial users data
}

const ITEMS_PER_PAGE = 5;

export const AdminUsuariosTab: React.FC<AdminUsuariosTabProps> = ({ usersData }) => {
  const [users, setUsers] = useState<AdminUser[]>(usersData);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<AdminUser | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const handleOpenModal = (user?: AdminUser) => {
    setUserToEdit(user || null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setUserToEdit(null);
  };

  const handleSaveUser = (user: AdminUser) => {
    setUsers(prevUsers => {
      const existing = prevUsers.find(u => u.id === user.id);
      if (existing) {
        return prevUsers.map(u => u.id === user.id ? user : u);
      }
      return [...prevUsers, user];
    });
  };

  const handleDeleteUser = (userId: string) => {
    if (window.confirm("¿Está seguro de que desea eliminar este usuario? Esta acción no se puede deshacer.")) {
      setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(users.length / ITEMS_PER_PAGE);
  const paginatedUsers = users.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-slate-700"><i className="fas fa-users-cog mr-2"></i>Gestión de Usuarios</h2>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors flex items-center">
          <i className="fas fa-user-plus mr-2"></i>Agregar Usuario
        </button>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm text-left text-slate-500">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50">
              <tr>
                {/* <th scope="col" className="px-4 py-3 w-10">
                  <input type="checkbox" className="form-checkbox h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500" />
                </th> */}
                <th scope="col" className="px-4 py-3">Nombre</th>
                <th scope="col" className="px-4 py-3">Correo</th>
                <th scope="col" className="px-4 py-3">Empresa Base</th>
                <th scope="col" className="px-4 py-3">Tipo Usuario</th>
                <th scope="col" className="px-4 py-3 text-center">Sesiones</th>
                <th scope="col" className="px-4 py-3 text-center">Estatus</th>
                <th scope="col" className="px-4 py-3">Última Sesión</th>
                <th scope="col" className="px-4 py-3 text-center">Activo</th>
                <th scope="col" className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map((user) => (
                <tr key={user.id} className="bg-white border-b hover:bg-slate-50">
                  {/* <td className="px-4 py-3">
                    <input type="checkbox" className="form-checkbox h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500" />
                  </td> */}
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{user.nombre}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{user.correo}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{user.empresaBase}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{user.tipoUsuario}</td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">{user.numeroSesiones}</td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.estatus === 'Activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user.estatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{new Date(user.ultimaSesion).toLocaleDateString('es-MX')}</td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">{user.activoSistema ? 'Sí' : 'No'}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => handleOpenModal(user)} className="text-blue-600 hover:text-blue-800 mr-3" title="Editar Usuario">
                      <i className="fas fa-pencil-alt"></i>
                    </button>
                    <button onClick={() => handleDeleteUser(user.id)} className="text-red-500 hover:text-red-700" title="Eliminar Usuario">
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                 <tr>
                    <td colSpan={9} className="text-center py-10 text-slate-500">
                        <i className="fas fa-users-slash fa-2x mb-2"></i>
                        <p>No hay usuarios para mostrar.</p>
                    </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {users.length > 0 && totalPages > 1 && (
         <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      )}
      <AdminUserModal isOpen={isModalOpen} onClose={handleCloseModal} onSave={handleSaveUser} userToEdit={userToEdit} />
    </div>
  );
};

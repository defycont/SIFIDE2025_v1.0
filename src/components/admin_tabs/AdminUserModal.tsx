
import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { AdminUser, AdminRole } from '../../types'; // Assuming AdminRole might be used for role selection

// Sample roles for dropdown - in a real app, this would come from a data source or props
const MOCK_SYSTEM_ROLES: AdminRole[] = [
  { id: 'admin-despacho', nombre: 'Admin Despacho' },
  { id: 'contador-despacho', nombre: 'Contador Despacho' },
  { id: 'solo-lectura', nombre: 'Solo Lectura' },
];


interface AdminUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: AdminUser) => void;
  userToEdit?: AdminUser | null;
  // roles: AdminRole[]; // Pass actual roles if available
}

export const AdminUserModal: React.FC<AdminUserModalProps> = ({ isOpen, onClose, onSave, userToEdit }) => {
  const initialUserState: AdminUser = {
    id: Date.now().toString(),
    nombre: '',
    correo: '',
    empresaBase: 'DEFYCONT ASESORES', // Default or make selectable
    tipoUsuario: MOCK_SYSTEM_ROLES[0]?.id || '', // Default to first role
    numeroSesiones: 0,
    estatus: 'Activo',
    ultimaSesion: new Date().toISOString(),
    activoSistema: true,
    contrasena: ''
  };

  const [user, setUser] = useState<AdminUser>(initialUserState);
  const [isNewUser, setIsNewUser] = useState(true);

  useEffect(() => {
    if (userToEdit) {
      setUser({...userToEdit, contrasena: ''}); // Don't prefill password for editing
      setIsNewUser(false);
    } else {
      setUser(initialUserState);
      setIsNewUser(true);
    }
  }, [userToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setUser(prev => ({ ...prev, [name]: checked }));
    } else {
        setUser(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.nombre.trim() || !user.correo.trim()) {
      alert('Nombre y Correo son campos obligatorios.');
      return;
    }
    if (isNewUser && !user.contrasena?.trim()) {
        alert('La contraseña es obligatoria para nuevos usuarios.');
        return;
    }
    // In a real app, password would be hashed before saving if new/changed
    onSave(user);
    onClose();
  };

  const modalTitle = userToEdit ? 'Editar Usuario' : 'Agregar Nuevo Usuario';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="nombre" className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo</label>
          <input type="text" name="nombre" id="nombre" value={user.nombre} onChange={handleChange} required className="w-full p-2 border border-slate-300 rounded-md"/>
        </div>
        <div>
          <label htmlFor="correo" className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico</label>
          <input type="email" name="correo" id="correo" value={user.correo} onChange={handleChange} required className="w-full p-2 border border-slate-300 rounded-md"/>
        </div>
        <div>
          <label htmlFor="contrasena" className="block text-sm font-medium text-slate-700 mb-1">
            Contraseña {isNewUser ? '' : '(Dejar en blanco para no cambiar)'}
          </label>
          <input type="password" name="contrasena" id="contrasena" value={user.contrasena} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded-md" placeholder={isNewUser ? "Nueva contraseña" : "Nueva contraseña (opcional)"} />
        </div>
        <div>
          <label htmlFor="empresaBase" className="block text-sm font-medium text-slate-700 mb-1">Empresa Base</label>
          <input type="text" name="empresaBase" id="empresaBase" value={user.empresaBase} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded-md"/>
        </div>
        <div>
          <label htmlFor="tipoUsuario" className="block text-sm font-medium text-slate-700 mb-1">Tipo de Usuario (Rol)</label>
          <select name="tipoUsuario" id="tipoUsuario" value={user.tipoUsuario} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded-md">
            {MOCK_SYSTEM_ROLES.map(role => (
              <option key={role.id} value={role.id}>{role.nombre}</option>
            ))}
          </select>
        </div>
         <div>
          <label htmlFor="estatus" className="block text-sm font-medium text-slate-700 mb-1">Estatus</label>
          <select name="estatus" id="estatus" value={user.estatus} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded-md">
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
          </select>
        </div>
        <div className="flex items-center">
            <input type="checkbox" name="activoSistema" id="activoSistema" checked={user.activoSistema} onChange={handleChange} className="h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"/>
            <label htmlFor="activoSistema" className="ml-2 block text-sm text-slate-700">Usuario activo en el sistema</label>
        </div>

        <div className="flex justify-end space-x-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md">Cancelar</button>
          <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md">{userToEdit ? 'Guardar Cambios' : 'Crear Usuario'}</button>
        </div>
      </form>
    </Modal>
  );
};

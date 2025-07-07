
import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { AdminRole } from '../../types';

interface AdminRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (role: AdminRole) => void;
  roleToEdit?: AdminRole | null;
}

export const AdminRoleModal: React.FC<AdminRoleModalProps> = ({ isOpen, onClose, onSave, roleToEdit }) => {
  const [roleName, setRoleName] = useState('');
  const [roleId, setRoleId] = useState('');

  useEffect(() => {
    if (roleToEdit) {
      setRoleName(roleToEdit.nombre);
      setRoleId(roleToEdit.id);
    } else {
      setRoleName('');
      setRoleId(Date.now().toString()); // Simple ID generation for new roles
    }
  }, [roleToEdit, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim()) {
      alert('El nombre del rol no puede estar vacío.');
      return;
    }
    onSave({ id: roleId, nombre: roleName.trim() });
    onClose();
  };

  const modalTitle = roleToEdit ? 'Editar Rol' : 'Agregar Nuevo Rol';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="roleName" className="block text-sm font-medium text-slate-700 mb-1">
            Nombre del Rol
          </label>
          <input
            type="text"
            id="roleName"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            required
            placeholder="Ej: Administrador, Contador"
          />
        </div>
        {/* Future: Add permission selection here */}
        <div className="flex justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            {roleToEdit ? 'Guardar Cambios' : 'Crear Rol'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

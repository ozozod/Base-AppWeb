import React, { useState, useEffect, useMemo } from 'react';
import { User, Role, Transaction } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { useTable } from '../../hooks/useTable';
import { Pagination } from '../ui/Pagination';
import { SortableHeader } from '../ui/SortableHeader';
import { UserDetailModal } from './UserDetailModal';
import { api } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import { EmptyState } from '../ui/EmptyState';
import { SearchInput } from '@/components/ui/SearchInput';
import { Tooltip } from '../ui/Tooltip';

interface UsersTabProps {
    users: User[];
    transactions: Transaction[];
    eventId: string;
    onDataChange: () => void;
}

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

const UsersTab: React.FC<UsersTabProps> = ({ users, transactions, eventId, onDataChange }) => {
    const [isModalOpen, setModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [deletingUser, setDeletingUser] = useState<User | null>(null);
    const [userData, setUserData] = useState({ name: '', role: Role.SELLER, cardUid: '', employeeNumber: '' });
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const { showToast } = useToast();
    const [filter, setFilter] = useState('');

    const filteredUsers = useMemo(() => {
        return users.filter(user => 
            user.name.toLowerCase().includes(filter.toLowerCase()) ||
            user.cardUid.toLowerCase().includes(filter.toLowerCase()) ||
            user.employeeNumber?.toLowerCase().includes(filter.toLowerCase())
        );
    }, [users, filter]);

    const { 
        paginatedItems, 
        requestSort, 
        sortConfig, 
        currentPage, 
        totalPages, 
        setPage 
    } = useTable(filteredUsers, 'name', 10);

    useEffect(() => {
        if (editingUser) {
            setUserData({
                name: editingUser.name,
                role: editingUser.role,
                cardUid: editingUser.cardUid,
                employeeNumber: editingUser.employeeNumber || ''
            });
        } else {
            setUserData({ name: '', role: Role.SELLER, cardUid: '', employeeNumber: '' });
        }
    }, [editingUser]);

    const openCreateModal = () => {
        setEditingUser(null);
        setModalOpen(true);
    };

    const openEditModal = (user: User) => {
        setEditingUser(user);
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingUser(null);
    };
    
    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (editingUser) {
                await api.updateUser(eventId, editingUser.id, userData);
                showToast('Usuario actualizado correctamente.', 'success');
            } else {
                await api.createUser(eventId, userData.name, userData.role, userData.cardUid, userData.employeeNumber);
                showToast('Usuario creado correctamente.', 'success');
            }
            onDataChange();
            closeModal();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to save user.";
            showToast(message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleActive = async (user: User) => {
        try {
            await api.updateUser(eventId, user.id, { is_active: !user.is_active });
            showToast(`Usuario ${user.is_active ? 'desactivado' : 'activado'} correctamente.`, 'success');
            onDataChange();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to update user status.";
            showToast(message, 'error');
        }
    }

    const handleDeleteUser = async () => {
        if (!deletingUser) return;
        setIsSubmitting(true);
        try {
            await api.deleteUser(eventId, deletingUser.id);
            showToast('Usuario eliminado correctamente.', 'success');
            onDataChange();
            setDeletingUser(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to delete user.";
            showToast(message, 'error');
            setDeletingUser(null);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-white">Gestión de Personal ({users.length})</h3>
                <Button onClick={openCreateModal}>Crear Usuario</Button>
            </div>

            <div className="mb-4">
                <SearchInput
                    placeholder="Filtrar por Nombre, UID o Número..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-full max-w-xs"
                />
            </div>
            
             <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-700">
                        <tr>
                            <SortableHeader label="Nombre" sortKey="name" sortConfig={sortConfig} onRequestSort={requestSort} />
                            <SortableHeader label="Número" sortKey="employeeNumber" sortConfig={sortConfig} onRequestSort={requestSort} />
                            <SortableHeader label="Rol" sortKey="role" sortConfig={sortConfig} onRequestSort={requestSort} />
                            <SortableHeader label="UID Tarjeta" sortKey="cardUid" sortConfig={sortConfig} onRequestSort={requestSort} />
                            <SortableHeader label="Estado" sortKey="is_active" sortConfig={sortConfig} onRequestSort={requestSort} />
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {paginatedItems.map(user => (
                            <tr key={user.id} className="odd:bg-gray-800 even:bg-gray-700/50 hover:bg-gray-700 transition-colors duration-200">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-white cursor-pointer" onClick={() => setSelectedUser(user)}>{user.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 cursor-pointer" onClick={() => setSelectedUser(user)}>{user.employeeNumber || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 cursor-pointer" onClick={() => setSelectedUser(user)}>{user.role}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-cyan-400 cursor-pointer" onClick={() => setSelectedUser(user)}>{user.cardUid}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <ToggleSwitch
                                        enabled={user.is_active}
                                        onChange={() => handleToggleActive(user)}
                                        label={user.is_active ? 'Activo' : 'Inactivo'}
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex justify-end items-center gap-2">
                                        <Tooltip text="Editar Usuario">
                                            <Button variant="secondary" size="small" icon={<EditIcon />} onClick={() => openEditModal(user)} />
                                        </Tooltip>
                                        <Tooltip text="Eliminar Usuario">
                                            <Button variant="danger" size="small" icon={<DeleteIcon />} onClick={() => setDeletingUser(user)} />
                                        </Tooltip>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {filteredUsers.length === 0 && (
                <EmptyState 
                    title={filter ? "No se encontraron usuarios" : "No hay personal registrado"}
                    message={filter ? "Prueba con otro término de búsqueda." : "Para comenzar a operar, primero debes registrar a los miembros del personal (cajeros, vendedores, etc.)."}
                    buttonText="Crear Usuario"
                    onButtonClick={openCreateModal}
                />
            )}

            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />

            <UserDetailModal user={selectedUser} transactions={transactions} onClose={() => setSelectedUser(null)} />

            <Modal isOpen={isModalOpen} onClose={closeModal} title={editingUser ? "Editar Usuario" : "Crear Nuevo Usuario de Personal"}>
                <form onSubmit={handleSaveUser}>
                     <div className="space-y-4">
                        <div>
                             <label htmlFor="userName" className="block text-sm font-medium text-gray-300 mb-1">Nombre</label>
                             <input id="userName" name="userName" type="text" value={userData.name} onChange={e => setUserData({...userData, name: e.target.value})} required className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500"/>
                        </div>
                        <div>
                             <label htmlFor="userRole" className="block text-sm font-medium text-gray-300 mb-1">Rol</label>
                             <select id="userRole" name="userRole" value={userData.role} onChange={e => setUserData({...userData, role: e.target.value as Role})} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500">
                                {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                             </select>
                        </div>
                        <div>
                             <label htmlFor="employeeNumber" className="block text-sm font-medium text-gray-300 mb-1">Número de Empleado</label>
                             <input id="employeeNumber" name="employeeNumber" type="text" value={userData.employeeNumber} onChange={e => setUserData({...userData, employeeNumber: e.target.value})} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500"/>
                        </div>
                        <div>
                             <label htmlFor="userCardUid" className="block text-sm font-medium text-gray-300 mb-1">UID de Tarjeta Asociada</label>
                             <input id="userCardUid" name="userCardUid" type="text" value={userData.cardUid} onChange={e => setUserData({...userData, cardUid: e.target.value.toUpperCase()})} required className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500"/>
                        </div>
                     </div>
                     <div className="flex justify-end gap-3 mt-6">
                         <Button type="button" variant="secondary" onClick={closeModal} disabled={isSubmitting}>Cancelar</Button>
                         <Button type="submit" isLoading={isSubmitting} disabled={!userData.name.trim() || !userData.cardUid.trim()}>Guardar</Button>
                     </div>
                </form>
            </Modal>

            <Modal isOpen={!!deletingUser} onClose={() => setDeletingUser(null)} title="Confirmar Eliminación">
                {deletingUser && (
                    <div>
                        <p className="text-gray-300 mb-4">
                            ¿Estás seguro de que quieres eliminar al usuario "<strong>{deletingUser.name}</strong>"?
                            <br />
                            <strong className="text-yellow-400">Esta acción no se puede deshacer.</strong>
                        </p>
                        <div className="flex justify-end gap-3">
                            <Button type="button" variant="secondary" onClick={() => setDeletingUser(null)} disabled={isSubmitting}>
                                Cancelar
                            </Button>
                            <Button type="button" variant="danger" onClick={handleDeleteUser} isLoading={isSubmitting}>
                                Sí, eliminar
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </Card>
    );
};

export default UsersTab;
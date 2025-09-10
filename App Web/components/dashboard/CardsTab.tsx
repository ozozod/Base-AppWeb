import React, { useState, useMemo, useEffect } from 'react';
import { Card as CardType } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { useTable } from '../../hooks/useTable';
import { Pagination } from '../ui/Pagination';
import { SortableHeader } from '../ui/SortableHeader';
import { CardDetailModal } from './CardDetailModal';
import { api } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import { EmptyState } from '../ui/EmptyState';
import { SearchInput } from '@/components/ui/SearchInput';
import { Tooltip } from '../ui/Tooltip';

interface CardsTabProps {
    cards: CardType[];
    eventId: string;
    onDataChange: () => void;
}

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

const CardsTab: React.FC<CardsTabProps> = ({ cards, eventId, onDataChange }) => {
    const [filter, setFilter] = useState('');
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingCard, setEditingCard] = useState<CardType | null>(null);
    const [deletingCard, setDeletingCard] = useState<CardType | null>(null);
    const [cardData, setCardData] = useState({ customerNumber: '', uid: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
    const { showToast } = useToast();

    useEffect(() => {
        if (editingCard) {
            setCardData({
                uid: editingCard.uid,
                customerNumber: editingCard.customerNumber || ''
            });
        } else {
            setCardData({ uid: '', customerNumber: '' });
        }
    }, [editingCard]);
    
    const openCreateModal = () => {
        setEditingCard(null);
        setModalOpen(true);
    };

    const openEditModal = (card: CardType) => {
        setEditingCard(card);
        setModalOpen(true);
    };
    
    const closeModal = () => {
        setModalOpen(false);
        setEditingCard(null);
    }

    const handleToggleStatus = async (card: CardType) => {
        try {
            await api.updateCard(eventId, card.uid, { is_active: !card.is_active });
            showToast(`La tarjeta ha sido ${card.is_active ? 'bloqueada' : 'activada'}.`, 'success');
            onDataChange();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error al actualizar el estado de la tarjeta.';
            showToast(message, 'error');
        }
    };

    const handleSaveCard = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (editingCard) {
                await api.updateCard(eventId, editingCard.uid, { customerNumber: cardData.customerNumber });
                showToast('Comprador actualizado correctamente.', 'success');
            } else {
                await api.createCard(eventId, cardData.uid, cardData.customerNumber);
                showToast('Comprador registrado correctamente.', 'success');
            }
            onDataChange();
            closeModal();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Error al guardar la tarjeta.";
            showToast(message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDeleteCard = async () => {
        if (!deletingCard) return;
        setIsSubmitting(true);
        try {
            await api.deleteCard(eventId, deletingCard.uid);
            showToast('Comprador eliminado correctamente.', 'success');
            onDataChange();
            setDeletingCard(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Error al eliminar la tarjeta.";
            showToast(message, 'error');
            setDeletingCard(null);
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredCards = useMemo(() => cards.filter(card => 
        card.uid.toLowerCase().includes(filter.toLowerCase()) ||
        card.customerNumber?.toLowerCase().includes(filter.toLowerCase())
    ), [cards, filter]);

    const { 
        paginatedItems, 
        requestSort, 
        sortConfig, 
        currentPage, 
        totalPages, 
        setPage 
    } = useTable(filteredCards, 'balance', 10, 'descending');

    return (
        <Card>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-white">Gestión de Compradores ({cards.length})</h3>
                <Button onClick={openCreateModal}>Registrar Comprador</Button>
            </div>

            <div className="mb-4">
                <SearchInput
                    placeholder="Filtrar por UID o Número..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-full max-w-xs"
                />
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-700">
                        <tr>
                            <SortableHeader label="UID" sortKey="uid" sortConfig={sortConfig} onRequestSort={requestSort} />
                            <SortableHeader label="Número" sortKey="customerNumber" sortConfig={sortConfig} onRequestSort={requestSort} />
                            <SortableHeader label="Saldo" sortKey="balance" sortConfig={sortConfig} onRequestSort={requestSort} />
                            <SortableHeader label="Estado" sortKey="is_active" sortConfig={sortConfig} onRequestSort={requestSort} />
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {paginatedItems.map(card => (
                            <tr key={card.uid} className="odd:bg-gray-800 even:bg-gray-700/50 hover:bg-gray-700 transition-colors duration-200">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-cyan-400 cursor-pointer" onClick={() => setSelectedCard(card)}>{card.uid}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 cursor-pointer" onClick={() => setSelectedCard(card)}>{card.customerNumber || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-semibold cursor-pointer" onClick={() => setSelectedCard(card)}>${Number(card.balance).toFixed(2)}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <ToggleSwitch 
                                        enabled={card.is_active} 
                                        onChange={() => handleToggleStatus(card)}
                                        label={card.is_active ? 'Activo' : 'Bloqueado'}
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex justify-end items-center gap-2">
                                        <Tooltip text="Editar Comprador">
                                            <Button variant="secondary" size="small" icon={<EditIcon />} onClick={() => openEditModal(card)} />
                                        </Tooltip>
                                        <Tooltip text="Eliminar Comprador">
                                            <Button variant="danger" size="small" icon={<DeleteIcon />} onClick={() => setDeletingCard(card)} />
                                        </Tooltip>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            {filteredCards.length === 0 && (
                <EmptyState 
                    title="No se encontraron compradores"
                    message="Parece que no hay compradores que coincidan con tu búsqueda, o aún no se ha registrado ninguno."
                    buttonText="Registrar Primer Comprador"
                    onButtonClick={openCreateModal}
                />
            )}
            
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />

            <CardDetailModal card={selectedCard} onClose={() => setSelectedCard(null)} />
        
            <Modal isOpen={isModalOpen} onClose={closeModal} title={editingCard ? 'Editar Comprador' : 'Registrar Nuevo Comprador'}>
                <form onSubmit={handleSaveCard}>
                     <div className="space-y-4">
                        <div>
                             <label htmlFor="customerNumber" className="block text-sm font-medium text-gray-300 mb-1">Número de Comprador <span className="text-gray-400">(Opcional)</span></label>
                             <input id="customerNumber" name="customerNumber" type="text" value={cardData.customerNumber} onChange={e => setCardData({...cardData, customerNumber: e.target.value})} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500"/>
                        </div>
                        <div>
                             <label htmlFor="cardUid" className="block text-sm font-medium text-gray-300 mb-1">UID de Tarjeta</label>
                             <input id="cardUid" name="cardUid" type="text" value={cardData.uid} onChange={e => setCardData({...cardData, uid: e.target.value.toUpperCase()})} required disabled={!!editingCard} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"/>
                        </div>
                     </div>
                     <div className="flex justify-end gap-3 mt-6">
                         <Button type="button" variant="secondary" onClick={closeModal} disabled={isSubmitting}>Cancelar</Button>
                         <Button type="submit" isLoading={isSubmitting} disabled={!cardData.uid.trim()}>Guardar</Button>
                     </div>
                </form>
            </Modal>
            
            <Modal isOpen={!!deletingCard} onClose={() => setDeletingCard(null)} title="Confirmar Eliminación">
                {deletingCard && (
                    <div>
                        <p className="text-gray-300 mb-4">
                            ¿Estás seguro de que quieres eliminar al comprador con el UID de tarjeta "<strong>{deletingCard.uid}</strong>"?
                            <br />
                            <strong className="text-red-400">Esta acción es irreversible.</strong>
                        </p>
                        <div className="flex justify-end gap-3 mt-6">
                            <Button type="button" variant="secondary" onClick={() => setDeletingCard(null)} disabled={isSubmitting}>
                                Cancelar
                            </Button>
                            <Button type="button" variant="danger" onClick={handleDeleteCard} isLoading={isSubmitting}>
                                Sí, eliminar
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </Card>
    );
};

export default CardsTab;
import React, { useState } from 'react';
import { Event } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

interface EventListProps {
    events: Event[];
    onSelectEvent: (event: Event) => void;
    onCreateEvent: (eventName: string) => Promise<void>;
    onUpdateEventStatus: (eventId: string, status: 'activo' | 'finalizado') => Promise<void>;
    onDeleteEvent: (eventId: string) => Promise<void>;
}

const EventList: React.FC<EventListProps> = ({ events, onSelectEvent, onCreateEvent, onUpdateEventStatus, onDeleteEvent }) => {
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [newEventName, setNewEventName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
    const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEventName.trim()) return;
        setIsCreating(true);
        await onCreateEvent(newEventName);
        setIsCreating(false);
        setNewEventName('');
        setCreateModalOpen(false);
    };

    const handleActivate = async (e: React.MouseEvent, eventId: string) => {
        e.stopPropagation();
        setIsUpdatingStatus(eventId);
        await onUpdateEventStatus(eventId, 'activo');
        setIsUpdatingStatus(null);
    };

    const handleConfirmDelete = async () => {
        if (!eventToDelete) return;
        setIsDeleting(true);
        await onDeleteEvent(eventToDelete.id);
        setIsDeleting(false);
        setEventToDelete(null);
    };


    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold tracking-tight text-white">Eventos</h2>
                <Button onClick={() => setCreateModalOpen(true)}>Crear Evento</Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map(event => (
                    <Card key={event.id} className="hover:bg-gray-700 transition-colors duration-200 flex flex-col justify-between" >
                        <div onClick={() => onSelectEvent(event)} className="cursor-pointer flex-grow">
                            <h3 className="text-xl font-semibold text-white">{event.name}</h3>
                            <p className="text-sm text-gray-400">Creado: {new Date(event.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between items-center">
                             <span className={`px-3 py-1 text-xs font-medium rounded-full capitalize ${event.status === 'activo' ? 'bg-green-500 text-green-900' : 'bg-gray-600 text-gray-200'}`}>
                                {event.status}
                            </span>
                            <div className="flex items-center space-x-2">
                                {event.status === 'finalizado' && (
                                    <Button 
                                        size="small" 
                                        onClick={(e) => handleActivate(e, event.id)}
                                        isLoading={isUpdatingStatus === event.id}
                                        disabled={!!isUpdatingStatus}
                                    >
                                        Activar
                                    </Button>
                                )}
                                 <Button
                                    size="small"
                                    variant="danger"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setEventToDelete(event);
                                    }}
                                >
                                    Eliminar
                                </Button>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            <Modal isOpen={isCreateModalOpen} onClose={() => setCreateModalOpen(false)} title="Crear Nuevo Evento">
                <form onSubmit={handleCreate}>
                    <div className="mb-4">
                        <label htmlFor="eventName" className="block text-sm font-medium text-gray-300 mb-1">Nombre del Evento</label>
                        <input
                            id="eventName"
                            type="text"
                            value={newEventName}
                            onChange={(e) => setNewEventName(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                            placeholder="Ej: Concierto de Rock 2025"
                            required
                        />
                    </div>
                    <div className="flex justify-end gap-3">
                         <Button type="button" variant="secondary" onClick={() => setCreateModalOpen(false)} disabled={isCreating}>
                            Cancelar
                        </Button>
                        <Button type="submit" isLoading={isCreating} disabled={!newEventName.trim()}>
                            Crear Evento
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={!!eventToDelete} onClose={() => setEventToDelete(null)} title="Confirmar Eliminación">
                {eventToDelete && (
                    <div>
                        <p className="text-gray-300 mb-4">
                            ¿Estás seguro de que quieres eliminar el evento "<strong>{eventToDelete.name}</strong>"?
                            <br />
                            <strong className="text-red-400">Esta acción es irreversible y eliminará todos los datos asociados (clientes, transacciones, etc.).</strong>
                        </p>
                        <div className="flex justify-end gap-3">
                            <Button type="button" variant="secondary" onClick={() => setEventToDelete(null)} disabled={isDeleting}>
                                Cancelar
                            </Button>
                            <Button type="button" variant="danger" onClick={handleConfirmDelete} isLoading={isDeleting}>
                                Sí, eliminar
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default EventList;
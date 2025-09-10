import React, { useState, useEffect } from 'react';
import { Event } from './types';
import EventList from './components/events/EventList';
import EventDashboard from './components/dashboard/EventDashboard';
import { Spinner } from './components/ui/Spinner';
import { api } from './services/api';
import { ErrorMessage } from './components/ui/ErrorMessage';
import { ToastProvider } from './contexts/ToastContext';

const App: React.FC = () => {
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const handleError = (err: unknown, defaultMessage: string) => {
        const message = (err instanceof Error) ? err.message : defaultMessage;
        setError(message);
        console.error(err);
    };

    const fetchEvents = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const fetchedEvents = await api.getEvents();
            setEvents(fetchedEvents);
        } catch (err) {
            handleError(err, 'Error al cargar los eventos. Por favor, compruebe la conexión con el servidor local.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();
    }, []);
    
    const handleCreateEvent = async (eventName: string) => {
        try {
            await api.createEvent(eventName);
            await fetchEvents();
        } catch (err) {
            handleError(err, 'Error al crear el evento.');
        }
    };

    const handleUpdateEventStatus = async (eventId: string, status: 'activo' | 'finalizado') => {
        try {
            await api.updateEventStatus(eventId, status);
            await fetchEvents();
        } catch (err) {
            handleError(err, 'Error al actualizar el estado del evento.');
        }
    };

    const handleDeleteEvent = async (eventId: string) => {
        try {
            await api.deleteEvent(eventId);
            await fetchEvents(); // Refetch to show updated list
        } catch (err) {
            handleError(err, 'Error al eliminar el evento.');
        }
    };

    const handleSelectEvent = (event: Event) => {
        setSelectedEvent(event);
    };

    const handleBackToList = () => {
        setSelectedEvent(null);
        // Refetch events when going back in case statuses were changed indirectly
        fetchEvents();
    };

    return (
        <ToastProvider>
            <div className="min-h-screen bg-gray-900 text-gray-200 font-sans">
                <header className="bg-gray-800 shadow-md">
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                        <h1 className="text-2xl font-bold text-white tracking-tight">
                            Sistema de Gestión de Eventos NFC
                        </h1>
                    </div>
                </header>
                <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {isLoading && (
                        <div className="flex justify-center items-center h-64">
                            <Spinner />
                        </div>
                    )}
                    {error && <ErrorMessage error={error} />}
                    {!isLoading && !error && (
                        <>
                            {selectedEvent ? (
                                <EventDashboard event={selectedEvent} onBack={handleBackToList} />
                            ) : (
                                <EventList 
                                    events={events} 
                                    onSelectEvent={handleSelectEvent} 
                                    onCreateEvent={handleCreateEvent}
                                    onUpdateEventStatus={handleUpdateEventStatus}
                                    onDeleteEvent={handleDeleteEvent}
                                />
                            )}
                        </>
                    )}
                </main>
            </div>
        </ToastProvider>
    );
};

export default App;
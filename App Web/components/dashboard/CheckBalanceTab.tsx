
import React, { useState } from 'react';
import { Card as CardType } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { api } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { Spinner } from '../ui/Spinner';

interface CheckBalanceTabProps {
    eventId: string;
}

export const CheckBalanceTab: React.FC<CheckBalanceTabProps> = ({ eventId }) => {
    const [uid, setUid] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [cardDetails, setCardDetails] = useState<CardType | null>(null);
    const { showToast } = useToast();

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uid.trim()) {
            showToast('Por favor, ingrese un UID de tarjeta.', 'error');
            return;
        }
        setIsLoading(true);
        setCardDetails(null);
        try {
            const result = await api.getCustomerDetailsByUid(eventId, uid);
            setCardDetails(result);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'No se pudo encontrar la tarjeta.';
            showToast(message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const clearSearch = () => {
        setUid('');
        setCardDetails(null);
    };

    return (
        <Card className="max-w-2xl mx-auto">
            <h3 className="text-xl font-semibold mb-4 text-white">Consultar Saldo de Tarjeta</h3>
            <p className="text-gray-400 mb-6">
                Ingrese el UID de la tarjeta de un comprador para ver su saldo y estado actual de forma rápida.
            </p>
            
            {!cardDetails && !isLoading && (
                <form onSubmit={handleSearch} className="space-y-4">
                    <div>
                        <label htmlFor="checkBalanceUid" className="block text-sm font-medium text-gray-300 mb-1">
                            UID de la Tarjeta del Comprador
                        </label>
                        <input
                            id="checkBalanceUid"
                            name="checkBalanceUid"
                            type="text"
                            placeholder="Escanee o ingrese UID"
                            value={uid}
                            onChange={e => setUid(e.target.value.toUpperCase())}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white font-mono focus:ring-2 focus:ring-cyan-500"
                            autoFocus
                        />
                    </div>
                    <Button type="submit" isLoading={isLoading} className="w-full">
                        Buscar Tarjeta
                    </Button>
                </form>
            )}

            {isLoading && (
                <div className="flex justify-center items-center h-40">
                    <Spinner />
                </div>
            )}
            
            {cardDetails && (
                <div>
                    <h4 className="text-lg font-semibold text-white mb-3">Resultados de la Búsqueda</h4>
                    <div className="grid grid-cols-2 gap-4 bg-gray-700 p-4 rounded-md">
                         <div>
                            <p className="text-sm text-gray-400">Número Cliente</p>
                            <p className="font-semibold text-white">{cardDetails.customerNumber || 'N/A'}</p>
                        </div>
                         <div>
                            <p className="text-sm text-gray-400">UID</p>
                            <p className="font-mono text-cyan-400 text-sm">{cardDetails.uid}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Saldo Actual</p>
                            <p className="font-bold text-2xl text-white">${Number(cardDetails.balance).toFixed(2)}</p>
                        </div>
                         <div>
                            <p className="text-sm text-gray-400">Estado</p>
                            <p>
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${cardDetails.is_active ? 'bg-green-500 text-green-900' : 'bg-red-500 text-red-900'}`}>
                                    {cardDetails.is_active ? 'Activa' : 'Bloqueada'}
                                </span>
                            </p>
                        </div>
                    </div>
                    <div className="mt-6">
                        <Button variant="secondary" onClick={clearSearch} className="w-full">
                            Realizar otra consulta
                        </Button>
                    </div>
                </div>
            )}
        </Card>
    );
};

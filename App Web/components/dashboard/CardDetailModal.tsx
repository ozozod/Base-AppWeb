import React from 'react';
import { Modal } from '../ui/Modal';
import { Card as CardType, Transaction, TransactionType } from '../../types';

interface CardDetailModalProps {
    card: CardType | null;
    onClose: () => void;
}

const getTransactionTypeStyles = (type: TransactionType) => {
    switch (type) {
        case TransactionType.SALE: return 'bg-yellow-500 text-yellow-900';
        case TransactionType.RELOAD: return 'bg-green-500 text-green-900';
        case TransactionType.VOID: return 'bg-red-500 text-red-900';
        case TransactionType.REFUND: return 'bg-sky-500 text-sky-900';
        default: return 'bg-gray-500 text-gray-900';
    }
};

export const CardDetailModal: React.FC<CardDetailModalProps> = ({ card, onClose }) => {
    if (!card) return null;

    return (
        <Modal isOpen={!!card} onClose={onClose} title={`Detalles del Cliente: ${card.customerNumber || card.uid}`}>
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 bg-gray-700 p-3 rounded-md">
                    <div>
                        <p className="text-xs text-gray-400">UID</p>
                        <p className="font-mono text-cyan-400">{card.uid}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400">Número</p>
                        <p>{card.customerNumber || 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400">Saldo Actual</p>
                        <p className="font-bold text-lg text-white">${Number(card.balance).toFixed(2)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400">Estado</p>
                        <p>
                             <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${card.is_active ? 'bg-green-500 text-green-900' : 'bg-red-500 text-red-900'}`}>
                                {card.is_active ? 'Activo' : 'Bloqueado'}
                            </span>
                        </p>
                    </div>
                </div>

                <div>
                    <h4 className="text-md font-semibold text-white mb-2">Historial de Transacciones</h4>
                    <div className="max-h-64 overflow-y-auto bg-gray-900 rounded-md p-2">
                        {card.history && card.history.length > 0 ? (
                            <table className="min-w-full text-sm">
                                <thead className="text-xs text-gray-400 uppercase">
                                    <tr>
                                        <th className="text-left p-2">Fecha</th>
                                        <th className="text-left p-2">Tipo</th>
                                        <th className="text-right p-2">Monto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...card.history].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(tx => (
                                        <tr key={tx.id} className="border-b border-gray-700 last:border-0">
                                            <td className="p-2 text-gray-400">{new Date(tx.timestamp).toLocaleString()}</td>
                                            <td className="p-2">
                                                <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${getTransactionTypeStyles(tx.type)}`}>
                                                    {tx.type}
                                                </span>
                                            </td>
                                            <td className={`p-2 text-right font-semibold ${Number(tx.amount) > 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                                                {Number(tx.amount) > 0 ? `+$${Number(tx.amount).toFixed(2)}` : `-$${Math.abs(Number(tx.amount)).toFixed(2)}`}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p className="text-center text-gray-500 py-4">No hay transacciones registradas.</p>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};
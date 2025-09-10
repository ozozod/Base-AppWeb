import React, { useState, useMemo } from 'react';
import { Transaction, User, TransactionType } from '../../types';
import { Card } from '../ui/Card';
import { useTable } from '../../hooks/useTable';
import { Pagination } from '../ui/Pagination';
import { SortableHeader } from '../ui/SortableHeader';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { api } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { EmptyState } from '../ui/EmptyState';

interface TransactionsTabProps {
    transactions: Transaction[];
    users: User[];
    onDataChange: () => void;
}

export const TransactionsTab: React.FC<TransactionsTabProps> = ({ transactions, users, onDataChange }) => {
    const [filterType, setFilterType] = useState<string>('');
    const [filterUser, setFilterUser] = useState<string>('');
    
    const [voidingTx, setVoidingTx] = useState<Transaction | null>(null);
    const [managerUid, setManagerUid] = useState('');
    const [isVoiding, setIsVoiding] = useState(false);
    const { showToast } = useToast();
    
    const usersMap = useMemo(() => new Map(users.map(u => [u.id, u.name])), [users]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(tx => {
            const typeMatch = filterType ? tx.type === filterType : true;
            const userMatch = filterUser ? tx.userId === filterUser : true;
            return typeMatch && userMatch;
        });
    }, [transactions, filterType, filterUser]);

    const { 
        paginatedItems, 
        requestSort, 
        sortConfig, 
        currentPage, 
        totalPages, 
        setPage 
    } = useTable(filteredTransactions, 'timestamp', 15, 'descending');

    const getTransactionTypeStyles = (type: TransactionType) => {
        switch (type) {
            case TransactionType.SALE: return 'bg-yellow-500 text-yellow-900';
            case TransactionType.RELOAD: return 'bg-green-500 text-green-900';
            case TransactionType.VOID: return 'bg-red-500 text-red-900';
            case TransactionType.REFUND: return 'bg-sky-500 text-sky-900';
            default: return 'bg-gray-500 text-gray-900';
        }
    };

    const openVoidModal = (tx: Transaction) => {
        setVoidingTx(tx);
        setManagerUid('');
    };

    const closeVoidModal = () => {
        setVoidingTx(null);
    };

    const handleVoidTransaction = async () => {
        if (!voidingTx || !managerUid) return;

        setIsVoiding(true);
        try {
            await api.createVoidTransaction(voidingTx.id, managerUid);
            showToast('Transacción anulada correctamente.', 'success');
            closeVoidModal();
            onDataChange();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            showToast(message, 'error');
        } finally {
            setIsVoiding(false);
        }
    };


    return (
        <Card>
            <h3 className="text-xl font-semibold mb-4 text-white">Historial de Transacciones ({transactions.length})</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                 <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                >
                    <option value="">Todos los Tipos</option>
                    {Object.values(TransactionType).map(type => (
                        <option key={type} value={type}>{type}</option>
                    ))}
                </select>
                <select
                    value={filterUser}
                    onChange={(e) => setFilterUser(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                >
                    <option value="">Todos los Usuarios</option>
                    {users.map(user => (
                        <option key={user.id} value={user.id}>{user.name}</option>
                    ))}
                </select>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-700">
                        <tr>
                            <SortableHeader label="Tipo" sortKey="type" sortConfig={sortConfig} onRequestSort={requestSort} />
                            <SortableHeader label="Monto" sortKey="amount" sortConfig={sortConfig} onRequestSort={requestSort} />
                            <SortableHeader label="Fecha/Hora" sortKey="timestamp" sortConfig={sortConfig} onRequestSort={requestSort} />
                            <SortableHeader label="Usuario" sortKey="userId" sortConfig={sortConfig} onRequestSort={requestSort} />
                            <SortableHeader label="Tarjeta Cliente" sortKey="customerCardUid" sortConfig={sortConfig} onRequestSort={requestSort} />
                            <SortableHeader label="Detalles" sortKey="details" sortConfig={sortConfig} onRequestSort={requestSort} />
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {paginatedItems.map(tx => (
                            <tr key={tx.id} className="odd:bg-gray-800 even:bg-gray-700/50 hover:bg-gray-700 transition-colors duration-200">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getTransactionTypeStyles(tx.type)}`}>
                                        {tx.type}
                                    </span>
                                </td>
                                <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${Number(tx.amount) >= 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                                     {`${Number(tx.amount) >= 0 ? '+' : '-'}$${Math.abs(Number(tx.amount)).toFixed(2)}`}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{new Date(tx.timestamp).toLocaleString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{usersMap.get(tx.userId) || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-cyan-400">{tx.customerCardUid}</td>
                                <td className="px-6 py-4 whitespace-normal text-sm text-gray-400 max-w-sm">{tx.details || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    {tx.type === TransactionType.SALE && (
                                        <Button
                                            variant="danger"
                                            size="small"
                                            onClick={() => openVoidModal(tx)}
                                        >
                                            Anular
                                        </Button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {filteredTransactions.length === 0 && <EmptyState title="No se encontraron transacciones" message="Intenta cambiar los filtros o realiza una nueva transacción para verla aquí." />}
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />

            <Modal isOpen={!!voidingTx} onClose={closeVoidModal} title="Anular Venta">
                {voidingTx && (
                    <div>
                        <p className="text-gray-300 mb-4">
                            Estás a punto de anular la transacción <strong>#{voidingTx.id}</strong> por un monto de <strong>${Math.abs(Number(voidingTx.amount)).toFixed(2)}</strong>.
                            <br/>
                            El saldo será devuelto a la tarjeta del cliente.
                        </p>
                        <p className="text-yellow-400 text-sm mb-4">
                            Esta acción requiere autorización de un encargado. Por favor, escanee o ingrese el UID de la tarjeta del encargado.
                        </p>
                        <div>
                            <label htmlFor="managerUid" className="block text-sm font-medium text-gray-300 mb-1">UID Tarjeta Encargado</label>
                            <input
                                id="managerUid"
                                name="managerUid"
                                type="text"
                                value={managerUid}
                                onChange={(e) => setManagerUid(e.target.value.toUpperCase())}
                                required
                                autoFocus
                                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white font-mono focus:ring-2 focus:ring-cyan-500"
                            />
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <Button type="button" variant="secondary" onClick={closeVoidModal} disabled={isVoiding}>
                                Cancelar
                            </Button>
                            <Button type="button" variant="danger" onClick={handleVoidTransaction} isLoading={isVoiding} disabled={!managerUid.trim()}>
                                Anular Venta
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </Card>
    );
};

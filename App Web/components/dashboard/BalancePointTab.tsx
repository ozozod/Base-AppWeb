import React, { useState } from 'react';
import { User, Role } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { api } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

interface BalancePointTabProps {
    users: User[];
    eventId: string;
    onDataChange: () => void;
}

const BalancePointTab: React.FC<BalancePointTabProps> = ({ users, eventId, onDataChange }) => {
    const [amount, setAmount] = useState('');
    const [customerCardUid, setCustomerCardUid] = useState('');
    const [selectedUserId, setSelectedUserId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [transactionToConfirm, setTransactionToConfirm] = useState<{ type: 'refund'; amount: number } | null>(null);
    const { showToast } = useToast();
    
    const cashiers = React.useMemo(() => 
        users.filter(u => u.is_active && (u.role === Role.CASHIER || u.role === Role.ADMINISTRATOR)), 
    [users]);
    
    const resetForm = () => {
        setAmount('');
        setCustomerCardUid('');
    };

    const executeTransaction = async (type: 'recharge' | 'refund', amountToProcess: number) => {
        setIsLoading(true);

        try {
            if (type === 'recharge') {
                await api.createRechargeTransaction(eventId, selectedUserId, customerCardUid, amountToProcess, 'Cash');
                showToast(`Recarga de $${amountToProcess.toFixed(2)} exitosa.`, 'success');
            } else {
                await api.createRefundTransaction(eventId, selectedUserId, customerCardUid, amountToProcess);
                showToast(`Devolución de $${amountToProcess.toFixed(2)} exitosa.`, 'success');
            }
            
            resetForm();
            onDataChange();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            showToast(message, 'error');
        } finally {
            setIsLoading(false);
            setIsConfirmModalOpen(false);
            setTransactionToConfirm(null);
        }
    };
    
    const handleTransaction = async (type: 'recharge' | 'refund') => {
        const parsedAmount = parseFloat(amount);
        
        if (!selectedUserId) {
            showToast("Por favor, seleccione un cajero.", 'error');
            return;
        }
        if (!customerCardUid.trim()) {
            showToast("Por favor, ingrese el UID de la tarjeta del cliente.", 'error');
            return;
        }
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            showToast("Por favor, ingrese un monto válido y positivo.", 'error');
            return;
        }
        
        if (type === 'refund') {
            setTransactionToConfirm({ type: 'refund', amount: parsedAmount });
            setIsConfirmModalOpen(true);
        } else {
            await executeTransaction('recharge', parsedAmount);
        }
    };

    const handleConfirmDevolution = () => {
        if (transactionToConfirm) {
            executeTransaction(transactionToConfirm.type, transactionToConfirm.amount);
        }
    };

    return (
        <Card className="max-w-2xl mx-auto">
            <h3 className="text-xl font-semibold mb-4 text-white">Punto de Saldo</h3>
            <div className="space-y-4">
                <div>
                    <label htmlFor="cashier" className="block text-sm font-medium text-gray-300 mb-1">Cajero</label>
                    <select
                        id="cashier"
                        name="cashier"
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500"
                    >
                        <option value="">-- Seleccionar Cajero --</option>
                        {cashiers.map(user => (
                            <option key={user.id} value={user.id}>{user.name} ({user.role})</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="customerCardUid" className="block text-sm font-medium text-gray-300 mb-1">UID Tarjeta Cliente</label>
                    <input
                        id="customerCardUid"
                        name="customerCardUid"
                        type="text"
                        placeholder="Escanear o ingresar UID"
                        value={customerCardUid}
                        onChange={e => setCustomerCardUid(e.target.value.toUpperCase())}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white font-mono focus:ring-2 focus:ring-cyan-500"
                    />
                </div>
                <div>
                    <label htmlFor="amount" className="block text-sm font-medium text-gray-300 mb-1">Monto</label>
                    <input
                        id="amount"
                        name="amount"
                        type="number"
                        placeholder="0.00"
                        min="0.01"
                        step="0.01"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <Button 
                        onClick={() => handleTransaction('recharge')}
                        isLoading={isLoading}
                        className="w-full"
                    >
                        Recargar Saldo
                    </Button>
                    <Button 
                        variant="danger" 
                        onClick={() => handleTransaction('refund')}
                        isLoading={isLoading}
                        className="w-full"
                    >
                        Devolver Saldo
                    </Button>
                </div>
            </div>

             <Modal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                title="Confirmar Devolución"
            >
                {transactionToConfirm && (
                    <div>
                        <p className="text-gray-300 mb-4">
                            ¿Estás seguro de que quieres devolver <strong>${transactionToConfirm.amount.toFixed(2)}</strong> de la tarjeta <strong>{customerCardUid}</strong>?
                            <br />
                            <strong className="text-red-400">Esta acción no se puede deshacer.</strong>
                        </p>
                        <div className="flex justify-end gap-3">
                            <Button type="button" variant="secondary" onClick={() => setIsConfirmModalOpen(false)} disabled={isLoading}>
                                Cancelar
                            </Button>
                            <Button type="button" variant="danger" onClick={handleConfirmDevolution} isLoading={isLoading}>
                                Sí, devolver
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </Card>
    );
};

export default BalancePointTab;
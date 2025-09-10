import React from 'react';
import { Event, Transaction, User, Card as CardType, TransactionType } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface ReportsTabProps {
    event: Event;
    transactions: Transaction[];
    users: User[];
    cards: CardType[];
}

const ReportsTab: React.FC<ReportsTabProps> = ({ event, transactions, users, cards }) => {
    const usersMap = new Map(users.map(u => [u.id, u]));
    const cardsMap = new Map(cards.map(c => [c.uid, c]));

    const downloadCSV = (csvContent: string, fileName: string) => {
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' }); // Add BOM for Excel
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadSalesReport = () => {
        const salesTransactions = transactions.filter(
            tx => tx.type === TransactionType.SALE || tx.type === TransactionType.VOID
        );

        const headers = [
            'Transaction ID', 'Date', 'Time', 'Type', 'Amount', 'Details / Products',
            'Seller ID', 'Seller Name', 'Employee Number',
            'Customer Card UID', 'Customer Number'
        ];

        const rows = salesTransactions.map(tx => {
            const user = usersMap.get(tx.userId);
            const card = cardsMap.get(tx.customerCardUid);
            return [
                tx.id,
                new Date(tx.timestamp).toLocaleDateString(),
                new Date(tx.timestamp).toLocaleTimeString(),
                tx.type,
                Number(tx.amount).toFixed(2),
                `"${tx.details?.replace(/"/g, '""') || ''}"`,
                user?.id || 'N/A',
                user?.name || 'N/A',
                user?.employeeNumber || 'N/A',
                tx.customerCardUid,
                card?.customerNumber || 'N/A',
            ].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const safeEventName = event.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        downloadCSV(csvContent, `sales_report_${safeEventName}.csv`);
    };

    const handleDownloadBalanceReport = () => {
        const balanceTransactions = transactions.filter(
            tx => tx.type === TransactionType.RELOAD || tx.type === TransactionType.REFUND
        );

        const headers = [
            'Transaction ID', 'Date', 'Time', 'Type', 'Amount',
            'Cashier ID', 'Cashier Name', 'Employee Number',
            'Customer Card UID', 'Customer Number'
        ];

        const rows = balanceTransactions.map(tx => {
            const user = usersMap.get(tx.userId);
            const card = cardsMap.get(tx.customerCardUid);
            return [
                tx.id,
                new Date(tx.timestamp).toLocaleDateString(),
                new Date(tx.timestamp).toLocaleTimeString(),
                tx.type,
                Number(tx.amount).toFixed(2),
                user?.id || 'N/A',
                user?.name || 'N/A',
                user?.employeeNumber || 'N/A',
                tx.customerCardUid,
                card?.customerNumber || 'N/A',
            ].join(',');
        });
        
        const csvContent = [headers.join(','), ...rows].join('\n');
        const safeEventName = event.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        downloadCSV(csvContent, `balance_transactions_report_${safeEventName}.csv`);
    };

    const handleDownloadGeneralReport = () => {
        const headers = [
            'Transaction ID', 'Date', 'Time', 'Type', 'Amount', 'Details',
            'Staff ID', 'Staff Name', 'Staff Role', 'Employee Number',
            'Customer Card UID', 'Customer Number'
        ];

        const rows = transactions.map(tx => {
            const user = usersMap.get(tx.userId);
            const card = cardsMap.get(tx.customerCardUid);
            return [
                tx.id,
                new Date(tx.timestamp).toLocaleDateString(),
                new Date(tx.timestamp).toLocaleTimeString(),
                tx.type,
                Number(tx.amount).toFixed(2),
                `"${tx.details?.replace(/"/g, '""') || ''}"`,
                user?.id || 'N/A',
                user?.name || 'N/A',
                user?.role || 'N/A',
                user?.employeeNumber || 'N/A',
                tx.customerCardUid,
                card?.customerNumber || 'N/A',
            ].join(',');
        });
        
        const csvContent = [headers.join(','), ...rows].join('\n');
        const safeEventName = event.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        downloadCSV(csvContent, `general_transactions_report_${safeEventName}.csv`);
    };

    const handleDownloadCustomerBalanceReport = () => {
        const headers = [
            'Card UID', 'Customer Number', 'Current Balance', 'Status',
            'Total Reloaded', 'Total Spent (Sales)', 'Total Returned (Voids and Refunds)'
        ];

        const aggregates = transactions.reduce((acc, tx) => {
            const uid = tx.customerCardUid;
            if (!acc[uid]) {
                acc[uid] = { reloaded: 0, spent: 0, refunded: 0 };
            }
            const amount = Math.abs(Number(tx.amount));
            if (tx.type === TransactionType.RELOAD) {
                acc[uid].reloaded += Number(tx.amount); // Reloads are positive
            } else if (tx.type === TransactionType.SALE) {
                acc[uid].spent += amount;
            } else if (tx.type === TransactionType.VOID) {
                acc[uid].refunded += amount; // Voids are refunds (positive amount)
            } else if (tx.type === TransactionType.REFUND) {
                acc[uid].refunded += amount; // Refunds are refunds (negative amount)
            }
            return acc;
        }, {} as Record<string, { reloaded: number; spent: number; refunded: number }>);
        
        const rows = cards.map(card => {
            const cardAggregates = aggregates[card.uid] || { reloaded: 0, spent: 0, refunded: 0 };
            return [
                card.uid,
                card.customerNumber || 'N/A',
                Number(card.balance).toFixed(2),
                card.is_active ? 'Active' : 'Blocked',
                cardAggregates.reloaded.toFixed(2),
                cardAggregates.spent.toFixed(2),
                cardAggregates.refunded.toFixed(2),
            ].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const safeEventName = event.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        downloadCSV(csvContent, `customer_balance_report_${safeEventName}.csv`);
    };

    const hasSalesData = transactions.some(tx => tx.type === TransactionType.SALE || tx.type === TransactionType.VOID);
    const hasBalanceData = transactions.some(tx => tx.type === TransactionType.RELOAD || tx.type === TransactionType.REFUND);
    const hasAnyTransactions = transactions.length > 0;
    const hasAnyCards = cards.length > 0;

    return (
        <Card>
            <h3 className="text-xl font-semibold mb-4 text-white">Generación de Reportes</h3>
            <p className="text-gray-400 mb-6">
                Descarga reportes detallados en formato CSV, compatibles con Excel y otras hojas de cálculo.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-700 p-4 rounded-lg">
                    <h4 className="font-semibold text-lg mb-2">Reporte de Ventas</h4>
                    <p className="text-sm text-gray-400 mb-4">Incluye todas las ventas y anulaciones realizadas.</p>
                    <Button onClick={handleDownloadSalesReport} disabled={!hasSalesData}>
                        {hasSalesData ? 'Descargar Ventas' : 'Sin datos de ventas'}
                    </Button>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg">
                    <h4 className="font-semibold text-lg mb-2">Reporte de Transacciones de Saldo</h4>
                    <p className="text-sm text-gray-400 mb-4">Incluye todas las recargas y devoluciones de saldo.</p>
                    <Button onClick={handleDownloadBalanceReport} disabled={!hasBalanceData}>
                        {hasBalanceData ? 'Descargar Transacciones' : 'Sin datos de saldo'}
                    </Button>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg">
                    <h4 className="font-semibold text-lg mb-2">Reporte General de Transacciones</h4>
                    <p className="text-sm text-gray-400 mb-4">Un historial completo de todas las transacciones (ventas, recargas, etc.) en un solo archivo.</p>
                    <Button onClick={handleDownloadGeneralReport} disabled={!hasAnyTransactions}>
                        {hasAnyTransactions ? 'Descargar Reporte General' : 'Sin transacciones'}
                    </Button>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg">
                    <h4 className="font-semibold text-lg mb-2">Reporte de Saldos de Clientes</h4>
                    <p className="text-sm text-gray-400 mb-4">Un resumen final del estado de cada tarjeta de cliente, incluyendo su saldo y totales.</p>
                    <Button onClick={handleDownloadCustomerBalanceReport} disabled={!hasAnyCards}>
                        {hasAnyCards ? 'Descargar Saldos' : 'Sin clientes'}
                    </Button>
                </div>
            </div>
        </Card>
    );
};

export default ReportsTab;
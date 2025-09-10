import React, { useMemo } from 'react';
import { Transaction, Card as CardType, TransactionType } from '../../types';
import { Card } from '../ui/Card';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title, Filler } from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title, Filler);

interface OverviewTabProps {
    transactions: Transaction[];
    cards: CardType[];
}

const StatCard: React.FC<{ title: string; value: string | number; description: string }> = ({ title, value, description }) => (
    <Card>
        <h4 className="text-sm font-medium text-gray-400">{title}</h4>
        <p className="text-3xl font-bold text-white mt-1">{value}</p>
        <p className="text-sm text-gray-400 mt-2">{description}</p>
    </Card>
);

const OverviewTab: React.FC<OverviewTabProps> = ({ transactions, cards }) => {
    // Ensure all financial calculations correctly handle values that might be strings from the API.
    const totalSales = transactions
        .filter(t => t.type === TransactionType.SALE)
        .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    const totalReloads = transactions
        .filter(t => t.type === TransactionType.RELOAD)
        .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const totalRefunds = transactions
        .filter(t => t.type === TransactionType.REFUND)
        .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    const totalBalance = cards.reduce((sum, c) => sum + Number(c.balance), 0);

    const chartData = useMemo(() => {
        // --- Data for Doughnut Chart ---
        const typeCounts = transactions.reduce((acc, tx) => {
            acc[tx.type] = (acc[tx.type] || 0) + 1;
            return acc;
        }, {} as Record<TransactionType, number>);

        const doughnutLabels = Object.keys(typeCounts);
        const doughnutDataPoints = Object.values(typeCounts);
        const doughnutColors = doughnutLabels.map(label => {
            switch (label) {
                case TransactionType.SALE: return '#FBBF24'; // yellow-400
                case TransactionType.RELOAD: return '#34D399'; // green-400
                case TransactionType.VOID: return '#F87171'; // red-400
                case TransactionType.REFUND: return '#60A5FA'; // blue-400
                default: return '#9CA3AF'; // gray-400
            }
        });
        
        // --- Data for Line Chart ---
        const hourlyActivity: { [hour: string]: { sales: number; reloads: number; refunds: number } } = {};
        transactions.forEach(tx => {
            const hour = new Date(tx.timestamp).toLocaleString('default', { hour: '2-digit', minute: '2-digit', hour12: false });
            if (!hourlyActivity[hour]) {
                hourlyActivity[hour] = { sales: 0, reloads: 0, refunds: 0 };
            }
            if (tx.type === TransactionType.SALE) {
                hourlyActivity[hour].sales += Math.abs(Number(tx.amount));
            } else if (tx.type === TransactionType.RELOAD) {
                hourlyActivity[hour].reloads += Number(tx.amount);
            } else if (tx.type === TransactionType.REFUND) {
                hourlyActivity[hour].refunds += Math.abs(Number(tx.amount));
            }
        });

        const sortedHours = Object.keys(hourlyActivity).sort();
        const lineLabels = sortedHours;
        const salesData = sortedHours.map(hour => hourlyActivity[hour].sales);
        const reloadsData = sortedHours.map(hour => hourlyActivity[hour].reloads);
        const refundsData = sortedHours.map(hour => hourlyActivity[hour].refunds);

        return {
            doughnut: {
                labels: doughnutLabels,
                datasets: [{
                    label: '# de Transacciones',
                    data: doughnutDataPoints,
                    backgroundColor: doughnutColors,
                    borderColor: '#1F2937', // gray-800
                    borderWidth: 2,
                }]
            },
            line: {
                labels: lineLabels,
                datasets: [
                    {
                        label: 'Ventas',
                        data: salesData,
                        borderColor: '#FBBF24', // yellow-400
                        backgroundColor: 'rgba(251, 191, 36, 0.2)',
                        fill: true,
                        tension: 0.3,
                    },
                    {
                        label: 'Recargas',
                        data: reloadsData,
                        borderColor: '#34D399', // green-400
                        backgroundColor: 'rgba(52, 211, 153, 0.2)',
                        fill: true,
                        tension: 0.3,
                    },
                    {
                        label: 'Devoluciones',
                        data: refundsData,
                        borderColor: '#60A5FA', // blue-400
                        backgroundColor: 'rgba(96, 165, 250, 0.2)',
                        fill: true,
                        tension: 0.3,
                    }
                ]
            }
        };
    }, [transactions]);

    const chartOptions = {
        plugins: {
            legend: {
                position: 'top' as const,
                labels: {
                    color: '#E5E7EB', // gray-200
                    font: { size: 12 }
                }
            }
        },
        maintainAspectRatio: false,
    };

    const lineChartOptions = {
        ...chartOptions,
        scales: {
            y: {
                beginAtZero: true,
                ticks: { color: '#9CA3AF' }, // gray-400
                grid: { color: '#374151' } // gray-700
            },
            x: {
                ticks: { color: '#9CA3AF' }, // gray-400
                 grid: { color: '#374151' } // gray-700
            }
        }
    };


    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Ventas Totales" value={`$${totalSales.toFixed(2)}`} description="Monto total de ventas." />
                <StatCard title="Total Recargado" value={`$${totalReloads.toFixed(2)}`} description="Monto total cargado en tarjetas." />
                <StatCard title="Saldo en Circulación" value={`$${totalBalance.toFixed(2)}`} description="Saldo actual en todas las tarjetas." />
                <StatCard title="Total Devuelto" value={`$${totalRefunds.toFixed(2)}`} description="Monto total devuelto a tarjetas." />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                    <h3 className="text-xl font-semibold mb-4 text-white">Actividad del Evento</h3>
                    <div className="h-80">
                        <Line data={chartData.line} options={lineChartOptions} />
                    </div>
                </Card>
                <Card>
                    <h3 className="text-xl font-semibold mb-4 text-white">Distribución de Transacciones</h3>
                     <div className="h-80">
                        <Doughnut data={chartData.doughnut} options={chartOptions} />
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default OverviewTab;
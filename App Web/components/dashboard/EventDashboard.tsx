import React, { useState, useEffect, useCallback } from 'react';
import { Event, User, Card as CardType, Transaction, Product } from '../../types';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import OverviewTab from '@/components/dashboard/OverviewTab';
import DevicesTab from '@/components/dashboard/DevicesTab';
import CardsTab from '@/components/dashboard/CardsTab';
import { TransactionsTab } from '@/components/dashboard/TransactionsTab';
import UsersTab from '@/components/dashboard/UsersTab';
import ProductsTab from '@/components/dashboard/ProductsTab';
import ReportsTab from '@/components/dashboard/ReportsTab';
import SalesPointTab from '@/components/dashboard/SalesPointTab';
import BalancePointTab from '@/components/dashboard/BalancePointTab';
import { CheckBalanceTab } from '@/components/dashboard/CheckBalanceTab';
import { api } from '@/services/api';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

interface EventDashboardProps {
    event: Event;
    onBack: () => void;
}

type Tab = 'overview' | 'devices' | 'cards' | 'transactions' | 'users' | 'products' | 'reports' | 'salesPoint' | 'balancePoint' | 'checkBalance';

// SVG Icon Components
const ChartBarIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" /><path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" /></svg>;
const DeviceMobileIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7 2a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V4a2 2 0 00-2-2H7zm3 14a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>;
const UserGroupIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zm-1.518 6.32a6.002 6.002 0 01-3.248 1.132 6.002 6.002 0 01-3.248-1.132A4.001 4.001 0 011 16h10a4 4 0 01-2.518-3.68zM16.5 6a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM18 16a3 3 0 00-2.43-2.947 6.015 6.015 0 00-1.14.07A4.002 4.002 0 0113 16h5z" /></svg>;
const ClipboardListIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>;
const IdentificationIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 2a1 1 0 00-1 1v1a1 1 0 002 0V3a1 1 0 00-1-1zM4 4h3a3 3 0 006 0h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm12 5a1 1 0 100-2H4a1 1 0 100 2h12zM4 13a1 1 0 100 2h6a1 1 0 100-2H4z" clipRule="evenodd" /></svg>;
const TagIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A1 1 0 012 10V5a1 1 0 011-1h5a1 1 0 01.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>;
const DocumentDownloadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" /></svg>;
const ShoppingCartIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" /></svg>;
const CashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.5 2.5 0 00-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.07.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.5 2.5 0 01-.567.267z" /><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.484.322.958.583 1.676.662v1.261a1 1 0 102 0v-1.26c.718-.08.192-.34.1676-.662C13.398 9.766 14 8.99 14 8c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 5.092V5z" clipRule="evenodd" /></svg>;
const SearchIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>;


const EventDashboard: React.FC<EventDashboardProps> = ({ event, onBack }) => {
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<{ users: User[], cards: CardType[], transactions: Transaction[], products: Product[] } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const details = await api.getEventDetails(event.id);
            setData({
                users: details.users,
                cards: details.cards,
                transactions: details.transactions,
                products: details.products,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Ocurrió un error inesperado del lado del cliente.';
            setError(message);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [event.id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    const renderTabContent = () => {
        if (isLoading) {
            return <div className="flex justify-center items-center h-64"><Spinner /></div>;
        }
       
        if (!data) {
             // If there was an error and no data could be loaded, the error is displayed globally above the tabs.
            return !error ? <p className="text-center text-gray-400">No hay datos disponibles para este evento.</p> : null;
        }

        switch (activeTab) {
            case 'overview':
                return <OverviewTab transactions={data.transactions} cards={data.cards} />;
            case 'devices':
                return <DevicesTab eventId={event.id} />;
            case 'cards':
                return <CardsTab cards={data.cards} eventId={event.id} onDataChange={fetchData} />;
            case 'transactions':
                return <TransactionsTab transactions={data.transactions} users={data.users} onDataChange={fetchData} />;
            case 'users':
                return <UsersTab users={data.users} transactions={data.transactions} eventId={event.id} onDataChange={fetchData} />;
            case 'products':
                return <ProductsTab products={data.products} eventId={event.id} onDataChange={fetchData} />;
            case 'reports':
                return <ReportsTab event={event} transactions={data.transactions} users={data.users} cards={data.cards} />;
            case 'salesPoint':
                return <SalesPointTab products={data.products} users={data.users} eventId={event.id} onDataChange={fetchData} />;
            case 'balancePoint':
                return <BalancePointTab users={data.users} eventId={event.id} onDataChange={fetchData} />;
            case 'checkBalance':
                return <CheckBalanceTab eventId={event.id} />;
            default:
                return null;
        }
    };

    const TabButton: React.FC<{tab: Tab, label: string, icon: React.ReactNode}> = ({tab, label, icon}) => (
         <button
            onClick={() => setActiveTab(tab)}
            className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                activeTab === tab 
                ? 'bg-cyan-600 text-white' 
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
        >
            {icon}
            {label}
        </button>
    );

    return (
        <div>
            <div className="mb-8">
                <Button onClick={onBack} variant="secondary" className="mb-4">&larr; Volver a Eventos</Button>
                <h2 className="text-3xl font-bold tracking-tight text-white">{event.name}</h2>
                <p className="text-gray-400">Dashboard del Evento</p>
            </div>
            
            {error && <div className="mb-6"><ErrorMessage error={error} /></div>}

            <div className="mb-6 border-b border-gray-700">
                <nav className="flex flex-wrap -mb-px space-x-2 sm:space-x-4" aria-label="Tabs">
                    <TabButton tab="overview" label="Resumen" icon={<ChartBarIcon />} />
                    <TabButton tab="devices" label="Dispositivos" icon={<DeviceMobileIcon />} />
                    <TabButton tab="transactions" label="Transacciones" icon={<ClipboardListIcon />} />
                    <TabButton tab="cards" label="Compradores" icon={<UserGroupIcon />} />
                    <TabButton tab="users" label="Personal" icon={<IdentificationIcon />} />
                    <TabButton tab="products" label="Productos" icon={<TagIcon />} />
                    <TabButton tab="reports" label="Reportes" icon={<DocumentDownloadIcon />} />
                    {event.status === 'activo' && <TabButton tab="salesPoint" label="Punto de Venta" icon={<ShoppingCartIcon />} />}
                    {event.status === 'activo' && <TabButton tab="balancePoint" label="Punto de Saldo" icon={<CashIcon />} />}
                    {event.status === 'activo' && <TabButton tab="checkBalance" label="Consultar Saldo" icon={<SearchIcon />} />}
                </nav>
            </div>

            <div>
                {renderTabContent()}
            </div>
        </div>
    );
};

export default EventDashboard;
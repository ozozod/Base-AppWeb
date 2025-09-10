import React, { useState, useEffect } from 'react';
import { DeviceStatus } from '../../types';
import { api } from '../../services/api';
import { Card } from '../ui/Card';
import { Spinner } from '../ui/Spinner';
import { EmptyState } from '../ui/EmptyState';
import { Tooltip } from '../ui/Tooltip';
import { ErrorMessage } from '../ui/ErrorMessage';

interface DevicesTabProps {
    eventId: string;
}

const BatteryIcon: React.FC<{ level: number | null }> = ({ level }) => {
    if (level === null) return <span className="text-gray-500">N/A</span>;

    let iconPath, colorClass;
    if (level > 80) {
        iconPath = "M15 6.38a1 1 0 00-1-1H6a1 1 0 00-1 1v7.25a1 1 0 001 1h8a1 1 0 001-1V6.38z"; // Full
        colorClass = 'text-green-400';
    } else if (level > 50) {
        iconPath = "M15 6.38a1 1 0 00-1-1H6a1 1 0 00-1 1v7.25a1 1 0 001 1h8a1 1 0 001-1V6.38zM6 12.62V6.38h8v6.24H6z"; // 3/4
        colorClass = 'text-green-400';
    } else if (level > 20) {
        iconPath = "M15 6.38a1 1 0 00-1-1H6a1 1 0 00-1 1v7.25a1 1 0 001 1h8a1 1 0 001-1V6.38zM6 9.5v-3.12h8V9.5H6z"; // 1/2
        colorClass = 'text-yellow-400';
    } else {
        iconPath = "M15 6.38a1 1 0 00-1-1H6a1 1 0 00-1 1v7.25a1 1 0 001 1h8a1 1 0 001-1V6.38zM6 7.38h8v1.12H6V7.38z"; // Low
        colorClass = 'text-red-500';
    }

    return (
        <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 mr-1 ${colorClass}`} viewBox="0 0 20 20" fill="currentColor">
                 <path fillRule="evenodd" d="M3 5a2 2 0 012-2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm12 2.38a1.5 1.5 0 01.355 2.846l-.001.002-1.354 5.416a1.5 1.5 0 01-2.848-1.09l1.353-5.414A1.5 1.5 0 0115 7.38z" clipRule="evenodd" />
                 <path d={iconPath} />
            </svg>
            <span className="font-mono">{level}%</span>
        </div>
    );
};

const SignalIcon: React.FC<{ strength: number | null }> = ({ strength }) => {
    if (strength === null) return <span className="text-gray-500">N/A</span>;
    const bars = Array.from({ length: 4 }, (_, i) => i < strength);
    return (
        <div className="flex items-end space-x-0.5 h-5">
            {bars.map((active, i) => (
                <div
                    key={i}
                    className={`w-1.5 ${active ? 'bg-cyan-400' : 'bg-gray-600'}`}
                    style={{ height: `${(i + 1) * 25}%` }}
                />
            ))}
        </div>
    );
};


const DevicesTab: React.FC<DevicesTabProps> = ({ eventId }) => {
    const [devices, setDevices] = useState<DeviceStatus[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDevices = async () => {
            try {
                const data = await api.getDeviceStatus(eventId);
                setDevices(data);
                setError(null);
            } catch (err) {
                 const message = err instanceof Error ? err.message : 'No se pudieron cargar los dispositivos.';
                 // Only set error on the first load, not subsequent polling failures
                 if (isLoading) setError(message);
                 console.error(err);
            } finally {
                if (isLoading) setIsLoading(false);
            }
        };

        fetchDevices();
        const intervalId = setInterval(fetchDevices, 10000); // Poll every 10 seconds

        return () => clearInterval(intervalId);
    }, [eventId, isLoading]);

    const isOffline = (lastSeen: Date) => {
        const now = new Date();
        const lastSeenDate = new Date(lastSeen);
        const diffInSeconds = (now.getTime() - lastSeenDate.getTime()) / 1000;
        return diffInSeconds > 60; // Consider offline after 60 seconds
    };
    
    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Spinner /></div>;
    }
    
    if (error) {
        return <ErrorMessage error={error} />;
    }

    return (
        <Card>
            <h3 className="text-xl font-semibold mb-2 text-white">Dispositivos Conectados</h3>
            <p className="text-gray-400 mb-4 text-sm">Estado en tiempo real de las terminales. La información se actualiza cada 10 segundos.</p>
            
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                     <thead className="bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Estado</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">ID Dispositivo</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Usuario Conectado</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Batería</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Señal</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Última Conexión</th>
                        </tr>
                     </thead>
                      <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {devices.map(device => (
                            <tr key={device.deviceId} className={`transition-opacity duration-500 ${isOffline(device.lastSeen) ? 'opacity-50' : 'opacity-100'}`}>
                                <td className="px-6 py-4">
                                    <Tooltip text={isOffline(device.lastSeen) ? 'Offline' : 'Online'}>
                                        <div className={`h-3 w-3 rounded-full ${isOffline(device.lastSeen) ? 'bg-red-500' : 'bg-green-500'}`}></div>
                                    </Tooltip>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-cyan-400">{device.deviceId}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{device.staffName || <span className="text-gray-500">Nadie</span>}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300"><BatteryIcon level={device.batteryLevel} /></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300"><SignalIcon strength={device.signalStrength} /></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{new Date(device.lastSeen).toLocaleString()}</td>
                            </tr>
                        ))}
                      </tbody>
                </table>
            </div>
            {devices.length === 0 && (
                <EmptyState
                    title="No hay dispositivos conectados"
                    message="Cuando un miembro del personal inicie sesión en una terminal móvil, su estado aparecerá aquí."
                />
            )}
        </Card>
    );
};

export default DevicesTab;

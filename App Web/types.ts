export enum Role {
    CASHIER = 'CAJERO',
    SELLER = 'VENDEDOR',
    MANAGER = 'ENCARGADO',
    ADMINISTRATOR = 'ADMINISTRADOR',
}

export enum TransactionType {
    RELOAD = 'Recarga',
    SALE = 'Venta',
    VOID = 'Anulación',
    REFUND = 'Devolución',
}

export interface User {
    id: string;
    eventId: string;
    name: string;
    employeeNumber?: string;
    role: Role;
    cardUid: string;
    is_active: boolean;
}

export interface Card {
    uid: string;
    eventId: string;
    customerNumber?: string;
    balance: number;
    is_active: boolean;
    history: Transaction[];
}

export interface Transaction {
    id: string;
    eventId: string;
    type: TransactionType;
    amount: number;
    timestamp: Date;
    userId: string; // Vendedor/Cajero
    customerCardUid: string;
    details?: string; // e.g., items for a sale, original transaction ID for a void
}

export interface Event {
    id: string;
    name: string;
    status: 'activo' | 'finalizado';
    createdAt: Date;
}

export interface Product {
    id: string;
    eventId: string;
    name: string;
    price: number;
    is_active: boolean;
}

export interface DeviceStatus {
    id: string;
    deviceId: string;
    eventId: string;
    staffId: string | null;
    staffName: string | null;
    batteryLevel: number | null;
    signalStrength: number | null; // e.g., 0-4
    lastSeen: Date;
}
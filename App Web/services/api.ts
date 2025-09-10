
import { Event, User, Card, Transaction, Product, Role, DeviceStatus } from '../types';

// Usamos una URL relativa para que funcione el proxy de Vite.
// No necesita el '/api' aquí porque las llamadas lo incluyen.
const BASE_URL = ''; 

// Error personalizado para respuestas de la API
class ApiError extends Error {
    constructor(message: string, public status?: number) {
        super(message);
        this.name = 'ApiError';
    }
}

// Wrapper de Fetch centralizado
async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${BASE_URL}${endpoint}`;
    const defaultOptions: RequestInit = {
        headers: { 'Content-Type': 'application/json' },
    };

    const response = await fetch(url, { ...defaultOptions, ...options });

    if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
            const errorBody = await response.json();
            errorMessage = errorBody.error || errorMessage;
        } catch (e) { /* No es JSON, usar mensaje por defecto */ }
        throw new ApiError(errorMessage, response.status);
    }

    if (response.status === 204) {
        return null as T;
    }

    return response.json() as Promise<T>;
}

export const api = {
    // --- Eventos ---
    getEvents: () => apiFetch<Event[]>('/api/events'),
    getActiveEvent: () => apiFetch<Event>('/api/events/active'),
    createEvent: (name: string) => apiFetch<Event>('/api/events', {
        method: 'POST',
        body: JSON.stringify({ name }),
    }),
    updateEventStatus: (eventId: string, status: 'activo' | 'finalizado') => apiFetch<void>(`/api/events/${eventId}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
    }),
    deleteEvent: (eventId: string) => apiFetch<void>(`/api/events/${eventId}`, {
        method: 'DELETE',
    }),

    // --- Detalles del Evento (CORREGIDO Y EFICIENTE) ---
    getEventDetails: (eventId: string) => apiFetch<{ event: Event, users: User[], cards: Card[], transactions: Transaction[], products: Product[] }>(`/api/events/${eventId}/details`),

    // --- Personal (Users) ---
    createUser: (eventId: string, name: string, role: Role, cardUid: string, employeeNumber?: string) => apiFetch<User>(`/api/events/${eventId}/users`, {
        method: 'POST',
        body: JSON.stringify({ name, role, cardUid, employeeNumber }),
    }),
    updateUser: (eventId: string, userId: string, updates: Partial<User>) => apiFetch<User>(`/api/events/${eventId}/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
    }),
    deleteUser: (eventId: string, userId: string) => apiFetch<void>(`/api/events/${eventId}/users/${userId}`, {
        method: 'DELETE',
    }),

    // --- Compradores (Cards) ---
    createCard: (eventId: string, uid: string, customerNumber?: string) => apiFetch<Card>(`/api/events/${eventId}/cards`, {
        method: 'POST',
        body: JSON.stringify({ uid, customerNumber }),
    }),
    updateCard: (eventId: string, cardUid: string, updates: Partial<Pick<Card, 'is_active' | 'customerNumber'>>) => apiFetch<Card>(`/api/events/${eventId}/cards/${cardUid}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
    }),
     deleteCard: (eventId: string, cardUid: string) => apiFetch<void>(`/api/events/${eventId}/cards/${cardUid}`, {
        method: 'DELETE',
    }),
    getCustomerDetailsByUid: (eventId: string, uid: string) => apiFetch<Card>(`/api/events/${eventId}/cards/${uid}`),

    // --- Productos ---
    createProduct: (eventId: string, name: string, price: number) => apiFetch<Product>(`/api/events/${eventId}/products`, {
        method: 'POST',
        body: JSON.stringify({ name, price }),
    }),
    updateProduct: (eventId: string, productId: string, updates: Partial<Product>) => apiFetch<Product>(`/api/events/${eventId}/products/${productId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
    }),
    deleteProduct: (eventId: string, productId: string) => apiFetch<void>(`/api/events/${eventId}/products/${productId}`, {
        method: 'DELETE',
    }),

    // --- Transacciones (CORREGIDO) ---
    createSaleTransaction: (eventId: string, staffId: string, customerUid: string, amount: number, details: string) => apiFetch<Transaction>('/api/transactions/sale', {
        method: 'POST',
        body: JSON.stringify({ eventId, staffId, customerUid, amount, details }),
    }),
    createRechargeTransaction: (eventId: string, staffId: string, customerUid: string, amount: number, details: string) => apiFetch<Transaction>('/api/transactions/recharge', {
        method: 'POST',
        body: JSON.stringify({ eventId, staffId, customerUid, amount, details }),
    }),
    createRefundTransaction: (eventId: string, staffId: string, customerUid: string, amount: number) => apiFetch<Transaction>('/api/transactions/refund', {
        method: 'POST',
        body: JSON.stringify({ eventId, staffId, customerUid, amount }),
    }),
    createVoidTransaction: (transactionId: string, managerCardUid: string) => apiFetch<Transaction>('/api/transactions/void', {
        method: 'POST',
        body: JSON.stringify({ transactionId, managerCardUid }),
    }),

    // --- Dispositivos ---
    getDeviceStatus: (eventId: string) => apiFetch<DeviceStatus[]>(`/api/events/${eventId}/devices`),
};
import React, { useState, useMemo } from 'react';
import { Product, User, Role } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { api } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

interface SalesPointTabProps {
    products: Product[];
    users: User[];
    eventId: string;
    onDataChange: () => void;
}

interface CartItem extends Product {
    quantity: number;
}

const SalesPointTab: React.FC<SalesPointTabProps> = ({ products, users, eventId, onDataChange }) => {
    const [cart, setCart] = useState<CartItem[]>([]);
    const [customerCardUid, setCustomerCardUid] = useState('');
    const [selectedUserId, setSelectedUserId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { showToast } = useToast();

    const activeProducts = useMemo(() => products.filter(p => p.is_active), [products]);
    const salesPersonnel = useMemo(() => users.filter(u => u.is_active && (u.role === Role.SELLER || u.role === Role.CASHIER)), [users]);

    const addToCart = (product: Product) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === product.id);
            if (existingItem) {
                return prevCart.map(item =>
                    item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [...prevCart, { ...product, quantity: 1 }];
        });
    };

    const updateQuantity = (productId: string, newQuantity: number) => {
        if (newQuantity <= 0) {
            setCart(prevCart => prevCart.filter(item => item.id !== productId));
        } else {
            setCart(prevCart => prevCart.map(item =>
                item.id === productId ? { ...item, quantity: newQuantity } : item
            ));
        }
    };
    
    const clearCart = () => {
        setCart([]);
        setCustomerCardUid('');
    }

    const totalAmount = useMemo(() => {
        return cart.reduce((total, item) => total + Number(item.price) * item.quantity, 0);
    }, [cart]);
    
    const handleCompleteSale = async () => {
        if (!selectedUserId) {
            showToast("Por favor, seleccione un vendedor/cajero.", 'error');
            return;
        }
        if (cart.length === 0) {
            showToast("El carrito está vacío.", 'error');
            return;
        }
        if (!customerCardUid.trim()) {
            showToast("Por favor, ingrese el UID de la tarjeta del cliente.", 'error');
            return;
        }

        setIsLoading(true);

        try {
            const details = cart.map(item => `${item.quantity}x ${item.name}`).join(', ');
            await api.createSaleTransaction(eventId, selectedUserId, customerCardUid, totalAmount, details);
            
            showToast(`Venta de $${totalAmount.toFixed(2)} completada exitosamente.`, 'success');
            clearCart();
            onDataChange(); // Refresh all event data
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
            showToast(errorMessage, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Products List */}
            <div className="lg:col-span-2">
                <Card>
                    <h3 className="text-xl font-semibold mb-4 text-white">Productos Disponibles</h3>
                    <div className="mb-4">
                        <select
                            id="salesPerson"
                            name="salesPerson"
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            className="w-full max-w-xs bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500"
                        >
                            <option value="">-- Seleccionar Vendedor/Cajero --</option>
                            {salesPersonnel.map(user => (
                                <option key={user.id} value={user.id}>{user.name} ({user.role})</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {activeProducts.map(product => (
                            <button
                                key={product.id}
                                onClick={() => addToCart(product)}
                                className="bg-gray-700 p-4 rounded-lg text-center hover:bg-cyan-800 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            >
                                <p className="font-semibold text-white">{product.name}</p>
                                <p className="text-sm text-cyan-400">${Number(product.price).toFixed(2)}</p>
                            </button>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Sale / Cart Panel */}
            <div>
                <Card className="sticky top-24">
                    <h3 className="text-xl font-semibold mb-4 text-white">Venta Actual</h3>
                    <div className="space-y-2 mb-4 max-h-60 overflow-y-auto pr-2">
                        {cart.length === 0 ? (
                            <p className="text-gray-400 text-center py-4">El carrito está vacío</p>
                        ) : (
                            cart.map(item => (
                                <div key={item.id} className="flex justify-between items-center bg-gray-700 p-2 rounded">
                                    <div>
                                        <p className="font-medium text-white">{item.name}</p>
                                        <p className="text-xs text-gray-400">${Number(item.price).toFixed(2)}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            value={item.quantity}
                                            onChange={(e) => updateQuantity(item.id, parseInt(e.target.value, 10) || 0)}
                                            className="w-12 bg-gray-800 text-center rounded"
                                            aria-label={`Quantity of ${item.name}`}
                                        />
                                        <p className="w-16 text-right font-semibold text-white">${(Number(item.price) * item.quantity).toFixed(2)}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    
                    <div className="border-t border-gray-700 pt-4 space-y-4">
                        <div className="flex justify-between items-center text-2xl font-bold">
                            <span className="text-gray-300">Total:</span>
                            <span className="text-cyan-400">${totalAmount.toFixed(2)}</span>
                        </div>
                        <div>
                            <label htmlFor="salesCustomerCardUid" className="block text-sm font-medium text-gray-300 mb-1">UID Tarjeta Cliente</label>
                            <input
                                id="salesCustomerCardUid"
                                name="salesCustomerCardUid"
                                type="text"
                                placeholder="Escanear o ingresar UID"
                                value={customerCardUid}
                                onChange={e => setCustomerCardUid(e.target.value.toUpperCase())}
                                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white font-mono focus:ring-2 focus:ring-cyan-500"
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <Button variant="danger" onClick={clearCart} disabled={isLoading}>
                                Limpiar
                            </Button>
                            <Button onClick={handleCompleteSale} isLoading={isLoading} disabled={cart.length === 0 || !selectedUserId}>
                                Completar Venta
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default SalesPointTab;
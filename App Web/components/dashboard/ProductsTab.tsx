import React, { useState, useEffect } from 'react';
import { Product } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { useTable } from '../../hooks/useTable';
import { Pagination } from '../ui/Pagination';
import { SortableHeader } from '../ui/SortableHeader';
import { api } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import { EmptyState } from '../ui/EmptyState';
import { Tooltip } from '../ui/Tooltip';

interface ProductsTabProps {
    products: Product[];
    eventId: string;
    onDataChange: () => void;
}

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

const ProductsTab: React.FC<ProductsTabProps> = ({ products, eventId, onDataChange }) => {
    const [isModalOpen, setModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [productData, setProductData] = useState({ name: '', price: '' });
    const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
    const { showToast } = useToast();

    const { 
        paginatedItems, 
        requestSort, 
        sortConfig, 
        currentPage, 
        totalPages, 
        setPage 
    } = useTable(products, 'name', 10);

    useEffect(() => {
        if (editingProduct) {
            setProductData({ name: editingProduct.name, price: String(editingProduct.price) });
        } else {
            setProductData({ name: '', price: '' });
        }
    }, [editingProduct]);

    const openCreateModal = () => {
        setEditingProduct(null);
        setProductData({ name: '', price: '' });
        setModalOpen(true);
    };

    const openEditModal = (product: Product) => {
        setEditingProduct(product);
        setModalOpen(true);
    };
    
    const closeModal = () => {
        setModalOpen(false);
        setEditingProduct(null);
    }

    const handleSaveProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const price = parseFloat(productData.price);
        if (isNaN(price) || price < 0) {
            showToast("Por favor, ingrese un precio válido no negativo.", 'error');
            setIsSubmitting(false);
            return;
        }

        try {
            if (editingProduct) {
                 await api.updateProduct(eventId, editingProduct.id, { name: productData.name, price });
                 showToast('Producto actualizado correctamente.', 'success');
            } else {
                await api.createProduct(eventId, productData.name, price);
                showToast('Producto creado correctamente.', 'success');
            }
            onDataChange();
            closeModal();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Error al guardar el producto.";
            showToast(message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleActive = async (product: Product) => {
        try {
            await api.updateProduct(eventId, product.id, { is_active: !product.is_active });
            showToast(`Producto ${product.is_active ? 'desactivado' : 'activado'}.`, 'success');
            onDataChange();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Error al actualizar el estado del producto.";
            showToast(message, 'error');
        }
    };

    const handleDeleteProduct = async () => {
        if (!deletingProduct) return;
        setIsSubmitting(true);
        try {
            await api.deleteProduct(eventId, deletingProduct.id);
            showToast('Producto eliminado correctamente.', 'success');
            onDataChange();
            setDeletingProduct(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Error al eliminar el producto.";
            showToast(message, 'error');
            setDeletingProduct(null);
        } finally {
            setIsSubmitting(false);
        }
    };


    return (
        <Card>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-white">Gestión de Productos ({products.length})</h3>
                <Button onClick={openCreateModal}>Crear Producto</Button>
            </div>
            
             <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-700">
                        <tr>
                            <SortableHeader label="Nombre" sortKey="name" sortConfig={sortConfig} onRequestSort={requestSort} />
                            <SortableHeader label="Precio" sortKey="price" sortConfig={sortConfig} onRequestSort={requestSort} />
                            <SortableHeader label="Estado" sortKey="is_active" sortConfig={sortConfig} onRequestSort={requestSort} />
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {paginatedItems.map(product => (
                            <tr key={product.id} className="odd:bg-gray-800 even:bg-gray-700/50 hover:bg-gray-700 transition-colors duration-200">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{product.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">${Number(product.price).toFixed(2)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <ToggleSwitch 
                                        enabled={product.is_active}
                                        onChange={() => handleToggleActive(product)}
                                        label={product.is_active ? 'Activo' : 'Inactivo'}
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                     <div className="flex justify-end items-center gap-2">
                                        <Tooltip text="Editar Producto">
                                            <Button variant="secondary" size="small" icon={<EditIcon />} onClick={() => openEditModal(product)} />
                                        </Tooltip>
                                        <Tooltip text="Eliminar Producto">
                                            <Button variant="danger" size="small" icon={<DeleteIcon />} onClick={() => setDeletingProduct(product)} />
                                        </Tooltip>
                                     </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {products.length === 0 && (
                <EmptyState 
                    title="No se encontraron productos"
                    message="Aún no has creado ningún producto para este evento. ¡Empieza añadiendo el primero!"
                    buttonText="Crear Producto"
                    onButtonClick={openCreateModal}
                />
            )}

            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />

            <Modal isOpen={isModalOpen} onClose={closeModal} title={editingProduct ? 'Editar Producto' : 'Crear Nuevo Producto'}>
                <form onSubmit={handleSaveProduct}>
                     <div className="space-y-4">
                        <div>
                             <label htmlFor="productName" className="block text-sm font-medium text-gray-300 mb-1">Nombre del Producto</label>
                             <input id="productName" name="productName" type="text" value={productData.name} onChange={e => setProductData({...productData, name: e.target.value})} required className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500"/>
                        </div>
                        <div>
                             <label htmlFor="productPrice" className="block text-sm font-medium text-gray-300 mb-1">Precio</label>
                             <input id="productPrice" name="productPrice" type="number" step="0.01" min="0" value={productData.price} onChange={e => setProductData({...productData, price: e.target.value})} required className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500"/>
                        </div>
                     </div>
                     <div className="flex justify-end gap-3 mt-6">
                         <Button type="button" variant="secondary" onClick={closeModal} disabled={isSubmitting}>Cancelar</Button>
                         <Button type="submit" isLoading={isSubmitting} disabled={!productData.name.trim()}>Guardar Producto</Button>
                     </div>
                </form>
            </Modal>

            <Modal isOpen={!!deletingProduct} onClose={() => setDeletingProduct(null)} title="Confirmar Eliminación">
                {deletingProduct && (
                    <div>
                        <p className="text-gray-300 mb-4">
                            ¿Estás seguro de que quieres eliminar el producto "<strong>{deletingProduct.name}</strong>"?
                            <br />
                            <strong className="text-yellow-400">Esta acción no se puede deshacer.</strong>
                        </p>
                        <div className="flex justify-end gap-3">
                            <Button type="button" variant="secondary" onClick={() => setDeletingProduct(null)} disabled={isSubmitting}>
                                Cancelar
                            </Button>
                            <Button type="button" variant="danger" onClick={handleDeleteProduct} isLoading={isSubmitting}>
                                Sí, eliminar
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </Card>
    );
};

export default ProductsTab;
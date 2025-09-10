
import { useState, useMemo } from 'react';

export type SortDirection = 'ascending' | 'descending';

export interface SortConfig<T> {
    key: keyof T;
    direction: SortDirection;
}

export const useTable = <T extends {}>(
    items: T[],
    initialSortKey: keyof T,
    itemsPerPage: number = 10,
    initialSortDirection: SortDirection = 'ascending'
) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>({ key: initialSortKey, direction: initialSortDirection });

    const sortedItems = useMemo(() => {
        let sortableItems = [...items];
        if (sortConfig) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (aValue === null || aValue === undefined) return 1;
                if (bValue === null || bValue === undefined) return -1;
                
                if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [items, sortConfig]);

    const totalPages = Math.ceil(sortedItems.length / itemsPerPage);
    const safeCurrentPage = Math.max(1, Math.min(currentPage, totalPages || 1));

    const paginatedItems = useMemo(() => {
        const startIndex = (safeCurrentPage - 1) * itemsPerPage;
        return sortedItems.slice(startIndex, startIndex + itemsPerPage);
    }, [sortedItems, safeCurrentPage, itemsPerPage]);

    const requestSort = (key: keyof T) => {
        let direction: SortDirection = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
        setCurrentPage(1);
    };
    
    const setPage = (page: number) => {
        setCurrentPage(page);
    };

    return {
        paginatedItems,
        requestSort,
        sortConfig,
        currentPage: safeCurrentPage,
        totalPages,
        setPage,
    };
};

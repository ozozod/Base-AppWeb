
import React from 'react';

type SortDirection = 'ascending' | 'descending';

interface SortConfig<T> {
    key: keyof T;
    direction: SortDirection;
}

interface SortableHeaderProps<T> {
    label: string;
    sortKey: keyof T;
    sortConfig: SortConfig<T> | null;
    onRequestSort: (key: keyof T) => void;
    className?: string;
}

const SortIndicator: React.FC<{ direction: SortDirection }> = ({ direction }) => (
    <span className="inline-block w-4 h-4 ml-1 opacity-70">
        {direction === 'ascending' ? '▲' : '▼'}
    </span>
);

export const SortableHeader = <T extends {}>({ label, sortKey, sortConfig, onRequestSort, className = '' }: SortableHeaderProps<T>) => {
    const isSorted = sortConfig?.key === sortKey;
    
    return (
        <th 
            scope="col" 
            className={`px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer transition-colors duration-200 hover:bg-gray-600 ${className}`}
            onClick={() => onRequestSort(sortKey)}
        >
            <div className="flex items-center">
                {label}
                {isSorted && <SortIndicator direction={sortConfig!.direction} />}
            </div>
        </th>
    );
};


import React from 'react';
import { Spinner } from './Spinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger';
    size?: 'normal' | 'small';
    children?: React.ReactNode;
    isLoading?: boolean;
    icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
    children, 
    variant = 'primary', 
    size = 'normal', 
    className = '', 
    isLoading = false,
    icon,
    ...props 
}) => {
    const isIconOnly = icon && !children;

    const baseClasses = `whitespace-nowrap rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center ${!isIconOnly ? 'gap-2' : ''}`;

    const sizeClasses = {
        normal: isIconOnly ? 'p-2' : 'px-4 py-2 text-sm',
        small: isIconOnly ? 'p-1' : 'px-2 py-1 text-xs',
    };

    const variantClasses = {
        primary: 'bg-cyan-600 text-white hover:bg-cyan-700 focus:ring-cyan-500',
        secondary: 'bg-gray-600 text-gray-200 hover:bg-gray-700 focus:ring-gray-500',
        danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    };

    const finalClassName = `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`;

    return (
        <button className={finalClassName} disabled={isLoading || props.disabled} {...props}>
            {isLoading ? (
                <Spinner className="h-5 w-5" />
            ) : (
                <>
                    {icon}
                    {children}
                </>
            )}
        </button>
    );
};
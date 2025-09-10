
import React from 'react';
import { Button } from './Button';

interface EmptyStateProps {
    title: string;
    message: string;
    icon?: React.ReactNode;
    buttonText?: string;
    onButtonClick?: () => void;
}

const DefaultIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
);


export const EmptyState: React.FC<EmptyStateProps> = ({ title, message, icon = <DefaultIcon />, buttonText, onButtonClick }) => {
    return (
        <div className="text-center py-12 px-6 bg-gray-800 border-2 border-dashed border-gray-700 rounded-lg mt-6">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-700">
                {icon}
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
            <p className="mt-2 text-sm text-gray-400 max-w-md mx-auto">{message}</p>
            {buttonText && onButtonClick && (
                <div className="mt-6">
                    <Button onClick={onButtonClick}>
                        {buttonText}
                    </Button>
                </div>
            )}
        </div>
    );
};
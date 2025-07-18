import React, { useState, useEffect } from 'react';

interface PsuLocationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (location: string) => void;
    initialLocation?: string;
}

export const PsuLocationModal: React.FC<PsuLocationModalProps> = ({ isOpen, onClose, onConfirm, initialLocation }) => {
    const [location, setLocation] = useState('');

    useEffect(() => {
        if (isOpen) {
            setLocation(initialLocation || '');
        }
    }, [isOpen, initialLocation]);

    if (!isOpen) {
        return null;
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(location);
    };

    return (
        <div 
            className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 transition-opacity"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm transform transition-all"
                onClick={e => e.stopPropagation()}
            >
                <form onSubmit={handleSubmit}>
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Edit PSU Location</h2>
                    <p className="text-sm text-gray-600 mb-4">
                        Enter the location for this Power Supply Unit (e.g., "Level 2 - SDB2", "Riser 1").
                    </p>
                    <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="PSU Location Description"
                        autoFocus
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 mb-6"
                    />
                    <div className="flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors font-semibold"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold"
                        >
                            Save Location
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

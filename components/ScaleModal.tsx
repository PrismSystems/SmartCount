
import React, { useState, useEffect } from 'react';

interface ScaleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (lengthInMeters: number) => void;
}

export const ScaleModal: React.FC<ScaleModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const [meters, setMeters] = useState('');
    const [centimeters, setCentimeters] = useState('');

    useEffect(() => {
        if (isOpen) {
            setMeters('');
            setCentimeters('');
        }
    }, [isOpen]);

    if (!isOpen) {
        return null;
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numMeters = parseFloat(meters) || 0;
        const numCm = parseFloat(centimeters) || 0;
        
        if (numMeters > 0 || numCm > 0) {
            const lengthInMeters = numMeters + numCm / 100; // total meters
            onConfirm(lengthInMeters);
        }
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
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Set Scale</h2>
                    <p className="text-sm text-gray-600 mb-4">
                        Enter the real-world length of the line you just drew.
                    </p>
                    <div className="flex items-center space-x-4 mb-6">
                        <div className="flex-1">
                            <label htmlFor="meters" className="block text-sm font-medium text-gray-700">Meters</label>
                            <input
                                id="meters"
                                type="number"
                                step="any"
                                value={meters}
                                onChange={(e) => setMeters(e.target.value)}
                                placeholder="e.g., 2"
                                autoFocus
                                className="mt-1 w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div className="flex-1">
                             <label htmlFor="centimeters" className="block text-sm font-medium text-gray-700">Centimeters</label>
                             <input
                                id="centimeters"
                                type="number"
                                step="any"
                                value={centimeters}
                                onChange={(e) => setCentimeters(e.target.value)}
                                placeholder="e.g., 50"
                                className="mt-1 w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>
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
                            disabled={!(parseFloat(meters) > 0 || parseFloat(centimeters) > 0)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            Set Scale
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

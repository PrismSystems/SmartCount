
import React, { useState, useEffect } from 'react';

interface ManualLengthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (length: number) => void;
    initialLength?: number;
}

export const ManualLengthModal: React.FC<ManualLengthModalProps> = ({ isOpen, onClose, onConfirm, initialLength }) => {
    const [length, setLength] = useState('');

    useEffect(() => {
        if (isOpen) {
            setLength(initialLength ? String(initialLength) : '');
        }
    }, [isOpen, initialLength]);

    if (!isOpen) {
        return null;
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numLength = parseFloat(length);
        if (!isNaN(numLength) && numLength > 0) {
            onConfirm(numLength);
        } else if (initialLength) {
             // If input is invalid but there was an initial value, treat as a request to delete.
            onConfirm(0);
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
                    <h2 className="text-xl font-bold text-gray-800 mb-4">
                        {initialLength ? 'Edit' : 'Add'} Manual Length
                    </h2>
                    <p className="text-sm text-gray-600 mb-4">
                        Enter a vertical distance (e.g., a rise or fall) to add to this measurement's total length. Enter 0 to delete.
                    </p>
                    <input
                        type="number"
                        step="any"
                        min="0"
                        value={length}
                        onChange={(e) => setLength(e.target.value)}
                        placeholder="Length in meters"
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
                            disabled={!length.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            {initialLength ? 'Update' : 'Add'} Length
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

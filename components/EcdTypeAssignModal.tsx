
import React, { useState, useEffect } from 'react';
import type { EcdType, DaliDevice } from '../types';

interface EcdTypeAssignModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (ecdTypeId: string) => void;
    ecdTypes: EcdType[];
    device: DaliDevice | null;
}

export const EcdTypeAssignModal: React.FC<EcdTypeAssignModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    ecdTypes,
    device
}) => {
    const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && device) {
            setSelectedTypeId(device.ecdTypeId || null);
        }
    }, [isOpen, device]);

    if (!isOpen || !device) {
        return null;
    }

    const handleConfirmClick = () => {
        if (selectedTypeId) {
            onConfirm(selectedTypeId);
        }
    };
    
    return (
        <div 
            className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 transition-opacity"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg transform transition-all"
                onClick={e => e.stopPropagation()}
            >
                <h2 className="text-xl font-bold text-gray-800 mb-2">Assign ECD Type</h2>
                <p className="text-sm text-gray-600 mb-4">
                    Select a type from the schedule for this ECD device.
                </p>

                <div className="mb-6 max-h-80 overflow-y-auto border rounded-lg p-2 space-y-1 bg-gray-50">
                    {ecdTypes.length > 0 ? (
                        ecdTypes.map(type => (
                            <div
                                key={type.id}
                                onClick={() => setSelectedTypeId(type.id)}
                                className={`flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors ${selectedTypeId === type.id ? 'bg-blue-100 ring-2 ring-blue-500' : 'hover:bg-gray-100'}`}
                            >
                                <div className="flex-grow min-w-0">
                                    <p className="font-bold text-gray-800">{type.reference}</p>
                                    <p className="text-xs text-gray-600 truncate" title={type.productCode}>{type.productCode || 'No product code'}</p>
                                    <p className="text-xs text-gray-500 truncate" title={type.description}>{type.description || 'No description'}</p>
                                </div>
                                <div className="text-right flex-shrink-0 ml-4">
                                    <p className="font-semibold text-blue-600">{type.busCurrent} mA</p>
                                    <div className="mt-2 w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center flex-shrink-0 mx-auto">
                                        {selectedTypeId === type.id && <div className="w-3 h-3 bg-blue-600 rounded-full"></div>}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-gray-500 p-4">
                            No ECD types have been defined in the schedule.
                        </p>
                    )}
                </div>

                <div className="flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors font-semibold"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirmClick}
                        disabled={!selectedTypeId}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Assign Type
                    </button>
                </div>
            </div>
        </div>
    );
};
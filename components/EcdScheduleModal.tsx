
import React, { useState, useEffect } from 'react';
import type { EcdType } from '../types';

interface EcdScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    ecdTypes: EcdType[];
    onAdd: (newTypeData: Omit<EcdType, 'id'>) => void;
    onUpdate: (updatedType: EcdType) => void;
    onDelete: (typeId: string) => void;
}

export const EcdScheduleModal: React.FC<EcdScheduleModalProps> = ({
    isOpen,
    onClose,
    ecdTypes,
    onAdd,
    onUpdate,
    onDelete,
}) => {
    const [editingType, setEditingType] = useState<Partial<EcdType> & { id?: string }>({});

    useEffect(() => {
        // Reset form when modal is closed
        if (!isOpen) {
            setEditingType({});
        }
    }, [isOpen]);

    if (!isOpen) {
        return null;
    }

    const handleInputChange = (field: keyof Omit<EcdType, 'id'>, value: string) => {
        setEditingType(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        const { id, reference, productCode, description, busCurrent } = editingType;
        const currentNum = parseFloat(String(busCurrent || ''));

        if (reference?.trim() && !isNaN(currentNum)) {
            const dataToSave = {
                reference: reference.trim(),
                productCode: productCode?.trim() || '',
                description: description?.trim() || '',
                busCurrent: currentNum,
            };

            if (id) {
                onUpdate({ ...dataToSave, id });
            } else {
                onAdd(dataToSave);
            }
            setEditingType({}); // Reset form
        }
    };
    
    const handleEditClick = (type: EcdType) => {
        setEditingType(type);
    };

    const handleCancelEdit = () => {
        setEditingType({});
    };

    return (
        <div 
            className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 transition-opacity"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl transform transition-all flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <h2 className="text-xl font-bold text-gray-800 mb-4">ECD Type Schedule</h2>
                <div className="flex-grow overflow-y-auto max-h-[60vh]">
                    <div className="max-h-60 overflow-y-auto mb-4 border rounded-lg">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-200 sticky top-0">
                                <tr>
                                    <th className="p-2">Ref</th>
                                    <th className="p-2">Product Code</th>
                                    <th className="p-2">Description</th>
                                    <th className="p-2">Current (mA)</th>
                                    <th className="p-2">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {(ecdTypes || []).map(type => (
                                    <tr key={type.id} className="border-b">
                                        <td className="p-2 font-medium">{type.reference}</td>
                                        <td className="p-2 truncate" title={type.productCode}>{type.productCode}</td>
                                        <td className="p-2 truncate" title={type.description}>{type.description}</td>
                                        <td className="p-2">{type.busCurrent}</td>
                                        <td className="p-2 space-x-2 whitespace-nowrap">
                                            <button onClick={() => handleEditClick(type)} className="text-blue-600 hover:underline">Edit</button>
                                            <button onClick={() => onDelete(type.id)} className="text-red-600 hover:underline">Del</button>
                                        </td>
                                    </tr>
                                ))}
                                {(ecdTypes || []).length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="text-center p-4 text-gray-500">No ECD types defined.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <form onSubmit={handleSave} className="space-y-3 text-sm p-4 border rounded-lg bg-gray-50">
                        <h4 className="font-semibold text-base">{editingType.id ? 'Edit Type' : 'Add New Type'}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block font-medium">Reference*</label>
                                <input type="text" value={editingType.reference || ''} onChange={e => handleInputChange('reference', e.target.value)} className="w-full p-1.5 border rounded-md" />
                            </div>
                            <div>
                                <label className="block font-medium">Bus Current (mA)*</label>
                                <input type="number" step="any" value={editingType.busCurrent || ''} onChange={e => handleInputChange('busCurrent', e.target.value)} className="w-full p-1.5 border rounded-md" />
                            </div>
                        </div>
                        <div>
                            <label className="block font-medium">Product Code</label>
                            <input type="text" value={editingType.productCode || ''} onChange={e => handleInputChange('productCode', e.target.value)} className="w-full p-1.5 border rounded-md" />
                        </div>
                        <div>
                            <label className="block font-medium">Description</label>
                            <input type="text" value={editingType.description || ''} onChange={e => handleInputChange('description', e.target.value)} className="w-full p-1.5 border rounded-md" />
                        </div>
                        <div className="flex justify-end space-x-2 pt-2">
                            {editingType.id && <button type="button" onClick={handleCancelEdit} className="px-4 py-2 bg-gray-200 rounded-md font-semibold text-gray-800 hover:bg-gray-300">Cancel</button>}
                            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700">{editingType.id ? 'Update Type' : 'Add Type'}</button>
                        </div>
                    </form>
                </div>

                <div className="flex justify-end pt-4 mt-4 border-t">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors font-semibold"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

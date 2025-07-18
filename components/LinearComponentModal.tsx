


import React, { useState, useEffect, useMemo } from 'react';
import type { Project, SymbolInfo, Discipline } from '../types';
import { LINEAR_DISCIPLINE_NAME } from '../constants';

interface LinearComponentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: { newComponentName?: string; existingSymbolId?: string; }) => void;
    project: Project | null;
}

export const LinearComponentModal: React.FC<LinearComponentModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    project,
}) => {
    const [selectedSymbolId, setSelectedSymbolId] = useState<string | null>(null);
    const [newComponentName, setNewComponentName] = useState('');

    const linearComponents = useMemo(() => {
        if (!project) return [];
        const linearDiscipline = project.disciplines.find(d => d.name === LINEAR_DISCIPLINE_NAME && !d.parentId);
        if (!linearDiscipline) return [];
        return project.symbols.filter(s => s.disciplineId === linearDiscipline.id);
    }, [project]);

    useEffect(() => {
        if (isOpen) {
            setSelectedSymbolId(null);
            setNewComponentName('');
        }
    }, [isOpen]);

    if (!isOpen || !project) {
        return null;
    }

    const handleConfirmClick = () => {
        if (selectedSymbolId) {
            onConfirm({ existingSymbolId: selectedSymbolId });
        } else if (newComponentName.trim()) {
            onConfirm({ newComponentName: newComponentName.trim() });
        }
    };

    const isConfirmDisabled = !selectedSymbolId && !newComponentName.trim();
    
    const renderSymbolItem = (symbol: SymbolInfo) => (
        <div
            key={symbol.id}
            onClick={() => { setSelectedSymbolId(symbol.id); setNewComponentName(''); }}
            className={`flex items-center space-x-3 p-2 rounded-md cursor-pointer transition-colors ${selectedSymbolId === symbol.id ? 'bg-blue-100 ring-2 ring-blue-500' : 'hover:bg-gray-200'}`}
        >
            <div className="w-10 h-10 bg-gray-100 rounded-md flex items-center justify-center p-1 border flex-shrink-0">
                <img src={symbol.image} alt={symbol.name} className="max-w-full max-h-full object-contain" />
            </div>
            <div className="flex-grow min-w-0">
                <p className="font-semibold text-gray-800 truncate">{symbol.name}</p>
                <p className="text-xs text-gray-500">Count: {symbol.count}</p>
            </div>
             <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center flex-shrink-0">
                {selectedSymbolId === symbol.id && <div className="w-3 h-3 bg-blue-600 rounded-full"></div>}
            </div>
        </div>
    );

    return (
        <div 
            className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 transition-opacity"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg transform transition-all"
                onClick={e => e.stopPropagation()}
            >
                <h2 className="text-xl font-bold text-gray-800 mb-2">Add Linear Component</h2>
                <p className="text-sm text-gray-600 mb-4">
                    Add a component like a bend or fitting to this point. Select an existing type or create a new one.
                </p>

                <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-600 mb-2">Create New Component</label>
                    <input
                        type="text"
                        placeholder='e.g., "90 Degree Bend"'
                        value={newComponentName}
                        onChange={(e) => {
                            setNewComponentName(e.target.value);
                            setSelectedSymbolId(null);
                        }}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>

                <div className="text-center text-sm text-gray-500 my-4">OR</div>

                <div className="mb-6">
                     <label className="block text-sm font-semibold text-gray-600 mb-2">Select Existing Component</label>
                    <div className="max-h-60 overflow-y-auto border rounded-lg p-2 space-y-1 bg-gray-50">
                        {linearComponents.length > 0 ? (
                            linearComponents.map(renderSymbolItem)
                        ) : (
                            <p className="text-center text-gray-500 p-4">
                               No linear components have been created yet.
                            </p>
                        )}
                    </div>
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
                        disabled={isConfirmDisabled}
                        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Add Component
                    </button>
                </div>
            </div>
        </div>
    );
};
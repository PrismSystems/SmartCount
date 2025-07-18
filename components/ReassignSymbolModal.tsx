
import React, { useState, useEffect } from 'react';
import type { SymbolInfo, Discipline } from '../types';

interface ReassignSymbolModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (newSymbolId: string) => void;
    currentSymbol: SymbolInfo | null | undefined;
    availableSymbols: SymbolInfo[];
    disciplines: Discipline[];
}

export const ReassignSymbolModal: React.FC<ReassignSymbolModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    currentSymbol,
    availableSymbols,
    disciplines
}) => {
    const [selectedSymbolId, setSelectedSymbolId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setSelectedSymbolId(null);
        }
    }, [isOpen]);

    if (!isOpen || !currentSymbol) {
        return null;
    }

    const handleConfirmClick = () => {
        if (selectedSymbolId) {
            onConfirm(selectedSymbolId);
        }
    };
    
    const renderSymbolItem = (symbol: SymbolInfo) => (
        <div
            key={symbol.id}
            onClick={() => setSelectedSymbolId(symbol.id)}
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
    
    const renderDisciplineTree = (parentId: string | null, level = 0) => {
        const childDisciplines = disciplines
            .filter(d => d.parentId === parentId)
            .sort((a, b) => a.name.localeCompare(b.name));

        return childDisciplines.map(discipline => {
            const getAllDescendantIds = (rootId: string): Set<string> => {
                const ids = new Set<string>();
                const queue: string[] = [rootId];
                while(queue.length > 0) {
                    const currentId = queue.shift()!;
                    if(!ids.has(currentId)) {
                        ids.add(currentId);
                        disciplines.filter(d => d.parentId === currentId).forEach(child => queue.push(child.id));
                    }
                }
                return ids;
            };
            
            const branchIds = getAllDescendantIds(discipline.id);
            const symbolsInBranch = availableSymbols.filter(s => s.disciplineId && branchIds.has(s.disciplineId));
            
            if (symbolsInBranch.length === 0) {
                return null;
            }
            
            const directSymbols = availableSymbols.filter(s => s.disciplineId === discipline.id).sort((a,b) => a.name.localeCompare(b.name));
            
            return (
                <div key={discipline.id} style={{ paddingLeft: `${level * 1}rem`}}>
                    <h3 className="text-sm font-semibold text-gray-600 mt-3 mb-1 px-2">
                        {discipline.name}
                    </h3>
                    <div className="space-y-1">
                        {directSymbols.map(renderSymbolItem)}
                    </div>
                    {renderDisciplineTree(discipline.id, level + 1)}
                </div>
            )
        });
    };
    
    const uncategorizedSymbols = availableSymbols.filter(s => !s.disciplineId).sort((a,b) => a.name.localeCompare(b.name));

    return (
        <div 
            className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 transition-opacity"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg transform transition-all"
                onClick={e => e.stopPropagation()}
            >
                <h2 className="text-xl font-bold text-gray-800 mb-2">Reassign Symbol Pin</h2>
                <p className="text-sm text-gray-600 mb-4">
                    Move one pin from <span className="font-semibold">{currentSymbol.name}</span> to a different symbol within the same discipline.
                </p>

                <div className="mb-6 max-h-80 overflow-y-auto border rounded-lg p-2 space-y-1 bg-gray-50">
                    {availableSymbols.length > 0 ? (
                        <>
                            {renderDisciplineTree(null)}
                            {uncategorizedSymbols.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-600 mt-3 mb-1 px-2">
                                        Uncategorized
                                    </h3>
                                    <div className="space-y-1">
                                        {uncategorizedSymbols.map(renderSymbolItem)}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-center text-gray-500 p-4">
                           No other symbols available in this discipline branch to reassign to.
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
                        disabled={!selectedSymbolId}
                        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Reassign Pin
                    </button>
                </div>
            </div>
        </div>
    );
};

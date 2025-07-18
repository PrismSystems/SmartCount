

import React, { useState, useEffect } from 'react';
import type { SymbolInfo, Discipline, Project, LinearMeasurement, DaliDevice } from '../types';
import { SymbolCard } from './SymbolCard';
import { AddIcon, ExportIcon, ChevronDownIcon, TrashIcon, EditIcon, TableIcon, PdfFileIcon, LoadingIcon } from './icons';

export interface SymbolsAndDisciplinesManagerProps {
    activeProject: Project;
    activePdfId: string | null;
    onStartManualSelection: () => void;
    onExportExcel: () => void;
    onExportPdfReport: () => void;
    onViewCounts: () => void;
    isExporting: boolean;
    isExportingPdf: boolean;
    isLoading: boolean;
    mode: string;
    onSymbolNameChange: (id: string, newName: string) => void;
    onSymbolColorChange: (id: string, newColor: string) => void;
    onSymbolImageChange: (id: string, file: File) => void;
    onSymbolDelete: (id: string) => void;
    onAddPoints: (symbolId: string) => void;
    onOpenCopyModal: (symbolId: string) => void;
    activeSymbolId: string | null;
    setActiveSymbolId: (id: string | null) => void;
    onAddDiscipline: (name: string, parentId: string | null) => void;
    onUpdateDisciplineName: (id: string, newName: string) => void;
    onAssignDiscipline: (symbolId: string, disciplineId: string | null) => void;
    activeDisciplineId: string | null;
    setActiveDisciplineId: (id: string | null) => void;
    onDeleteDiscipline: (disciplineId: string) => void;
    onUpdateDisciplineParent: (disciplineId: string, newParentId: string | null) => void;
    measurements: LinearMeasurement[];
}

export const SymbolsAndDisciplinesManager: React.FC<SymbolsAndDisciplinesManagerProps> = ({
    activeProject,
    activePdfId,
    onStartManualSelection,
    onExportExcel,
    onExportPdfReport,
    onViewCounts,
    isExporting,
    isExportingPdf,
    isLoading,
    mode,
    onSymbolNameChange,
    onSymbolColorChange,
    onSymbolImageChange,
    onSymbolDelete,
    onAddPoints,
    onOpenCopyModal,
    activeSymbolId,
    setActiveSymbolId,
    onAddDiscipline,
    onUpdateDisciplineName,
    onAssignDiscipline,
    activeDisciplineId,
    setActiveDisciplineId,
    onDeleteDiscipline,
    onUpdateDisciplineParent,
    measurements,
}) => {
    const { symbols, disciplines } = activeProject;
    const symbolsForActivePdf = symbols.filter(s => s.pdfId === activePdfId);

    const [newDisciplineName, setNewDisciplineName] = useState('');
    const [newDisciplineParentId, setNewDisciplineParentId] = useState('none');
    const [exportReady, setExportReady] = useState(false);
    const [exportLoadFailed, setExportLoadFailed] = useState(false);
    const [collapsedDisciplines, setCollapsedDisciplines] = useState(new Set<string>());
    const [draggedItem, setDraggedItem] = useState<{ id: string; type: 'symbol' | 'discipline' } | null>(null);
    const [dropTarget, setDropTarget] = useState<{ id: string | null; type: 'item' | 'root' } | null>(null);
    const [editingDiscipline, setEditingDiscipline] = useState<{id: string, name: string} | null>(null);
    
    const activeDiscipline = activeDisciplineId ? disciplines.find(d => d.id === activeDisciplineId) : null;

    useEffect(() => {
        if (window.ExcelJS) {
            setExportReady(true);
        } else {
            setExportLoadFailed(true);
        }
    }, []);

    const handleAddDiscipline = (e: React.FormEvent) => {
        e.preventDefault();
        onAddDiscipline(newDisciplineName, newDisciplineParentId === 'none' ? null : newDisciplineParentId);
        setNewDisciplineName('');
        setNewDisciplineParentId('none');
    };

    const toggleCollapse = (id: string) => {
        setCollapsedDisciplines(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const handleDragStart = (e: React.DragEvent, id: string, type: 'symbol' | 'discipline') => {
        e.dataTransfer.setData("application/json", JSON.stringify({ type, id }));
        e.dataTransfer.effectAllowed = "move";
        setTimeout(() => setDraggedItem({ id, type }), 0);
    };

    const handleDragEnd = () => {
        setDraggedItem(null);
        setDropTarget(null);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDragEnter = (e: React.DragEvent, id: string | null, type: 'item' | 'root') => {
        e.preventDefault();
        if (draggedItem && draggedItem.id !== id) {
            setDropTarget({ id, type });
        }
    };
    
    const handleDrop = (e: React.DragEvent, newParentId: string | null) => {
        e.preventDefault();
        e.stopPropagation();
        const dataStr = e.dataTransfer.getData("application/json");
        if (!dataStr) {
            handleDragEnd();
            return;
        }
    
        try {
            const { type, id: droppedId } = JSON.parse(dataStr);
    
            if (type === 'discipline') {
                if (droppedId && droppedId !== newParentId) {
                    onUpdateDisciplineParent(droppedId, newParentId);
                }
            } else if (type === 'symbol') {
                if (droppedId) {
                    onAssignDiscipline(droppedId, newParentId);
                }
            }
        } catch (error) {
            console.error("Failed to parse dropped data:", error);
        }
    
        handleDragEnd();
    };
    
    const getButtonText = () => {
        if (mode === 'selecting_manual') return 'Select an Area...';
        if (mode === 'placing_dots') return 'Placing Dots...';
        if (mode === 'drawing_area') return 'Drawing Area...';
        if (mode === 'setting_scale' || mode === 'drawing_measurement') return 'Measuring...';
        if (isLoading) return 'Processing...';
        return 'Add Manual Symbol';
    };

    const getExportButtonText = () => {
        if (isExporting) return 'Exporting...';
        if (exportLoadFailed) return 'Export Failed';
        if (!exportReady) return 'Loading Export...';
        return 'Export as Excel';
    };

    const getPdfExportButtonText = () => {
        if (isExportingPdf) return 'Generating...';
        return 'Export PDF Report';
    }

    const handleStartEditDiscipline = (discipline: Discipline) => {
        setEditingDiscipline({id: discipline.id, name: discipline.name});
    };

    const handleCancelEditDiscipline = () => {
        setEditingDiscipline(null);
    };

    const handleSaveDisciplineName = () => {
        if(editingDiscipline) {
            if (editingDiscipline.name.trim()) {
                onUpdateDisciplineName(editingDiscipline.id, editingDiscipline.name);
            }
            setEditingDiscipline(null);
        }
    };

    const renderSymbolGroup = (symbolList: SymbolInfo[]) => {
        return symbolList.map(symbol => (
            <SymbolCard
                key={symbol.id}
                symbol={symbol}
                onNameChange={onSymbolNameChange}
                onColorChange={onSymbolColorChange}
                onImageChange={onSymbolImageChange}
                onDelete={onSymbolDelete}
                isActive={symbol.id === activeSymbolId}
                onActivate={() => setActiveSymbolId(symbol.id === activeSymbolId ? null : symbol.id)}
                disciplines={disciplines}
                onAssignDiscipline={onAssignDiscipline}
                onAddPoints={onAddPoints}
                onOpenCopyModal={onOpenCopyModal}
                onDragStart={(e, id) => handleDragStart(e, id, 'symbol')}
                isBeingDragged={draggedItem?.type === 'symbol' && draggedItem.id === symbol.id}
            />
        ));
    };
    
    const renderDisciplineTree = (parentId: string | null, level: number = 0) => {
        const currentLevelDisciplines = disciplines.filter(d => d.parentId === parentId).sort((a,b) => a.name.localeCompare(b.name));

        return currentLevelDisciplines.map(discipline => {
            const disciplineSymbols = symbolsForActivePdf.filter(s => s.disciplineId === discipline.id);
            const children = disciplines.filter(d => d.parentId === discipline.id);
            const isCollapsible = children.length > 0 || disciplineSymbols.length > 0;
            const isCollapsed = collapsedDisciplines.has(discipline.id);
            const isActive = activeDisciplineId === discipline.id;
            const isDropTarget = dropTarget?.type === 'item' && dropTarget.id === discipline.id && draggedItem?.id !== discipline.id;
            const isBeingDragged = draggedItem?.type === 'discipline' && draggedItem.id === discipline.id;
            const isEditing = editingDiscipline?.id === discipline.id;

            return (
                <div key={discipline.id} style={{ opacity: isBeingDragged ? 0.4 : 1 }}>
                    <div
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, discipline.id)}
                        onDragEnter={(e) => handleDragEnter(e, discipline.id, 'item')}
                        className={`group relative rounded-lg ${isDropTarget ? 'bg-blue-200 outline-2 outline-dashed outline-blue-500' : ''}`}
                    >
                         <div
                            style={{ paddingLeft: `${level * 1.25}rem` }}
                            className={`mb-2 pr-1 rounded-md transition-colors flex items-center justify-between cursor-grab ${isActive ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                            draggable={!isEditing}
                            onDragStart={(e) => handleDragStart(e, discipline.id, 'discipline')}
                            onDragEnd={handleDragEnd}
                        >
                            <div 
                                onClick={() => setActiveDisciplineId(isActive ? null : discipline.id)}
                                className={`flex-grow py-1.5 cursor-pointer flex justify-between items-center ${isActive ? 'border-l-4 border-blue-500 pl-2 -ml-3' : 'pl-3'}`}
                            >
                                <div className="flex items-center min-w-0">
                                    {isCollapsible ? (
                                        <button onClick={(e) => { e.stopPropagation(); toggleCollapse(discipline.id); }} className="mr-1.5 p-0.5 rounded-full text-gray-500 hover:bg-gray-300/50 hover:text-gray-800">
                                            <ChevronDownIcon className={`h-4 w-4 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                                        </button>
                                    ) : (
                                        <div className="w-5 h-5 mr-1.5 p-0.5" />
                                    )}
                                    {isEditing ? (
                                         <input
                                            type="text"
                                            value={editingDiscipline.name}
                                            onChange={(e) => editingDiscipline && setEditingDiscipline({...editingDiscipline, name: e.target.value})}
                                            onBlur={handleSaveDisciplineName}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSaveDisciplineName();
                                                if (e.key === 'Escape') handleCancelEditDiscipline();
                                            }}
                                            onClick={e => e.stopPropagation()}
                                            autoFocus
                                            className="text-sm font-bold uppercase tracking-wider bg-transparent border-b border-blue-400 w-full focus:outline-none"
                                        />
                                    ) : (
                                        <h3 className={`text-sm font-bold uppercase tracking-wider truncate ${isCollapsed && isCollapsible ? 'text-gray-500' : 'text-gray-700'}`}>
                                            {discipline.name}
                                        </h3>
                                    )}
                                </div>
                                <span className="text-white bg-gray-400 rounded-full px-2 py-0.5 text-xs font-semibold ml-2">
                                    {symbolsForActivePdf.filter(s => s.disciplineId === discipline.id).reduce((acc, s) => acc + s.count, 0)}
                                </span>
                            </div>
                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => { e.stopPropagation(); handleStartEditDiscipline(discipline); }} className="p-1 text-gray-400 hover:text-blue-500" title="Rename Discipline">
                                    <EditIcon className="h-4 w-4"/>
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); onDeleteDiscipline(discipline.id); }} className="p-1 text-gray-400 hover:text-red-500" title="Delete Discipline">
                                    <TrashIcon className="h-4 w-4"/>
                                </button>
                            </div>
                        </div>
                    </div>
                     {!isCollapsed && (
                        <div>
                             {disciplineSymbols.length > 0 && (
                                <div className="space-y-3 mb-3" style={{ paddingLeft: `${(level + 1) * 1.25}rem` }}>
                                     {renderSymbolGroup(disciplineSymbols)}
                                </div>
                             )}
                             {renderDisciplineTree(discipline.id, level + 1)}
                        </div>
                     )}
                </div>
            )
        })
    };
    
    const renderDisciplineOptions = (parentId: string | null, level: number = 0): React.ReactNode[] => {
        const prefix = '\u00A0\u00A0'.repeat(level);
        return disciplines
            .filter(d => d.parentId === parentId)
            .sort((a, b) => a.name.localeCompare(b.name))
            .flatMap(d => [
                <option key={d.id} value={d.id}>{prefix}{d.name}</option>,
                ...renderDisciplineOptions(d.id, level + 1)
            ]);
    };
    
    const uncategorizedSymbols = symbolsForActivePdf.filter(s => !s.disciplineId);

    return (
        <div className="pt-2 px-1">
            {activeDiscipline && (
                <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg shadow-sm">
                    <p className="text-sm text-blue-800">
                        New symbols will be added to: <span className="font-bold">{activeDiscipline.name}</span>
                    </p>
                    <button 
                        onClick={() => setActiveDisciplineId(null)} 
                        className="text-xs text-blue-600 hover:underline mt-1 font-semibold"
                    >
                        Clear selection
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 gap-2 mb-4">
                <button
                    onClick={onStartManualSelection}
                    disabled={isLoading || mode !== 'idle'}
                    className="w-full flex items-center justify-center px-4 py-2.5 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-all shadow disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    <AddIcon />
                    <span className="ml-2 font-semibold">{getButtonText()}</span>
                </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                    onClick={onExportPdfReport}
                    disabled={!activePdfId || isExportingPdf}
                    className="w-full flex items-center justify-center px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all shadow disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    <PdfFileIcon />
                    <span className="ml-2 font-semibold text-sm">{getPdfExportButtonText()}</span>
                </button>
                <button
                    onClick={onExportExcel}
                    disabled={(symbols.length === 0 && measurements.length === 0 && (activeProject.daliDevices || []).length === 0) || isExporting || !exportReady}
                    className="w-full flex items-center justify-center px-4 py-2.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-all shadow disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    <ExportIcon />
                    <span className="ml-2 font-semibold text-sm">{getExportButtonText()}</span>
                </button>
            </div>
             <div className="grid grid-cols-1 gap-2 mb-4">
                <button
                    onClick={onViewCounts}
                    disabled={symbols.length === 0 && measurements.length === 0 && (activeProject.daliDevices || []).length === 0}
                    className="w-full flex items-center justify-center px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all shadow disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    <TableIcon />
                    <span className="ml-2 font-semibold">View Counts</span>
                </button>
            </div>
            
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
                <h2 className="text-lg font-semibold text-gray-700 mb-3">Disciplines</h2>
                <form onSubmit={handleAddDiscipline} className="space-y-2">
                    <input 
                        type="text"
                        value={newDisciplineName}
                        onChange={(e) => setNewDisciplineName(e.target.value)}
                        placeholder="New discipline name..."
                        className="w-full text-sm p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                    <div className="flex space-x-2">
                        <select 
                            value={newDisciplineParentId}
                            onChange={(e) => setNewDisciplineParentId(e.target.value)}
                            className="flex-grow w-full text-sm p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
                        >
                            <option value="none">-- Top Level --</option>
                            {renderDisciplineOptions(null)}
                        </select>
                        <button type="submit" className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm font-semibold">Add</button>
                    </div>
                </form>
            </div>
            
            <div 
                className={`space-y-1 rounded-lg ${dropTarget?.type === 'root' ? 'bg-blue-100 outline-2 outline-dashed outline-blue-500' : ''}`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, null)}
                onDragEnter={(e) => handleDragEnter(e, null, 'root')}
            >
                {symbolsForActivePdf.length === 0 && !isLoading && disciplines.length === 0 && (
                    <div className="text-center text-gray-500 mt-8">
                        <p>No symbols counted for this document.</p>
                        <p className="text-sm">Click "Add Manual Symbol" to start.</p>
                    </div>
                )}
                
                {renderDisciplineTree(null)}

                {uncategorizedSymbols.length > 0 && (
                    <div className="mb-2 mt-4">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">Uncategorized</h3>
                        <div className="space-y-3">
                            {renderSymbolGroup(uncategorizedSymbols)}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};



import React, { useState, useRef } from 'react';
import type { SymbolInfo, Discipline } from '../types';
import { TrashIcon, AddIcon, CopyIcon, EditIcon } from './icons';

interface SymbolCardProps {
    symbol: SymbolInfo;
    onNameChange: (id: string, newName: string) => void;
    onColorChange: (id: string, newColor: string) => void;
    onImageChange: (id: string, file: File) => void;
    onDelete: (id: string) => void;
    isActive: boolean;
    onActivate: () => void;
    disciplines: Discipline[];
    onAssignDiscipline: (symbolId: string, disciplineId: string | null) => void;
    onAddPoints: (symbolId: string) => void;
    onOpenCopyModal: (symbolId: string) => void;
    onDragStart: (e: React.DragEvent, symbolId: string) => void;
    isBeingDragged: boolean;
}

export const SymbolCard: React.FC<SymbolCardProps> = ({
    symbol,
    onNameChange,
    onColorChange,
    onImageChange,
    onDelete,
    isActive,
    onActivate,
    disciplines,
    onAssignDiscipline,
    onAddPoints,
    onOpenCopyModal,
    onDragStart,
    isBeingDragged,
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(symbol.name);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const currentDisciplineExists = symbol.disciplineId ? disciplines.some(d => d.id === symbol.disciplineId) : true;

    const handleNameBlur = () => {
        setIsEditing(false);
        if (name.trim() === '') {
            setName(symbol.name); // revert if empty
        } else {
            onNameChange(symbol.id, name);
        }
    };

    const handleDisciplineChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        e.stopPropagation();
        const newDisciplineId = e.target.value;
        onAssignDiscipline(symbol.id, newDisciplineId === 'none' ? null : newDisciplineId);
    };

    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsEditing(true);
    };

    const handleImageContainerClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        const file = e.target.files?.[0];
        if (file) {
            onImageChange(symbol.id, file);
        }
        // Reset file input value to allow re-uploading the same file
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
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

    return (
        <div 
            onClick={onActivate}
            draggable
            onDragStart={(e) => onDragStart(e, symbol.id)}
            className={`p-3 rounded-lg border-2 transition-all cursor-pointer shadow-sm ${isActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'} ${isBeingDragged ? 'opacity-40' : ''}`}
        >
            <div className="flex items-center space-x-4">
                <div 
                    onClick={handleImageContainerClick}
                    className="relative group/image w-12 h-12 bg-gray-100 rounded-md flex items-center justify-center p-1 border cursor-pointer"
                    style={{borderColor: isActive ? symbol.color : '#e5e7eb'}}
                >
                    <img src={symbol.image} alt={symbol.name} className="max-w-full max-h-full object-contain" />
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/image:opacity-100 transition-opacity">
                        <EditIcon className="h-6 w-6 text-white"/>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
                <div className="flex-grow min-w-0">
                    {isEditing ? (
                         <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onBlur={handleNameBlur}
                            onKeyDown={(e) => e.key === 'Enter' && handleNameBlur()}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                            className="text-md font-semibold text-gray-800 bg-transparent border-b border-blue-400 w-full focus:outline-none"
                        />
                    ) : (
                        <p 
                            className="text-md font-semibold text-gray-800 truncate hover:text-blue-600"
                            onClick={handleEditClick}
                            title="Click to edit"
                        >
                            {symbol.name}
                        </p>
                    )}
                   
                    <p className="text-sm text-gray-500">
                        Page: {symbol.page} ({symbol.type === 'ai' ? 'AI' : 'Manual'})
                    </p>
                </div>
                <div className="flex flex-col items-center justify-center w-16 flex-shrink-0">
                    <p className="text-2xl font-bold" style={{color: symbol.color}}>{symbol.count}</p>
                    <p className="text-xs text-gray-500 -mt-1">found</p>
                </div>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-200/80 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <select
                        value={currentDisciplineExists ? symbol.disciplineId || 'none' : 'none'}
                        onChange={handleDisciplineChange}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-gray-600 bg-gray-100 border border-gray-300 rounded-md py-1 px-2 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors hover:bg-gray-200"
                        aria-label="Assign discipline"
                    >
                        <option value="none">-- Assign --</option>
                        {renderDisciplineOptions(null)}
                    </select>
                    <div className="relative w-6 h-6" title="Change symbol color">
                        <div
                            style={{ backgroundColor: symbol.color }}
                            className="w-full h-full rounded-md border border-gray-300"
                        />
                        <input
                            type="color"
                            value={symbol.color}
                            onChange={(e) => onColorChange(symbol.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                        />
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={(e) => {e.stopPropagation(); onAddPoints(symbol.id)}}
                        className="text-xs flex items-center text-sky-600 hover:text-sky-800 bg-sky-100 hover:bg-sky-200 px-2 py-1 rounded-md transition-colors"
                        aria-label="Add or edit points"
                    >
                        <AddIcon className="h-4 w-4 mr-1"/>
                        Points
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onOpenCopyModal(symbol.id); }}
                        className="text-gray-400 hover:text-blue-500 transition-colors"
                        title="Copy symbol to other documents"
                        aria-label="Copy symbol"
                    >
                        <CopyIcon />
                    </button>
                    <button 
                        onClick={(e) => {e.stopPropagation(); onDelete(symbol.id)}}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        aria-label="Delete symbol"
                    >
                        <TrashIcon/>
                    </button>
                </div>
            </div>
        </div>
    );
};

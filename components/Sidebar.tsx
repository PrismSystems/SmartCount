

import React, { useState, Fragment, useEffect, useRef } from 'react';
import type { SymbolInfo, Discipline, Project, PdfFile, Area, LinearMeasurement, ScaleInfo, ManualEntry, MeasurementGroup, DaliNetwork, DaliDevice, DaliDeviceType, EcdType, DaliNetworkTemplate, PsuLocation } from '../types';
import { SymbolCard } from './SymbolCard';
import { AddIcon, ExportIcon, ProjectsIcon, ChevronDownIcon, TrashIcon, EyeIcon, EyeOffIcon, EditIcon, TableIcon, RulerIcon, PdfFileIcon, LoadingIcon, PaintBrushIcon, TextIcon, TextOffIcon, PsuIcon, RenumberIcon, SaveIcon, WarningIcon } from './icons';
import { measurementService } from '../services/measurementService';
import { SymbolsAndDisciplinesManager } from './SymbolsAndDisciplinesManager';
import {Version_Number} from "@/constants.ts";

interface SidebarProps {
    projects: Project[];
    activeProject: Project;
    onSwitchProject: (id: string) => void;
    onCreateNewProject: () => void;
    onDeleteProject: (id: string) => void | Promise<void>;
    onLogout: () => void;
    activePdfId: string | null;
    currentPage: number;
    onSwitchPdf: (pdfId: string) => void;
    onAddPdfs: (files: File[]) => void;
    onUpdatePdfLevel: (pdfId: string, newLevel: string) => void;
    onDeletePdf: (pdfId: string) => void;
    onStartManualSelection: () => void;
    onExportExcel: () => void;
    onExportPdfReport: () => void;
    onExportDaliPdfReport: () => void;
    onViewCounts: () => void;
    isExporting: boolean;
    isExportingPdf: boolean;
    isExportingDaliPdf: boolean;
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
    onBackupAll: () => void;
    onBackupSingleProject: () => void;
    onRestoreAll: (file: File) => void;
    onStartAreaDrawing: () => void;
    onDeleteArea: (areaId: string) => void;
    onUpdateArea: (areaId: string, updates: Partial<Area>) => void;
    onStartSetScale: () => void;
    onStartMeasure: () => void;
    onStartAddToMeasurement: (measurementId: string) => void;
    onUpdateMeasurement: (measurementId: string, updates: Partial<Omit<LinearMeasurement, 'id' | 'pdfId'>>) => void;
    onDeleteMeasurement: (measurementId: string) => void;
    measurements: LinearMeasurement[];
    measurementGroups: MeasurementGroup[];
    onAddMeasurementGroup: (name: string, parentId: string | null) => void;
    onUpdateMeasurementGroupName: (id: string, newName: string) => void;
    onDeleteMeasurementGroup: (id: string) => void;
    onAssignMeasurementToGroup: (measurementId: string, groupId: string | null) => void;
    onUpdateMeasurementGroupParent: (groupId: string, newParentId: string | null) => void;
    scaleInfo: ScaleInfo | undefined;
    selectedMeasurementId: string | null;
    onSelectMeasurement: (id: string | null) => void;
    onOpenManualLengthModal: (measurementId: string, segmentIndex: number, pointIndex: number, entry?: ManualEntry) => void;
    onDeleteManualEntry: (measurementId: string, entryId: string) => void;
    pdfOpacity: number;
    onPdfOpacityChange: (opacity: number) => void;

    // DALI Props
    onAddDaliNetwork: (templateId?: string) => void;
    onUpdateDaliNetwork: (id: string, updates: Partial<DaliNetwork>) => void;
    onDeleteDaliNetwork: (id: string) => void;
    onStartDaliPlacement: (networkId: string, deviceType: DaliDeviceType) => void;
    onOpenEcdSchedule: () => void;
    onDaliNetworkHover: (networkId: string | null) => void;
    onStartDaliPaintSelection: () => void;
    showDaliLabels: boolean;
    onToggleDaliLabels: () => void;
    onStartPlacePsu: (networkId: string) => void;
    onDeletePsu: (networkId: string) => void;
    onRenumberDaliNetwork: (networkId: string) => void;
    onSaveDaliNetworkAsTemplate: (networkId: string) => void;
}

const ProjectsDropdown: React.FC<{
    projects: Project[],
    activeProject: Project,
    onSwitchProject: (id: string) => void;
    onCreateNew: () => void;
    onDeleteProject: (id: string) => void | Promise<void>;
    onLogout: () => void;
    onBackupAll: () => void;
    onBackupSingleProject: () => void;
    onRestoreAll: (file: File) => void;
}> = ({ projects, activeProject, onSwitchProject, onCreateNew, onDeleteProject, onLogout, onBackupAll, onBackupSingleProject, onRestoreAll }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const restoreInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleDelete = () => {
        if(window.confirm(`Are you sure you want to delete project "${activeProject.name}"? This cannot be undone.`)){
            onDeleteProject(activeProject.id);
        }
    }

    const handleRestoreClick = () => {
        restoreInputRef.current?.click();
    };

    const handleRestoreFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onRestoreAll(file);
            if (restoreInputRef.current) {
                restoreInputRef.current.value = '';
            }
        }
        setIsOpen(false);
    };
    
    const sortedProjects = [...projects].sort((a,b) => b.createdAt - a.createdAt);

    return (
        <div className="relative" ref={dropdownRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-all shadow">
                <div className="flex items-center">
                    <ProjectsIcon />
                    <span className="ml-3 font-semibold truncate">{activeProject.name}</span>
                </div>
                <ChevronDownIcon className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute z-20 top-full mt-2 w-full bg-white rounded-lg shadow-xl border border-gray-200 max-h-96 overflow-y-auto">
                    <div className="p-2">
                        <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase">Projects</p>
                        {sortedProjects.map(p => (
                            <button
                                key={p.id}
                                onClick={() => { onSwitchProject(p.id); setIsOpen(false); }}
                                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${p.id === activeProject.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                            >
                                {p.name}
                            </button>
                        ))}
                    </div>
                    <div className="border-t border-gray-100 p-2">
                        <button onClick={() => { onCreateNew(); setIsOpen(false); }} className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-green-600 hover:bg-green-50">
                            Create New Project...
                        </button>
                         <button onClick={handleDelete} className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50">
                            Delete Current Project
                        </button>
                    </div>
                    <div className="border-t border-gray-100 p-2">
                         <button onClick={() => {onBackupSingleProject(); setIsOpen(false);}} className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100">
                            Backup This Project
                        </button>
                        <button onClick={() => {onBackupAll(); setIsOpen(false);}} className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100">
                            Backup All Projects
                        </button>
                         <input
                            type="file"
                            ref={restoreInputRef}
                            className="hidden"
                            accept=".json"
                            onChange={handleRestoreFileChange}
                        />
                        <button onClick={handleRestoreClick} className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100">
                            Restore All from Backup...
                        </button>
                    </div>
                    <div className="border-t border-gray-100 p-2">
                         <button onClick={onLogout} className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50">
                            Logout
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const PdfSwitcher: React.FC<{
    pdfs: PdfFile[];
    activePdfId: string | null;
    onSwitchPdf: (pdfId: string) => void;
    onAddPdfs: (files: File[]) => void;
    onUpdatePdfLevel: (pdfId: string, newLevel: string) => void;
    onDeletePdf: (pdfId: string) => void;
}> = ({ pdfs, activePdfId, onSwitchPdf, onAddPdfs, onUpdatePdfLevel, onDeletePdf }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const handleAddClick = () => fileInputRef.current?.click();
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onAddPdfs(Array.from(e.target.files));
        }
    };

    const handleLevelUpdate = (e: React.FocusEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>, pdfId: string) => {
        const inputElement = e.currentTarget;
        const currentLevel = pdfs.find(p => p.id === pdfId)?.level || '';
        if (inputElement.value.trim() !== currentLevel.trim()) {
            onUpdatePdfLevel(pdfId, inputElement.value.trim());
        }
    };

    return (
        <div className="mb-2">
            <div className="flex justify-end items-center mb-2">
                <button
                    onClick={handleAddClick}
                    className="p-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                    title="Add PDF(s) to project"
                >
                    <AddIcon className="h-4 w-4" />
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".pdf"
                    multiple
                    onChange={handleFileChange}
                />
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto border rounded-lg p-1 bg-gray-50">
                {pdfs.map(pdf => {
                    const isActive = pdf.id === activePdfId;
                    return (
                        <div key={pdf.id} className={`group flex items-center justify-between p-2 rounded-md transition-colors ${isActive ? 'bg-blue-100' : 'hover:bg-gray-100'}`}>
                            <button
                                onClick={() => onSwitchPdf(pdf.id)}
                                className={`flex-grow text-left truncate text-sm font-medium pr-2 ${isActive ? 'text-blue-700' : 'text-gray-700'}`}
                                title={pdf.name}
                            >
                                {pdf.name}
                            </button>
                            <div className="flex items-center flex-shrink-0">
                                <input
                                    type="text"
                                    defaultValue={pdf.level || ''}
                                    onBlur={(e) => handleLevelUpdate(e, pdf.id)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleLevelUpdate(e, pdf.id);
                                            e.currentTarget.blur();
                                        }
                                    }}
                                    placeholder="Level"
                                    className="w-24 ml-2 p-1 text-xs border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
                                    aria-label={`Level for ${pdf.name}`}
                                />
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeletePdf(pdf.id);
                                    }}
                                    className="ml-2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title={`Delete ${pdf.name}`}
                                    aria-label={`Delete ${pdf.name}`}
                                >
                                    <TrashIcon className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const AreaManager: React.FC<{
    areas: Area[];
    onStartAreaDrawing: () => void;
    onDeleteArea: (areaId: string) => void;
    onUpdateArea: (areaId: string, updates: Partial<Area>) => void;
    mode: string;
}> = ({ areas, onStartAreaDrawing, onDeleteArea, onUpdateArea, mode }) => {
    const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');

    const handleNameUpdate = (areaId: string) => {
        if(editingName.trim()) {
            onUpdateArea(areaId, { name: editingName.trim() });
        }
        setEditingAreaId(null);
        setEditingName('');
    }

    return (
        <div className="p-3 bg-gray-50 rounded-lg border">
            <button
                onClick={onStartAreaDrawing}
                disabled={mode !== 'idle'}
                className="w-full flex items-center justify-center px-4 py-2.5 mb-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all shadow disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
                <AddIcon />
                <span className="ml-2 font-semibold">Define New Area</span>
            </button>
            <div className="space-y-2 max-h-40 overflow-y-auto">
                {areas.map(area => (
                    <div key={area.id} className={`group flex items-center justify-between p-2 rounded-md hover:bg-gray-100`}>
                        <div className="flex items-center flex-grow min-w-0">
                             <div className="w-4 h-4 rounded-sm mr-2 flex-shrink-0" style={{backgroundColor: area.color}}></div>
                            {editingAreaId === area.id ? (
                                <input
                                    type="text"
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    onBlur={() => handleNameUpdate(area.id)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleNameUpdate(area.id)}
                                    autoFocus
                                    className="text-sm font-medium text-gray-800 bg-transparent border-b border-blue-400 w-full focus:outline-none"
                                />
                            ) : (
                                <span className="text-sm font-medium text-gray-700 truncate">{area.name}</span>
                            )}
                        </div>
                        <div className="flex items-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button
                                onClick={() => { setEditingAreaId(area.id); setEditingName(area.name); }}
                                className="p-1 text-gray-400 hover:text-blue-500"
                                title="Rename Area"
                            >
                                <EditIcon className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => onUpdateArea(area.id, { isVisible: !area.isVisible })}
                                className="p-1 text-gray-400 hover:text-blue-500"
                                title={area.isVisible ? "Hide Area" : "Show Area"}
                            >
                                {area.isVisible ? <EyeIcon className="h-4 w-4" /> : <EyeOffIcon className="h-4 w-4" />}
                            </button>
                            <button
                                onClick={() => onDeleteArea(area.id)}
                                className="p-1 text-gray-400 hover:text-red-500"
                                title="Delete Area"
                            >
                                <TrashIcon className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                ))}
                {areas.length === 0 && <p className="text-xs text-center text-gray-500 py-2">No areas defined for this document.</p>}
            </div>
        </div>
    );
};

const MeasurementCard: React.FC<{
    measurement: LinearMeasurement,
    scaleInfo: ScaleInfo | undefined,
    isSelected: boolean,
    onSelect: () => void,
    onUpdate: (id: string, updates: Partial<Omit<LinearMeasurement, 'id' | 'pdfId'>>) => void,
    onDelete: (id: string) => void,
    onAddSegment: (id: string) => void,
    onOpenManualLengthModal: (measurementId: string, segmentIndex: number, pointIndex: number, entry?: ManualEntry) => void,
    onDeleteManualEntry: (measurementId: string, entryId: string) => void;
    onDragStart: (e: React.DragEvent, measurementId: string) => void;
    isBeingDragged: boolean;
}> = ({ measurement, scaleInfo, isSelected, onSelect, onUpdate, onDelete, onAddSegment, onOpenManualLengthModal, onDeleteManualEntry, onDragStart, isBeingDragged }) => {
    const [isEditingName, setIsEditingName] = useState(false);
    const [name, setName] = useState(measurement.name);

    useEffect(() => {
        if (!isEditingName) {
            setName(measurement.name);
        }
    }, [isEditingName, measurement.name]);

    const handleNameBlur = () => {
        setIsEditingName(false);
        if (name.trim() && name.trim() !== measurement.name) {
            onUpdate(measurement.id, { name: name.trim() });
        } else {
            setName(measurement.name);
        }
    };

    const drawnLength = measurementService.calculateDrawnLength(measurement, scaleInfo);
    const manualLength = measurementService.calculateManualLength(measurement);
    const totalLength = drawnLength + manualLength;

    return (
        <div 
            onClick={onSelect}
            draggable
            onDragStart={(e) => onDragStart(e, measurement.id)}
            className={`group p-2 rounded-lg transition-all cursor-pointer border-2 ${isSelected ? 'bg-blue-50 border-blue-500' : 'bg-white border-transparent hover:border-gray-300'} ${isBeingDragged ? 'opacity-40' : ''}`}
        >
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-4 h-4 rounded-sm flex-shrink-0 mt-0.5" style={{backgroundColor: measurement.color}}></div>
                    {isEditingName ? (
                         <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onBlur={handleNameBlur}
                            onKeyDown={(e) => e.key === 'Enter' && handleNameBlur()}
                            onClick={e => e.stopPropagation()}
                            autoFocus
                            className="text-sm font-medium text-gray-800 bg-transparent border-b border-blue-400 w-full focus:outline-none"
                        />
                    ) : (
                        <span className="text-sm font-medium text-gray-700 truncate">{measurement.name}</span>
                    )}
                </div>
                 <span className="text-sm font-bold flex-shrink-0" style={{color: measurement.color}}>
                    {measurementService.formatLength(totalLength)}
                </span>
            </div>

            {(drawnLength > 0 || manualLength > 0) && (
                 <p className="text-xs text-gray-500 pl-6">
                    Drawn: {measurementService.formatLength(drawnLength)} + Manual: {measurementService.formatLength(manualLength)}
                 </p>
            )}

            <div className="pl-6 mt-1">
                {(measurement.manualEntries || []).map(entry => (
                    <div key={entry.id} className="group/entry flex items-center justify-between text-xs text-gray-600 hover:bg-gray-100 rounded p-1">
                       <span>+ {measurementService.formatLength(entry.length)} (Vertical)</span>
                       <div className="opacity-0 group-hover/entry:opacity-100">
                           <button onClick={(e) => { e.stopPropagation(); onOpenManualLengthModal(measurement.id, entry.segmentIndex, entry.pointIndex, entry); }} className="p-0.5 hover:text-blue-600"><EditIcon className="h-3 w-3"/></button>
                           <button onClick={(e) => { e.stopPropagation(); onDeleteManualEntry(measurement.id, entry.id); }} className="p-0.5 hover:text-red-600"><TrashIcon className="h-3 w-3"/></button>
                       </div>
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-end space-x-2 mt-1">
                 <div className="relative w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" title="Change color">
                        <div style={{ backgroundColor: measurement.color }} className="w-full h-full rounded-md border border-gray-300"/>
                        <input
                            type="color"
                            value={measurement.color}
                            onChange={(e) => onUpdate(measurement.id, { color: e.target.value })}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                        />
                </div>
                <button onClick={() => onUpdate(measurement.id, { isVisible: !measurement.isVisible })} className="p-1 text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" title={measurement.isVisible ? 'Hide' : 'Show'}>
                    {measurement.isVisible ? <EyeIcon className="h-4 w-4" /> : <EyeOffIcon className="h-4 w-4" />}
                </button>
                <button onClick={() => setIsEditingName(true)} className="p-1 text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Rename"><EditIcon className="h-4 w-4" /></button>
                <button onClick={() => onAddSegment(measurement.id)} className="p-1 text-gray-400 hover:text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Add to Measurement"><AddIcon className="h-4 w-4" /></button>
                <button onClick={() => onDelete(measurement.id)} className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete"><TrashIcon className="h-4 w-4" /></button>
            </div>
        </div>
    );
};

const MeasurementManager: React.FC<Pick<SidebarProps,
    'measurements' | 'measurementGroups' | 'scaleInfo' | 'onStartSetScale' | 
    'onStartMeasure' | 'onStartAddToMeasurement' | 'onUpdateMeasurement' | 
    'onDeleteMeasurement' | 'mode' | 'selectedMeasurementId' | 
    'onSelectMeasurement' | 'onOpenManualLengthModal' | 'onDeleteManualEntry' |
    'onAddMeasurementGroup' | 'onUpdateMeasurementGroupName' | 'onDeleteMeasurementGroup' |
    'onAssignMeasurementToGroup' | 'onUpdateMeasurementGroupParent'
>> = (props) => {
    const { 
        measurements, scaleInfo, onStartSetScale, onStartMeasure, 
        onStartAddToMeasurement, onUpdateMeasurement, onDeleteMeasurement, mode, 
        selectedMeasurementId, onSelectMeasurement, onOpenManualLengthModal, onDeleteManualEntry,
        measurementGroups, onAddMeasurementGroup, onUpdateMeasurementGroupName, onDeleteMeasurementGroup,
        onAssignMeasurementToGroup, onUpdateMeasurementGroupParent
    } = props;
    
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupParentId, setNewGroupParentId] = useState('none');
    const [draggedItem, setDraggedItem] = useState<{ id: string; type: 'measurement' | 'group' } | null>(null);
    const [dropTarget, setDropTarget] = useState<{ id: string | null; type: 'item' | 'root' } | null>(null);
    const [editingGroup, setEditingGroup] = useState<{id: string, name: string} | null>(null);
    const [collapsedGroups, setCollapsedGroups] = useState(new Set<string>());

    const handleAddGroup = (e: React.FormEvent) => {
        e.preventDefault();
        onAddMeasurementGroup(newGroupName, newGroupParentId === 'none' ? null : newGroupParentId);
        setNewGroupName('');
    };

    const handleDragStart = (e: React.DragEvent, id: string, type: 'measurement' | 'group') => {
        e.dataTransfer.setData("application/json", JSON.stringify({ type, id }));
        e.dataTransfer.effectAllowed = "move";
        setTimeout(() => setDraggedItem({ id, type }), 0);
    };

    const handleDragEnd = () => {
        setDraggedItem(null);
        setDropTarget(null);
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
            if (type === 'group') {
                if (droppedId && droppedId !== newParentId) {
                    onUpdateMeasurementGroupParent(droppedId, newParentId);
                }
            } else if (type === 'measurement') {
                if (droppedId) {
                    onAssignMeasurementToGroup(droppedId, newParentId);
                }
            }
        } catch (error) {
            console.error("Failed to parse dropped data:", error);
        }
        handleDragEnd();
    };

    const renderGroupOptions = (parentId: string | null, level: number = 0): React.ReactNode[] => {
        const prefix = '\u00A0\u00A0'.repeat(level);
        return (measurementGroups || [])
            .filter(g => g.parentId === parentId)
            .sort((a, b) => a.name.localeCompare(b.name))
            .flatMap(g => [
                <option key={g.id} value={g.id}>{prefix}{g.name}</option>,
                ...renderGroupOptions(g.id, level + 1)
            ]);
    };

    const renderMeasurementList = (measurementList: LinearMeasurement[]) => (
        <div className="space-y-1">
            {measurementList.map(m => (
                 <MeasurementCard 
                    key={m.id}
                    measurement={m}
                    scaleInfo={scaleInfo}
                    isSelected={m.id === selectedMeasurementId}
                    onSelect={() => onSelectMeasurement(m.id === selectedMeasurementId ? null : m.id)}
                    onUpdate={onUpdateMeasurement}
                    onDelete={onDeleteMeasurement}
                    onAddSegment={onStartAddToMeasurement}
                    onOpenManualLengthModal={onOpenManualLengthModal}
                    onDeleteManualEntry={onDeleteManualEntry}
                    onDragStart={(e, id) => handleDragStart(e, id, 'measurement')}
                    isBeingDragged={draggedItem?.type === 'measurement' && draggedItem.id === m.id}
                />
            ))}
        </div>
    );

    const renderMeasurementGroupTree = (parentId: string | null, level: number = 0) => {
        const currentLevelGroups = (measurementGroups || [])
            .filter(g => g.parentId === parentId)
            .sort((a, b) => a.name.localeCompare(b.name));

        return currentLevelGroups.map(group => {
            const groupMeasurements = measurements.filter(m => m.groupId === group.id);
            const isCollapsed = collapsedGroups.has(group.id);
            const isDropTarget = dropTarget?.type === 'item' && dropTarget.id === group.id && draggedItem?.id !== group.id;
            const isBeingDragged = draggedItem?.type === 'group' && draggedItem.id === group.id;
            const isEditing = editingGroup?.id === group.id;

            return (
                <div key={group.id} style={{ opacity: isBeingDragged ? 0.4 : 1 }}>
                    <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, group.id)}
                        onDragEnter={(e) => { e.preventDefault(); setDropTarget({ id: group.id, type: 'item' }); }}
                        className={`group relative rounded-lg mb-1 ${isDropTarget ? 'bg-blue-200 outline-2 outline-dashed outline-blue-500' : ''}`}
                    >
                        <div
                            style={{ paddingLeft: `${level * 1.25}rem` }}
                            className={`pr-1 rounded-md transition-colors flex items-center justify-between cursor-grab hover:bg-gray-100`}
                            draggable={!isEditing}
                            onDragStart={(e) => handleDragStart(e, group.id, 'group')}
                            onDragEnd={handleDragEnd}
                        >
                             <div className="flex-grow py-1.5 cursor-pointer flex justify-between items-center" onClick={() => setCollapsedGroups(prev => { const s = new Set(prev); s.has(group.id) ? s.delete(group.id) : s.add(group.id); return s; })}>
                                <div className="flex items-center min-w-0">
                                    <ChevronDownIcon className={`h-4 w-4 mr-1.5 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={editingGroup.name}
                                            onChange={(e) => editingGroup && setEditingGroup({ ...editingGroup, name: e.target.value })}
                                            onBlur={() => { onUpdateMeasurementGroupName(editingGroup!.id, editingGroup!.name); setEditingGroup(null); }}
                                            onKeyDown={(e) => { if (e.key === 'Enter') { onUpdateMeasurementGroupName(editingGroup!.id, editingGroup!.name); setEditingGroup(null); } if (e.key === 'Escape') setEditingGroup(null); }}
                                            onClick={e => e.stopPropagation()}
                                            autoFocus
                                            className="text-sm font-bold uppercase tracking-wider bg-transparent border-b border-blue-400 w-full focus:outline-none"
                                        />
                                    ) : (
                                        <h3 className="text-sm font-bold uppercase tracking-wider truncate text-gray-700">{group.name}</h3>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => { e.stopPropagation(); setEditingGroup({id: group.id, name: group.name}); }} className="p-1 text-gray-400 hover:text-blue-500" title="Rename Group"><EditIcon className="h-4 w-4" /></button>
                                <button onClick={(e) => { e.stopPropagation(); onDeleteMeasurementGroup(group.id); }} className="p-1 text-gray-400 hover:text-red-500" title="Delete Group"><TrashIcon className="h-4 w-4" /></button>
                            </div>
                        </div>
                    </div>
                    {!isCollapsed && (
                        <div className="pt-1" style={{ paddingLeft: `${(level + 1) * 0.5}rem` }}>
                            {renderMeasurementList(groupMeasurements)}
                            {renderMeasurementGroupTree(group.id, level + 1)}
                        </div>
                    )}
                </div>
            );
        });
    };

    const ungroupedMeasurements = measurements.filter(m => !m.groupId);

    return (
        <div className="p-3 bg-gray-50 rounded-lg border">
            <div className="grid grid-cols-2 gap-2 mb-3">
                <button onClick={onStartSetScale} disabled={mode !== 'idle'} className="w-full flex items-center justify-center px-4 py-2.5 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all shadow disabled:bg-gray-400 disabled:cursor-not-allowed">
                    <span className="font-semibold text-sm">Set Scale</span>
                </button>
                <button onClick={onStartMeasure} disabled={mode !== 'idle' || !scaleInfo} className="w-full flex items-center justify-center px-4 py-2.5 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all shadow disabled:bg-gray-400 disabled:cursor-not-allowed">
                    <RulerIcon className="h-5 w-5"/>
                    <span className="ml-2 font-semibold text-sm">New</span>
                </button>
            </div>
            <p className="text-xs text-center text-gray-500 mb-2">
                {scaleInfo ? `Scale: ${measurementService.formatLength(scaleInfo.knownLength)} = ${scaleInfo.linePixels.toFixed(2)}px` : "Scale not set"}
            </p>

            <div className="mb-4 p-3 bg-gray-100 rounded-lg border">
                <form onSubmit={handleAddGroup} className="space-y-2">
                    <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="New group name..." className="w-full text-sm p-2 border border-gray-300 rounded-md"/>
                    <div className="flex space-x-2">
                        <select value={newGroupParentId} onChange={(e) => setNewGroupParentId(e.target.value)} className="flex-grow w-full text-sm p-2 border border-gray-300 rounded-md bg-white">
                            <option value="none">-- Top Level --</option>
                            {renderGroupOptions(null)}
                        </select>
                        <button type="submit" className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm font-semibold">Add</button>
                    </div>
                </form>
            </div>
            
            <div className="space-y-1 max-h-60 overflow-y-auto" onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, null)} onDragEnter={(e) => { e.preventDefault(); setDropTarget({ id: null, type: 'root' }); }}>
                {measurements.length === 0 && (measurementGroups || []).length === 0 && <p className="text-xs text-center text-gray-500 py-2">No measurements taken.</p>}
                {renderMeasurementGroupTree(null)}
                {ungroupedMeasurements.length > 0 && (
                    <>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider pt-2">Ungrouped</h3>
                        {renderMeasurementList(ungroupedMeasurements)}
                    </>
                )}
            </div>
        </div>
    );
};

const DaliNetworkCard: React.FC<{
    network: DaliNetwork;
    devices: DaliDevice[];
    ecdTypes: EcdType[];
    onUpdateDaliNetwork: (id: string, updates: Partial<DaliNetwork>) => void;
    onDeleteDaliNetwork: (id: string) => void;
    onStartDaliPlacement: (networkId: string, deviceType: DaliDeviceType) => void;
    onHoverStart: () => void;
    onHoverEnd: () => void;
    onStartPlacePsu: (networkId: string) => void;
    onDeletePsu: (networkId: string) => void;
    onRenumberDaliNetwork: (networkId: string) => void;
    onSaveDaliNetworkAsTemplate: (networkId: string) => void;
}> = (props) => {
    const { 
        network, devices, ecdTypes, onUpdateDaliNetwork, onDeleteDaliNetwork, 
        onStartDaliPlacement, onHoverStart, onHoverEnd, onStartPlacePsu, onDeletePsu,
        onRenumberDaliNetwork, onSaveDaliNetworkAsTemplate
    } = props;
    const [editingNetworkName, setEditingNetworkName] = useState(network.name);
    const [isEditingName, setIsEditingName] = useState(false);
    const [capacity, setCapacity] = useState(network.powerSupplyCapacity ?? 250);

    useEffect(() => {
        setCapacity(network.powerSupplyCapacity ?? 250);
        if (!isEditingName) {
            setEditingNetworkName(network.name);
        }
    }, [network, isEditingName]);

    const handleNameUpdate = () => {
        if (editingNetworkName.trim() && editingNetworkName.trim() !== network.name) {
            onUpdateDaliNetwork(network.id, { name: editingNetworkName.trim() });
        }
        setIsEditingName(false);
    };

    const handleCapacityBlur = () => {
        const value = parseInt(String(capacity), 10);
        onUpdateDaliNetwork(network.id, { powerSupplyCapacity: isNaN(value) ? 250 : value });
    };
    
    const ECG_CONSUMPTION_MA = 2;
    const DEFAULT_ECD_CONSUMPTION_MA = 6;
    const ecgCount = devices.filter(d => d.networkId === network.id && d.type === 'ECG').length;
    const ecdDevices = devices.filter(d => d.networkId === network.id && d.type === 'ECD');
    const ecdCount = ecdDevices.length;
    const ecdTypesMap = new Map((ecdTypes || []).map(t => [t.id, t]));

    const ecgConsumption = ecgCount * ECG_CONSUMPTION_MA;
    const ecdConsumption = ecdDevices.reduce((sum, device) => {
        if (device.ecdTypeId) {
            const type = ecdTypesMap.get(device.ecdTypeId);
            return sum + (type ? type.busCurrent : 0);
        }
        return sum + DEFAULT_ECD_CONSUMPTION_MA;
    }, 0);

    const totalConsumption = ecgConsumption + ecdConsumption;
    const loadPercentage = capacity > 0 ? (totalConsumption / capacity) * 100 : 0;
    const isOverloaded = totalConsumption > capacity;
    const loadColor = isOverloaded ? 'bg-red-500' : loadPercentage > 90 ? 'bg-red-500' : loadPercentage > 75 ? 'bg-yellow-400' : 'bg-green-500';

    const ecgLimitExceeded = ecgCount > 55;
    const ecdLimitExceeded = ecdCount > 20;

    const psuExists = !!network.psuLocation;

    return (
         <div 
            className="group p-2.5 rounded-lg bg-white border border-gray-200 shadow-sm"
            onMouseEnter={onHoverStart}
            onMouseLeave={onHoverEnd}
        >
            <div className="flex items-center justify-between">
                {isEditingName ? (
                     <input
                        type="text"
                        value={editingNetworkName}
                        onChange={(e) => setEditingNetworkName(e.target.value)}
                        onBlur={handleNameUpdate}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleNameUpdate(); if (e.key === 'Escape') setIsEditingName(false); }}
                        onClick={e => e.stopPropagation()}
                        autoFocus
                        className="font-bold text-gray-800 bg-white border-b-2 border-blue-500 focus:outline-none flex-grow"
                    />
                ) : (
                    <div className="flex items-center space-x-2">
                        {!psuExists && <span title="Power Supply Unit not placed for this network"><WarningIcon className="text-yellow-500" /></span>}
                        <span className="font-bold text-gray-800">{network.name}</span>
                    </div>
                )}
                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onSaveDaliNetworkAsTemplate(network.id)} className="p-1 text-gray-400 hover:text-blue-500" title="Save as Template"><SaveIcon /></button>
                    <button onClick={() => onRenumberDaliNetwork(network.id)} className="p-1 text-gray-400 hover:text-blue-500" title="Renumber Network"><RenumberIcon /></button>
                    <button onClick={() => setIsEditingName(true)} className="p-1 text-gray-400 hover:text-blue-500" title="Rename Network"><EditIcon /></button>
                    <button onClick={() => onUpdateDaliNetwork(network.id, { isVisible: !network.isVisible })} className="p-1 text-gray-400 hover:text-blue-500" title={network.isVisible ? 'Hide' : 'Show'}>{network.isVisible ? <EyeIcon /> : <EyeOffIcon />}</button>
                    <button onClick={() => { if(window.confirm(`Delete network ${network.name} and all its devices?`)) onDeleteDaliNetwork(network.id) }} className="p-1 text-gray-400 hover:text-red-500" title="Delete Network"><TrashIcon /></button>
                </div>
            </div>
            
            <div className="mt-3 text-xs space-y-2">
                <div className="p-2 rounded-md bg-gray-50">
                    <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-gray-600">Bus Power</span>
                        <span className={`font-bold ${isOverloaded ? 'text-red-700' : 'text-gray-800'}`}>
                            {totalConsumption.toFixed(1)} / {capacity} mA
                        </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                            className={`h-2.5 rounded-full ${loadColor}`}
                            style={{ width: `${Math.min(loadPercentage, 100)}%` }}
                        ></div>
                    </div>
                    {isOverloaded && <p className="text-red-600 mt-1 text-center font-semibold">Power supply capacity exceeded!</p>}
                </div>
                <div className={`p-2 rounded-md ${ecgLimitExceeded ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                   <div className="flex justify-between items-center">
                       <span className={`font-medium ${ecgLimitExceeded ? 'text-red-700' : 'text-gray-600'}`}>ECG (Gear)</span>
                       <span className={`font-bold ${ecgLimitExceeded ? 'text-red-700' : 'text-gray-800'}`}>{ecgCount} / {network.ecgLimit}</span>
                   </div>
                    {ecgLimitExceeded && <p className="text-red-600 mt-1 text-center">Recommended limit (55) exceeded.</p>}
                </div>
                <div className={`p-2 rounded-md ${ecdLimitExceeded ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                   <div className="flex justify-between items-center">
                       <span className={`font-medium ${ecdLimitExceeded ? 'text-red-700' : 'text-gray-600'}`}>ECD (Control)</span>
                       <span className={`font-bold ${ecdLimitExceeded ? 'text-red-700' : 'text-gray-800'}`}>{ecdCount} / {network.ecdLimit}</span>
                   </div>
                   {ecdLimitExceeded && <p className="text-red-600 mt-1 text-center">Recommended limit (20) exceeded.</p>}
                </div>
            </div>

             <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                    <label className="font-medium text-gray-600 block mb-1">PSU (mA)</label>
                    <input 
                        type="number"
                        value={capacity}
                        onChange={e => setCapacity(parseInt(e.target.value) || 0)}
                        onBlur={handleCapacityBlur}
                        className="w-full p-1.5 border border-gray-300 rounded-md"
                    />
                </div>
                <div>
                    <label className="font-medium text-gray-600 block mb-1">Default ECD</label>
                    <select
                        value={network.defaultEcdTypeId || ''}
                        onChange={e => onUpdateDaliNetwork(network.id, { defaultEcdTypeId: e.target.value || null })}
                        className="w-full p-1.5 border border-gray-300 rounded-md bg-white"
                        title="Set default ECD type for new devices"
                    >
                        <option value="">None</option>
                        {ecdTypes.map(type => (
                            <option key={type.id} value={type.id}>
                                {type.reference} ({type.busCurrent}mA)
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            
            <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="flex items-stretch gap-1 col-span-2 sm:col-span-1">
                    <button onClick={() => onStartPlacePsu(network.id)} className="text-sm w-full py-1.5 rounded-md font-semibold transition flex items-center justify-center grow bg-indigo-100 text-indigo-800 hover:bg-indigo-200" title={psuExists ? 'Move PSU' : 'Place PSU'}>
                        <PsuIcon />
                        <span className="ml-1.5">{psuExists ? 'Move' : 'Place'} PSU</span>
                    </button>
                    {psuExists && (
                        <button onClick={() => onDeletePsu(network.id)} className="text-sm p-2 rounded-md font-semibold transition flex items-center justify-center bg-red-100 text-red-800 hover:bg-red-200 flex-shrink-0" title="Delete PSU">
                            <TrashIcon className="h-4 w-4" />
                        </button>
                    )}
                </div>
                <button onClick={() => onStartDaliPlacement(network.id, 'ECG')} className="text-sm w-full py-1.5 bg-orange-100 text-orange-800 rounded-md hover:bg-orange-200 font-semibold transition">Add ECG</button>
                <button onClick={() => onStartDaliPlacement(network.id, 'ECD')} className="text-sm w-full py-1.5 bg-cyan-100 text-cyan-800 rounded-md hover:bg-cyan-200 font-semibold transition sm:col-start-2">Add ECD</button>
            </div>
        </div>
    );
};

const DaliManager: React.FC<{
    networks: DaliNetwork[];
    devices: DaliDevice[];
    ecdTypes: EcdType[];
    daliNetworkTemplates: DaliNetworkTemplate[];
    activePdfId: string | null;
    currentPage: number;
    onAddDaliNetwork: (templateId?: string) => void;
    onUpdateDaliNetwork: (id: string, updates: Partial<DaliNetwork>) => void;
    onDeleteDaliNetwork: (id: string) => void;
    onStartDaliPlacement: (networkId: string, deviceType: DaliDeviceType) => void;
    onExportDaliPdfReport: () => void;
    isExportingDaliPdf: boolean;
    mode: string;
    onOpenEcdSchedule: () => void;
    onDaliNetworkHover: (networkId: string | null) => void;
    onStartDaliPaintSelection: () => void;
    showDaliLabels: boolean;
    onToggleDaliLabels: () => void;
    onStartPlacePsu: (networkId: string) => void;
    onDeletePsu: (networkId: string) => void;
    onRenumberDaliNetwork: (networkId: string) => void;
    onSaveDaliNetworkAsTemplate: (networkId: string) => void;
}> = (props) => {
    const { 
        networks, devices, ecdTypes, daliNetworkTemplates, onAddDaliNetwork, onUpdateDaliNetwork, onDeleteDaliNetwork, 
        onStartDaliPlacement, onExportDaliPdfReport, isExportingDaliPdf, activePdfId, 
        currentPage, mode, onOpenEcdSchedule, onDaliNetworkHover, onStartDaliPaintSelection,
        showDaliLabels, onToggleDaliLabels, onStartPlacePsu, onDeletePsu,
        onRenumberDaliNetwork, onSaveDaliNetworkAsTemplate
    } = props;
    
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
    const addMenuRef = useRef<HTMLDivElement>(null);
    const sortedNetworks = [...networks].sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const devicesOnPage = devices.filter(d => d.pdfId === activePdfId && d.page === currentPage);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
                setIsAddMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="p-3 bg-gray-50 rounded-lg border">
            <div className="grid grid-cols-1 gap-2 mb-3">
                 <button
                    onClick={onOpenEcdSchedule}
                    disabled={mode !== 'idle'}
                    className="w-full flex items-center justify-center px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all shadow disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    <EditIcon className="h-5 w-5" />
                    <span className="ml-2 font-semibold">Manage ECD Schedule</span>
                </button>
                <div className="relative" ref={addMenuRef}>
                    <button
                        onClick={() => setIsAddMenuOpen(prev => !prev)}
                        disabled={mode !== 'idle'}
                        className="w-full flex items-center justify-center px-4 py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-all shadow disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        <AddIcon />
                        <span className="ml-2 font-semibold">Add DALI Network</span>
                        <ChevronDownIcon className="ml-auto h-5 w-5"/>
                    </button>
                    {isAddMenuOpen && (
                        <div className="absolute z-10 top-full mt-1 w-full bg-white rounded-md shadow-lg border">
                           <button
                                onClick={() => { onAddDaliNetwork(); setIsAddMenuOpen(false); }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                                New Blank Network
                            </button>
                            {(daliNetworkTemplates || []).length > 0 && <div className="border-t my-1"></div>}
                            {(daliNetworkTemplates || []).map(template => (
                                <button
                                    key={template.id}
                                    onClick={() => { onAddDaliNetwork(template.id); setIsAddMenuOpen(false); }}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                    From: {template.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={onStartDaliPaintSelection}
                        disabled={mode !== 'idle'}
                        className="w-full flex items-center justify-center px-4 py-2.5 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition-all shadow disabled:bg-gray-400 disabled:cursor-not-allowed"
                        title="Device Painter (P)"
                    >
                        <PaintBrushIcon />
                        <span className="ml-2 font-semibold text-sm">Painter</span>
                    </button>
                    <button
                        onClick={onToggleDaliLabels}
                        disabled={mode !== 'idle'}
                        className="w-full flex items-center justify-center px-4 py-2.5 bg-slate-500 text-white rounded-lg hover:bg-slate-600 transition-all shadow disabled:bg-gray-400 disabled:cursor-not-allowed"
                        title={showDaliLabels ? "Hide All Labels" : "Show All Labels"}
                    >
                        {showDaliLabels ? <TextOffIcon /> : <TextIcon />}
                        <span className="ml-2 font-semibold text-sm">{showDaliLabels ? "Hide Labels" : "Show Labels"}</span>
                    </button>
                </div>
                 <button
                    onClick={onExportDaliPdfReport}
                    disabled={mode !== 'idle' || isExportingDaliPdf || devicesOnPage.length === 0}
                    className="w-full flex items-center justify-center px-4 py-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-all shadow disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    {isExportingDaliPdf ? <LoadingIcon className="h-5 w-5" /> : <PdfFileIcon />}
                    <span className="ml-2 font-semibold">Export DALI PDF</span>
                </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
                {sortedNetworks.map(network => (
                    <DaliNetworkCard
                        key={network.id}
                        network={network}
                        devices={devices}
                        ecdTypes={ecdTypes}
                        onUpdateDaliNetwork={onUpdateDaliNetwork}
                        onDeleteDaliNetwork={onDeleteDaliNetwork}
                        onStartDaliPlacement={onStartDaliPlacement}
                        onHoverStart={() => onDaliNetworkHover(network.id)}
                        onHoverEnd={() => onDaliNetworkHover(null)}
                        onStartPlacePsu={onStartPlacePsu}
                        onDeletePsu={onDeletePsu}
                        onRenumberDaliNetwork={onRenumberDaliNetwork}
                        onSaveDaliNetworkAsTemplate={onSaveDaliNetworkAsTemplate}
                    />
                ))}
                 {networks.length === 0 && <p className="text-xs text-center text-gray-500 py-2">No DALI networks created.</p>}
            </div>
        </div>
    );
};


export const Sidebar: React.FC<SidebarProps> = (props) => {
    const { activeProject, activePdfId, measurements, mode, scaleInfo, pdfOpacity, onPdfOpacityChange, currentPage, onExportDaliPdfReport, isExportingDaliPdf } = props;
    const areasForActivePdf = activeProject.areas.filter(a => a.pdfId === activePdfId);

    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(['symbols', 'measurements', 'areas', 'dali', 'viewerSettings']));
    
    const toggleSection = (sectionId: string) => {
        setCollapsedSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sectionId)) {
                newSet.delete(sectionId);
            } else {
                newSet.add(sectionId);
            }
            return newSet;
        });
    };

    return (
        <aside className="w-96 bg-white h-full flex flex-col p-4 border-r border-gray-200 shadow-md">
            <div className="mb-4">
                 <ProjectsDropdown
                    projects={props.projects}
                    activeProject={props.activeProject}
                    onSwitchProject={props.onSwitchProject}
                    onCreateNew={props.onCreateNewProject}
                    onDeleteProject={props.onDeleteProject}
                    onLogout={props.onLogout}
                    onBackupAll={props.onBackupAll}
                    onBackupSingleProject={props.onBackupSingleProject}
                    onRestoreAll={props.onRestoreAll}
                 />
            </div>
            
             <div className="flex-grow overflow-y-auto -mr-2 pr-2">
                <div className="border-b border-gray-200 pb-2 mb-2">
                    <button onClick={() => toggleSection('documents')} className="w-full flex justify-between items-center py-1 text-lg font-semibold text-gray-800 hover:bg-gray-50 rounded-md px-2">
                        <span>Documents</span>
                        <ChevronDownIcon className={`h-5 w-5 transition-transform ${collapsedSections.has('documents') ? '-rotate-90' : ''}`} />
                    </button>
                    {!collapsedSections.has('documents') && (
                        <div className="pt-2 px-1">
                            <PdfSwitcher
                                pdfs={activeProject.pdfs}
                                activePdfId={activePdfId}
                                onSwitchPdf={props.onSwitchPdf}
                                onAddPdfs={props.onAddPdfs}
                                onUpdatePdfLevel={props.onUpdatePdfLevel}
                                onDeletePdf={props.onDeletePdf}
                            />
                        </div>
                    )}
                </div>

                <div className="border-b border-gray-200 pb-2 mb-2">
                    <button onClick={() => toggleSection('viewerSettings')} className="w-full flex justify-between items-center py-1 text-lg font-semibold text-gray-800 hover:bg-gray-50 rounded-md px-2">
                        <span>Viewer Settings</span>
                        <ChevronDownIcon className={`h-5 w-5 transition-transform ${collapsedSections.has('viewerSettings') ? '-rotate-90' : ''}`} />
                    </button>
                    {!collapsedSections.has('viewerSettings') && (
                        <div className="pt-2 px-1">
                            <div className="p-3 bg-gray-50 rounded-lg border">
                                <label htmlFor="pdf-opacity-slider" className="flex justify-between text-sm font-medium text-gray-700 mb-2">
                                    <span>PDF Background Opacity</span>
                                    <span>{Math.round(pdfOpacity * 100)}%</span>
                                </label>
                                <input
                                    id="pdf-opacity-slider"
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={pdfOpacity}
                                    onChange={(e) => onPdfOpacityChange(parseFloat(e.target.value))}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                            </div>
                        </div>
                    )}
                </div>

                 <div className="border-b border-gray-200 pb-2 mb-2">
                    <button onClick={() => toggleSection('dali')} className="w-full flex justify-between items-center py-1 text-lg font-semibold text-gray-800 hover:bg-gray-50 rounded-md px-2">
                        <span>DALI Networks</span>
                        <ChevronDownIcon className={`h-5 w-5 transition-transform ${collapsedSections.has('dali') ? '-rotate-90' : ''}`} />
                    </button>
                    {!collapsedSections.has('dali') && (
                        <div className="pt-2 px-1">
                            <DaliManager
                                networks={props.activeProject.daliNetworks || []}
                                devices={props.activeProject.daliDevices || []}
                                ecdTypes={props.activeProject.ecdTypes || []}
                                daliNetworkTemplates={props.activeProject.daliNetworkTemplates || []}
                                onAddDaliNetwork={props.onAddDaliNetwork}
                                onUpdateDaliNetwork={props.onUpdateDaliNetwork}
                                onDeleteDaliNetwork={props.onDeleteDaliNetwork}
                                onStartDaliPlacement={props.onStartDaliPlacement}
                                onExportDaliPdfReport={onExportDaliPdfReport}
                                isExportingDaliPdf={isExportingDaliPdf}
                                activePdfId={activePdfId}
                                currentPage={currentPage}
                                mode={props.mode}
                                onOpenEcdSchedule={props.onOpenEcdSchedule}
                                onDaliNetworkHover={props.onDaliNetworkHover}
                                onStartDaliPaintSelection={props.onStartDaliPaintSelection}
                                showDaliLabels={props.showDaliLabels}
                                onToggleDaliLabels={props.onToggleDaliLabels}
                                onStartPlacePsu={props.onStartPlacePsu}
                                onDeletePsu={props.onDeletePsu}
                                onRenumberDaliNetwork={props.onRenumberDaliNetwork}
                                onSaveDaliNetworkAsTemplate={props.onSaveDaliNetworkAsTemplate}
                            />
                        </div>
                    )}
                </div>


                <div className="border-b border-gray-200 pb-2 mb-2">
                    <button onClick={() => toggleSection('measurements')} className="w-full flex justify-between items-center py-1 text-lg font-semibold text-gray-800 hover:bg-gray-50 rounded-md px-2">
                        <span>Measurements</span>
                        <ChevronDownIcon className={`h-5 w-5 transition-transform ${collapsedSections.has('measurements') ? '-rotate-90' : ''}`} />
                    </button>
                    {!collapsedSections.has('measurements') && (
                        <div className="pt-2 px-1">
                            <MeasurementManager
                                measurements={measurements}
                                measurementGroups={props.activeProject.measurementGroups || []}
                                scaleInfo={scaleInfo}
                                onStartSetScale={props.onStartSetScale}
                                onStartMeasure={props.onStartMeasure}
                                onStartAddToMeasurement={props.onStartAddToMeasurement}
                                onUpdateMeasurement={props.onUpdateMeasurement}
                                onDeleteMeasurement={props.onDeleteMeasurement}
                                mode={mode}
                                selectedMeasurementId={props.selectedMeasurementId}
                                onSelectMeasurement={props.onSelectMeasurement}
                                onOpenManualLengthModal={props.onOpenManualLengthModal}
                                onDeleteManualEntry={props.onDeleteManualEntry}
                                onAddMeasurementGroup={props.onAddMeasurementGroup}
                                onUpdateMeasurementGroupName={props.onUpdateMeasurementGroupName}
                                onDeleteMeasurementGroup={props.onDeleteMeasurementGroup}
                                onAssignMeasurementToGroup={props.onAssignMeasurementToGroup}
                                onUpdateMeasurementGroupParent={props.onUpdateMeasurementGroupParent}
                            />
                        </div>
                    )}
                </div>

                <div className="border-b border-gray-200 pb-2 mb-2">
                    <button onClick={() => toggleSection('areas')} className="w-full flex justify-between items-center py-1 text-lg font-semibold text-gray-800 hover:bg-gray-50 rounded-md px-2">
                        <span>Areas</span>
                        <ChevronDownIcon className={`h-5 w-5 transition-transform ${collapsedSections.has('areas') ? '-rotate-90' : ''}`} />
                    </button>
                    {!collapsedSections.has('areas') && (
                        <div className="pt-2 px-1">
                            <AreaManager 
                                areas={areasForActivePdf}
                                onStartAreaDrawing={props.onStartAreaDrawing}
                                onDeleteArea={props.onDeleteArea}
                                onUpdateArea={props.onUpdateArea}
                                mode={mode}
                            />
                        </div>
                    )}
                </div>

                <div className="pb-2 mb-2">
                    <button onClick={() => toggleSection('symbols')} className="w-full flex justify-between items-center py-1 text-lg font-semibold text-gray-800 hover:bg-gray-50 rounded-md px-2">
                        <span>Symbols & Disciplines</span>
                        <ChevronDownIcon className={`h-5 w-5 transition-transform ${collapsedSections.has('symbols') ? '-rotate-90' : ''}`} />
                    </button>
                    {!collapsedSections.has('symbols') && (
                         <SymbolsAndDisciplinesManager
                            activeProject={props.activeProject}
                            activePdfId={props.activePdfId}
                            onStartManualSelection={props.onStartManualSelection}
                            onExportExcel={props.onExportExcel}
                            onExportPdfReport={props.onExportPdfReport}
                            onViewCounts={props.onViewCounts}
                            isExporting={props.isExporting}
                            isExportingPdf={props.isExportingPdf}
                            isLoading={props.isLoading}
                            mode={props.mode}
                            onSymbolNameChange={props.onSymbolNameChange}
                            onSymbolColorChange={props.onSymbolColorChange}
                            onSymbolImageChange={props.onSymbolImageChange}
                            onSymbolDelete={props.onSymbolDelete}
                            onAddPoints={props.onAddPoints}
                            onOpenCopyModal={props.onOpenCopyModal}
                            activeSymbolId={props.activeSymbolId}
                            setActiveSymbolId={props.setActiveSymbolId}
                            onAddDiscipline={props.onAddDiscipline}
                            onUpdateDisciplineName={props.onUpdateDisciplineName}
                            onAssignDiscipline={props.onAssignDiscipline}
                            activeDisciplineId={props.activeDisciplineId}
                            setActiveDisciplineId={props.setActiveDisciplineId}
                            onDeleteDiscipline={props.onDeleteDiscipline}
                            onUpdateDisciplineParent={props.onUpdateDisciplineParent}
                            measurements={props.measurements}
                         />
                    )}
                </div>
            </div>
            
            <div className="mt-auto pt-4 border-t border-gray-200 text-center">
                <p className="text-xs text-gray-400">Smart Count v{Version_Number}</p>
            </div>
        </aside>
    );
};

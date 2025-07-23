

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { PdfViewer } from './components/PdfViewer';
import { exportExcelWithSchedule } from './services/excelExportService';
import { projectService } from './services/projectService';
import type { SymbolInfo, Location, Discipline, Project, PdfFile, Area, LinearMeasurement, ScaleInfo, ManualEntry, MeasurementGroup, DaliNetwork, DaliDevice, DaliDeviceType, EcdType, DaliNetworkTemplate, PsuLocation } from './types';
import { ProjectScreen } from './components/ProjectScreen';
import { CopySymbolModal } from './components/CopySymbolModal';
import { AddPdfsModal } from './components/AddPdfsModal';
import { AuthScreen } from './components/AuthScreen';
import { authService } from './services/authService';
import { ExportExcelModal } from './components/ExportExcelModal';
import { ExportPdfModal } from './components/ExportPdfModal';
import { ReassignSymbolModal } from './components/ReassignSymbolModal';
import { AreaNamingModal } from './components/AreaNamingModal';
import { CountsTableModal } from './components/CountsTableModal';
import { ScaleModal } from './components/ScaleModal';
import { ManualLengthModal } from './components/ManualLengthModal';
import { LinearComponentModal } from './components/LinearComponentModal';
import { exportMarkedUpPdf, exportDaliPdf } from './services/pdfExportService';
import { LINEAR_DISCIPLINE_NAME } from './constants';
import { EcdTypeAssignModal } from './components/EcdTypeAssignModal';
import { EcdScheduleModal } from './components/EcdScheduleModal';
import { PsuLocationModal } from './components/PsuLocationModal';


const PIN_SIZE = 8; // base size in unscaled units for location pins

const App: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<string | null>(() => authService.getCurrentUser());
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
    const [activePdfId, setActivePdfId] = useState<string | null>(null);
    const [activePdfData, setActivePdfData] = useState<string | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeSymbolId, setActiveSymbolId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [activeDisciplineId, setActiveDisciplineId] = useState<string | null>(null);
    
    const [mode, setMode] = useState<'idle' | 'selecting_manual' | 'placing_dots' | 'drawing_area' | 'setting_scale' | 'drawing_measurement' | 'placing_dali_device' | 'selecting_dali_painter_source' | 'painting_dali_device' | 'placing_dali_psu' | 'painting_dali_psu_location'>('idle');
    const [symbolToCopy, setSymbolToCopy] = useState<SymbolInfo | null>(null);
    const [pinToReassign, setPinToReassign] = useState<{ symbolId: string; locationIndex: number } | null>(null);
    const [filesToAdd, setFilesToAdd] = useState<File[] | null>(null);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isExportPdfModalOpen, setIsExportPdfModalOpen] = useState(false);
    const [isNamingArea, setIsNamingArea] = useState(false);
    const [drawingPoints, setDrawingPoints] = useState<{x: number, y: number}[]>([]);
    const [isCountsTableOpen, setIsCountsTableOpen] = useState(false);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [isExportingDaliPdf, setIsExportingDaliPdf] = useState(false);

    // Measurement State
    const [isScaleModalOpen, setIsScaleModalOpen] = useState(false);
    const [scaleCalibrationLine, setScaleCalibrationLine] = useState<{x: number, y: number}[] | null>(null);
    const [activeDrawingMeasurementId, setActiveDrawingMeasurementId] = useState<string | null>(null);
    const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);
    const [editingManualEntry, setEditingManualEntry] = useState<{measurementId: string; segmentIndex: number; pointIndex: number; entryId?: string;} | null>(null);
    const [isLinearComponentModalOpen, setIsLinearComponentModalOpen] = useState(false);
    const [linearComponentCreationPoint, setLinearComponentCreationPoint] = useState<{x:number, y:number} | null>(null);
    const [draggedMeasurementNode, setDraggedMeasurementNode] = useState<{
        measurementId: string;
        segmentIndex: number;
        pointIndex: number;
    } | null>(null);
    const [pdfOpacity, setPdfOpacity] = useState(1);
    
    // DALI State
    const [activeDaliPlacement, setActiveDaliPlacement] = useState<{ networkId: string; deviceType: DaliDeviceType } | null>(null);
    const [editingEcdDevice, setEditingEcdDevice] = useState<DaliDevice | null>(null);
    const [isEcdScheduleModalOpen, setIsEcdScheduleModalOpen] = useState(false);
    const [hoveredDaliNetworkId, setHoveredDaliNetworkId] = useState<string | null>(null);
    const [daliDeviceToPaint, setDaliDeviceToPaint] = useState<{
        networkId: string;
        deviceType: DaliDeviceType;
        ecdTypeId?: string;
    } | null>(null);
    const [daliPsuLocationToPaint, setDaliPsuLocationToPaint] = useState<string | null>(null);
    const [showDaliLabels, setShowDaliLabels] = useState(true);
    const [activeDaliPsuPlacementNetworkId, setActiveDaliPsuPlacementNetworkId] = useState<string | null>(null);
    const [editingPsuNetwork, setEditingPsuNetwork] = useState<DaliNetwork | null>(null);

    // Undo/Redo State
    const [undoStack, setUndoStack] = useState<Project[]>([]);
    const [redoStack, setRedoStack] = useState<Project[]>([]);

    // Add error handling state and methods
    const [apiError, setApiError] = useState<string | null>(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const handleApiError = (error: Error) => {
        console.error('API Error:', error);
        setApiError(error.message);
        setTimeout(() => setApiError(null), 5000); // Clear after 5 seconds
    };

    const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId), [projects, activeProjectId]);
    const activePdfMetadata = useMemo(() => activeProject?.pdfs.find(p => p.id === activePdfId), [activeProject, activePdfId]);

    const commitUpdate = (newProjectState: Project, fromUndoRedo: boolean = false) => {
        if (!fromUndoRedo && activeProject) {
            setUndoStack(prev => [...prev.slice(-29), activeProject]); // Keep last 30 states
            setRedoStack([]);
        }
        setProjects(prev => prev.map(p => (p.id === newProjectState.id ? newProjectState : p)));
    };

    const handleUndo = useCallback(() => {
        if (undoStack.length === 0) return;

        const newUndoStack = [...undoStack];
        const lastState = newUndoStack.pop();

        if (lastState && activeProject) {
            setRedoStack(prev => [...prev, activeProject]);
            commitUpdate(lastState, true);
            setUndoStack(newUndoStack);
        }
    }, [undoStack, activeProject]);

    const handleRedo = useCallback(() => {
        if (redoStack.length === 0) return;

        const newRedoStack = [...redoStack];
        const nextState = newRedoStack.pop();

        if (nextState && activeProject) {
            setUndoStack(prev => [...prev, activeProject]);
            commitUpdate(nextState, true);
            setRedoStack(newRedoStack);
        }
    }, [redoStack, activeProject]);
    
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

            // Shortcuts for when an action is in progress (e.g., drawing)
            if (mode !== 'idle') {
                if (e.key === 'Enter' || e.key === 'Escape') {
                    e.preventDefault();
                    if (mode === 'drawing_area' && drawingPoints.length > 2 && e.key === 'Enter') {
                        handleFinishAreaDrawing();
                    } else if (mode === 'setting_scale' && drawingPoints.length >= 2 && e.key === 'Enter') {
                        handleFinishScaleLine();
                    } else if (mode === 'drawing_measurement' && drawingPoints.length >= 2 && e.key === 'Enter') {
                        handleSaveMeasurement();
                    } else {
                        // General cancel/finish action
                        setMode('idle');
                        setDrawingPoints([]);
                        setActiveDrawingMeasurementId(null);
                        setActiveDaliPlacement(null);
                        setDaliDeviceToPaint(null);
                        setActiveDaliPsuPlacementNetworkId(null);
                        setDaliPsuLocationToPaint(null);
                    }
                }
                return; // Don't process other shortcuts while in a specific mode
            }

            // Shortcuts for when the app is 'idle'
            if (!isInputFocused) {
                // Undo/Redo
                if (e.ctrlKey || e.metaKey) {
                    if (e.key.toLowerCase() === 'z') {
                        e.preventDefault();
                        if (e.shiftKey) {
                            handleRedo();
                        } else {
                            handleUndo();
                        }
                    }
                    if (e.key.toLowerCase() === 'y') {
                        e.preventDefault();
                        handleRedo();
                    }
                }

                // DALI Device Painter shortcut
                if (e.key.toLowerCase() === 'p') {
                    e.preventDefault();
                    handleStartDaliPaintSelection();
                }
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [mode, drawingPoints, handleUndo, handleRedo]);


    useEffect(() => {
        if (!currentUser) {
            setActiveProjectId(null);
            setActivePdfId(null);
            setProjects([]);
        } else {
            setIsLoading(true);
            setProjects(projectService.getProjects(currentUser));
            setIsLoading(false);
        }
    }, [currentUser]);

    // Fetch PDF data from IndexedDB when active PDF changes
    useEffect(() => {
        const loadPdfData = async () => {
            if (!activePdfId || !activeProject) {
                setActivePdfData(null);
                return;
            }

            try {
                setIsLoading(true);
                const pdfData = await projectService.getPdfData(activePdfId);
                setActivePdfData(`data:application/pdf;base64,${pdfData}`);
            } catch (error) {
                console.error('Failed to load PDF data:', error);
                handleApiError(error as Error);
                setActivePdfData(null);
            } finally {
                setIsLoading(false);
            }
        };

        loadPdfData();
    }, [activePdfId, activeProject]);

    useEffect(() => {
        if (activeProject && currentUser) {
            projectService.saveProject(currentUser, activeProject);
        }
    }, [activeProject, currentUser]);

    const handleLoginSuccess = async (email: string) => {
        try {
            setCurrentUser(email);
            // Load projects after login
            const userProjects = await projectService.getProjects(email);
            setProjects(userProjects);
        } catch (error) {
            handleApiError(error as Error);
        }
    };

    const handleLogout = () => {
        authService.logout();
        setCurrentUser(null);
    };

    const handleCreateProject = async (name: string, filesWithLevels: { file: File, level: string }[], templateId: string | null) => {
        if (!currentUser) return;
        
        try {
            setIsLoading(true);
            const newProject = await projectService.createProject(currentUser, name, filesWithLevels, templateId);
            setProjects(prev => [...prev, newProject]);
            setActiveProjectId(newProject.id);
            setActivePdfId(newProject.pdfs[0]?.id || null);
            setUndoStack([]);
            setRedoStack([]);
        } catch (error) {
            handleApiError(error as Error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoadProject = (id: string) => {
        const projectToLoad = projects.find(p => p.id === id);
        if (!projectToLoad) return;
        setActiveProjectId(id);
        setActivePdfId(projectToLoad.pdfs[0]?.id || null);
        setMode('idle');
        setActiveSymbolId(null);
        setActiveDisciplineId(null);
        setActiveDaliPlacement(null);
        setCurrentPage(1);
        setError(null);
        setUndoStack([]);
        setRedoStack([]);
    };

    const handleDeleteProject = async (id: string) => {
        if (!currentUser) return;
        await projectService.deleteProject(currentUser, id);
        setProjects(prev => prev.filter(p => p.id !== id));
        if (activeProjectId === id) {
            setActiveProjectId(null);
            setActivePdfId(null);
        }
    };
    
    const handleSwitchPdf = (pdfId: string) => {
        setActivePdfId(pdfId);
        setCurrentPage(1);
        setActiveSymbolId(null);
        setActiveDisciplineId(null);
        setActiveDaliPlacement(null);
        setMode('idle');
    };
    
    const handleAddPdfs = async (files: File[]) => {
        if (!activeProject || !currentUser || files.length === 0) return;
        setFilesToAdd(files);
    };

    const handleConfirmAddPdfs = async (filesWithLevels: { file: File; level: string }[]) => {
        if (!activeProject || !currentUser) return;

        const updatedProject = await projectService.addPdfsToProject(currentUser, activeProject, filesWithLevels);
        
        commitUpdate(updatedProject);

        const lastAddedPdf = updatedProject.pdfs[updatedProject.pdfs.length - 1];
        if (lastAddedPdf) {
            handleSwitchPdf(lastAddedPdf.id);
        }
        setFilesToAdd(null); // Close modal
    };
    
    const handleUpdatePdfLevel = (pdfId: string, newLevel: string) => {
        if (!activeProject) return;
        const newProject = {
            ...activeProject,
            pdfs: activeProject.pdfs.map(p => {
                if (p.id === pdfId) {
                    return { ...p, level: newLevel };
                }
                return p;
            })
        };
        commitUpdate(newProject);
    };

    const handleDeletePdf = async (pdfId: string) => {
        if (!activeProject || !currentUser) return;
        if (!window.confirm("Are you sure you want to delete this document and all of its associated symbols and areas? This action cannot be undone.")) {
            return;
        }
    
        setIsLoading(true);
        try {
            const updatedProject = await projectService.deletePdfFromProject(currentUser, activeProject.id, pdfId);
    
            if (updatedProject) {
                commitUpdate(updatedProject);
    
                if (activePdfId === pdfId) {
                    if (updatedProject.pdfs.length > 0) {
                        handleSwitchPdf(updatedProject.pdfs[0].id);
                    } else {
                        setActivePdfId(null);
                    }
                }
            }
        } catch (err) {
            console.error("Failed to delete PDF:", err);
            setError("An error occurred while deleting the document.");
        } finally {
            setIsLoading(false);
        }
    };

    const handlePdfOpacityChange = (opacity: number) => {
        setPdfOpacity(opacity);
    };

    // --- Measurement Management ---

    const handleStartSetScale = () => {
        setMode('setting_scale');
        setDrawingPoints([]);
    };

    const handleFinishScaleLine = () => {
        setScaleCalibrationLine(drawingPoints);
        setIsScaleModalOpen(true);
        setMode('idle');
        setDrawingPoints([]);
    };

    const handleConfirmScale = (lengthInMeters: number) => {
        if (!activePdfId || !scaleCalibrationLine || scaleCalibrationLine.length < 2 || !activeProject) return;
    
        const p1 = scaleCalibrationLine[0];
        const p2 = scaleCalibrationLine[1];
        const linePixels = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    
        const newScaleInfo: ScaleInfo = { linePixels, knownLength: lengthInMeters };
    
        const newProject = {
            ...activeProject,
            pdfs: activeProject.pdfs.map(p => p.id === activePdfId ? { ...p, scaleInfo: newScaleInfo } : p),
        };
        commitUpdate(newProject);
    
        setIsScaleModalOpen(false);
        setScaleCalibrationLine(null);
    };

    const handleStartMeasure = () => {
        setMode('drawing_measurement');
        setSelectedMeasurementId(null);
        setActiveDrawingMeasurementId(null); // Ensure we're creating a new one
        setDrawingPoints([]);
    };

    const handleStartAddToMeasurement = (measurementId: string) => {
        setMode('drawing_measurement');
        setSelectedMeasurementId(null);
        setActiveDrawingMeasurementId(measurementId);
        setDrawingPoints([]);
    };
    
    const handleSelectMeasurementForEditing = (measurementId: string | null) => {
        setSelectedMeasurementId(measurementId);
    };

    const handleSaveMeasurement = () => {
        if (!activePdfId || drawingPoints.length < 2 || !activeProject) return;
        
        let newProject: Project;
        if (activeDrawingMeasurementId) {
            // Add segment to existing measurement
            const measurements = activeProject.measurements.map(m => {
                if (m.id === activeDrawingMeasurementId) {
                    return { ...m, points: [...m.points, drawingPoints] };
                }
                return m;
            });
            newProject = { ...activeProject, measurements };
        } else {
            // Create a new measurement
            const colorPalette = ['#8b5cf6', '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#ec4899'];
            const newMeasurement: LinearMeasurement = {
                id: `measure_${Date.now()}`,
                pdfId: activePdfId,
                name: `Measurement ${activeProject.measurements.length + 1}`,
                color: colorPalette[activeProject.measurements.length % colorPalette.length],
                points: [drawingPoints], // First segment
                isVisible: true,
                manualEntries: [],
                groupId: null,
            };
            newProject = { ...activeProject, measurements: [...activeProject.measurements, newMeasurement] };
        }
        commitUpdate(newProject);

        setMode('idle');
        setDrawingPoints([]);
        setActiveDrawingMeasurementId(null);
    };
    
    const handleUpdateMeasurement = (measurementId: string, updates: Partial<Omit<LinearMeasurement, 'id' | 'pdfId'>>) => {
        if (!activeProject) return;
        const newProject = {
            ...activeProject,
            measurements: activeProject.measurements.map(m => 
                m.id === measurementId ? { ...m, ...updates } : m
            )
        };
        commitUpdate(newProject);
    };

    const handleDeleteMeasurement = (measurementId: string) => {
        if (!activeProject) return;
        const newProject = {
            ...activeProject,
            measurements: activeProject.measurements.filter(m => m.id !== measurementId)
        };
        commitUpdate(newProject);

        if (selectedMeasurementId === measurementId) {
            setSelectedMeasurementId(null);
        }
    };
    
    const handleDeleteMeasurementSegment = (measurementId: string, segmentIndex: number) => {
        if (!activeProject) return;
        
        const measurements = [...activeProject.measurements];
        const measurementIndex = measurements.findIndex(m => m.id === measurementId);
        if (measurementIndex === -1) return;

        const measurement = measurements[measurementIndex];
        const newPoints = measurement.points.filter((_, index) => index !== segmentIndex);
        
        // Re-index manual entries
        const newManualEntries = (measurement.manualEntries || [])
            .filter(e => e.segmentIndex !== segmentIndex)
            .map(e => (e.segmentIndex > segmentIndex ? { ...e, segmentIndex: e.segmentIndex - 1 } : e));
        
        if (newPoints.length === 0) {
            // If no segments are left, delete the entire measurement
            measurements.splice(measurementIndex, 1);
            if (selectedMeasurementId === measurementId) {
                setSelectedMeasurementId(null);
            }
        } else {
            measurements[measurementIndex] = { 
                ...measurement, 
                points: newPoints,
                manualEntries: newManualEntries
            };
        }
        commitUpdate({ ...activeProject, measurements });
    };

    const handleStartDragMeasurementNode = (measurementId: string, segmentIndex: number, pointIndex: number) => {
        setDraggedMeasurementNode({ measurementId, segmentIndex, pointIndex });
    };
    
    const handleUpdateMeasurementPoint = (newPoint: {x: number, y: number}) => {
        if (!draggedMeasurementNode || !activeProject) return;
        const { measurementId, segmentIndex, pointIndex } = draggedMeasurementNode;

        const newProject = {
            ...activeProject,
            measurements: activeProject.measurements.map(m => {
                if (m.id === measurementId) {
                    const newPoints = [...m.points];
                    const segment = [...newPoints[segmentIndex]];
                    segment[pointIndex] = newPoint;
                    newPoints[segmentIndex] = segment;
                    return { ...m, points: newPoints };
                }
                return m;
            })
        };
        commitUpdate(newProject);
    };

    const handleEndDragMeasurementNode = () => {
        setDraggedMeasurementNode(null);
    };


    // Manual Length Entries for Measurements
    const handleOpenManualLengthModal = (measurementId: string, segmentIndex: number, pointIndex: number, entry?: ManualEntry) => {
        setEditingManualEntry({
            measurementId,
            segmentIndex,
            pointIndex,
            entryId: entry?.id
        });
    };

    const handleSaveManualLength = (length: number) => {
        if (!editingManualEntry || !activeProject) return;

        const { measurementId, segmentIndex, pointIndex, entryId } = editingManualEntry;

        const measurements = activeProject.measurements.map(m => {
            if (m.id === measurementId) {
                const existingEntries = m.manualEntries || [];
                
                if (length <= 0) { // Delete if length is 0 or less
                    return { ...m, manualEntries: existingEntries.filter(e => e.id !== entryId) };
                }

                if (entryId) { // Update existing entry
                    return {
                        ...m,
                        manualEntries: existingEntries.map(e => e.id === entryId ? { ...e, length } : e)
                    };
                } else { // Add new entry
                    const newEntry: ManualEntry = {
                        id: `manual_${Date.now()}`,
                        length,
                        segmentIndex,
                        pointIndex,
                    };
                    return { ...m, manualEntries: [...existingEntries, newEntry] };
                }
            }
            return m;
        });
        
        commitUpdate({ ...activeProject, measurements });
        setEditingManualEntry(null);
    };

    const handleDeleteManualEntry = (measurementId: string, entryId: string) => {
        if (!activeProject) return;
        const newProject = {
            ...activeProject,
            measurements: activeProject.measurements.map(m => {
                if (m.id === measurementId) {
                    return { ...m, manualEntries: (m.manualEntries || []).filter(e => e.id !== entryId) };
                }
                return m;
            })
        };
        commitUpdate(newProject);
    };
    
    // --- Measurement Group Management ---

    const handleAddMeasurementGroup = (name: string, parentId: string | null) => {
        if (!activeProject) return;
        const groups = activeProject.measurementGroups || [];
        if (name.trim() && !groups.some(g => g.name.toLowerCase() === name.trim().toLowerCase() && g.parentId === parentId)) {
            const newGroup: MeasurementGroup = {
                id: `mgroup_${Date.now()}`,
                name: name.trim(),
                parentId,
            };
            commitUpdate({ ...activeProject, measurementGroups: [...groups, newGroup] });
        }
    };

    const handleUpdateMeasurementGroupName = (groupId: string, newName: string) => {
        if (!newName.trim() || !activeProject) return;

        const groups = activeProject.measurementGroups || [];
        const groupToUpdate = groups.find(g => g.id === groupId);
        if (!groupToUpdate) return;

        const conflict = groups.some(
            g => g.id !== groupId &&
                g.parentId === groupToUpdate.parentId &&
                g.name.toLowerCase() === newName.trim().toLowerCase()
        );

        if (conflict) {
            setError(`A measurement group named "${newName.trim()}" already exists at this level.`);
            setTimeout(() => setError(null), 3000);
            return;
        }
        
        const newProject = {
            ...activeProject,
            measurementGroups: groups.map(g =>
                g.id === groupId ? { ...g, name: newName.trim() } : g
            )
        };
        commitUpdate(newProject);
    };

    const handleDeleteMeasurementGroup = (groupId: string) => {
        if (!window.confirm("Are you sure you want to delete this group and all its sub-groups? Measurements within will become ungrouped.") || !activeProject) {
            return;
        }

        const groups = activeProject.measurementGroups || [];
        const idsToDelete = new Set<string>([groupId]);
        const findChildrenRecursive = (parentId: string) => {
            groups.forEach(g => {
                if (g.parentId === parentId) {
                    idsToDelete.add(g.id);
                    findChildrenRecursive(g.id);
                }
            });
        };
        findChildrenRecursive(groupId);

        const newGroups = groups.filter(g => !idsToDelete.has(g.id));
        const newMeasurements = activeProject.measurements.map(m => {
            if (m.groupId && idsToDelete.has(m.groupId)) {
                return { ...m, groupId: null };
            }
            return m;
        });
        
        commitUpdate({ ...activeProject, measurementGroups: newGroups, measurements: newMeasurements });
    };

    const handleAssignMeasurementToGroup = (measurementId: string, groupId: string | null) => {
        if (!activeProject) return;
        const newProject = {
            ...activeProject,
            measurements: activeProject.measurements.map(m =>
                m.id === measurementId ? { ...m, groupId } : m
            )
        };
        commitUpdate(newProject);
    };

    const handleUpdateMeasurementGroupParent = (groupId: string, newParentId: string | null) => {
        if (!activeProject) return;
        const groups = activeProject.measurementGroups || [];
        if (groupId === newParentId) return;

        const isDescendant = (childId: string | null, parentIdToFind: string): boolean => {
            if (!childId) return false;
            if (childId === parentIdToFind) return true;
            const childGroup = groups.find(g => g.id === childId);
            if (!childGroup || !childGroup.parentId) return false;
            return isDescendant(childGroup.parentId, parentIdToFind);
        };
        
        if (newParentId && isDescendant(newParentId, groupId)) {
            setError("Cannot move a group into one of its own children.");
            setTimeout(() => setError(null), 3000);
            return;
        }

        const newProject = {
            ...activeProject,
            measurementGroups: groups.map(g =>
                g.id === groupId ? { ...g, parentId: newParentId } : g
            )
        };
        commitUpdate(newProject);
    };


    // --- Linear Component Management ---

    const handleStartCreateLinearComponent = (point: { x: number; y: number; }) => {
        setLinearComponentCreationPoint(point);
        setIsLinearComponentModalOpen(true);
    };

    const handleConfirmCreateLinearComponent = ({ newComponentName, existingSymbolId }: { newComponentName?: string; existingSymbolId?: string; }) => {
        if (!linearComponentCreationPoint || !activePdfId || !activeProject) return;

        let newProject = { ...activeProject };

        let linearDiscipline = newProject.disciplines.find(d => d.name === LINEAR_DISCIPLINE_NAME && !d.parentId);
        if (!linearDiscipline) {
            linearDiscipline = {
                id: `disc_linear_${Date.now()}`,
                name: LINEAR_DISCIPLINE_NAME,
                parentId: null,
            };
            newProject.disciplines = [...newProject.disciplines, linearDiscipline];
        }
        
        let targetSymbolId = existingSymbolId;

        if (newComponentName) {
             const colorPalette = ['#8b5cf6', '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#ec4899'];
             const color = colorPalette[newProject.symbols.filter(s=>s.disciplineId === linearDiscipline.id).length % colorPalette.length];
             const placeholderIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="80" height="80" x="10" y="10" rx="20" ry="20" fill="${color}" /></svg>`;

            const newSymbol: SymbolInfo = {
                id: `sym_linear_${Date.now()}`,
                name: newComponentName,
                image: `data:image/svg+xml;base64,${btoa(placeholderIconSvg)}`,
                count: 0,
                locations: [],
                color,
                page: currentPage,
                pdfId: activePdfId,
                disciplineId: linearDiscipline.id,
                type: 'manual',
                parentId: null,
            };
            newProject.symbols.push(newSymbol);
            targetSymbolId = newSymbol.id;
        }

        if(targetSymbolId) {
             const symbolIndex = newProject.symbols.findIndex(s => s.id === targetSymbolId);
             if (symbolIndex > -1) {
                let newLocation: Location = {
                    x: linearComponentCreationPoint.x - PIN_SIZE,
                    y: linearComponentCreationPoint.y - (PIN_SIZE * 3),
                    width: PIN_SIZE * 2,
                    height: PIN_SIZE * 3,
                };
                newLocation = updateSymbolAreaAssignment(newLocation, activePdfId, newProject.areas);
                
                newProject.symbols[symbolIndex].locations.push(newLocation);
                newProject.symbols[symbolIndex].count++;
             }
        }
        
        commitUpdate(newProject);
        setIsLinearComponentModalOpen(false);
        setLinearComponentCreationPoint(null);
    };

    // --- DALI Management ---

    const handleAddDaliNetwork = (templateId?: string) => {
        if (!activeProject) return;
        const networks = activeProject.daliNetworks || [];
        const templates = activeProject.daliNetworkTemplates || [];
        const template = templates.find(t => t.id === templateId);

        const existingNumbers = networks
            .map(n => parseInt(n.name.replace('DA', ''), 10))
            .filter(n => !isNaN(n));
        const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

        const newNetwork: DaliNetwork = {
            id: `dali_net_${Date.now()}`,
            name: `DA${nextNumber}`,
            isVisible: true,
            ecgLimit: template ? template.ecgLimit : 55,
            ecdLimit: template ? template.ecdLimit : 20,
            powerSupplyCapacity: template ? template.powerSupplyCapacity : 250,
            defaultEcdTypeId: template ? template.defaultEcdTypeId : null,
        };
        commitUpdate({ ...activeProject, daliNetworks: [...networks, newNetwork] });
    };
    
    const handleUpdateDaliNetwork = (id: string, updates: Partial<DaliNetwork>) => {
        if (!activeProject) return;
        const networks = (activeProject.daliNetworks || []).map(n =>
            n.id === id ? { ...n, ...updates } : n
        );
        commitUpdate({ ...activeProject, daliNetworks: networks });
    };
    
    const handleDeleteDaliNetwork = (id: string) => {
        if (!activeProject) return;
        const networks = (activeProject.daliNetworks || []).filter(n => n.id !== id);
        const devices = (activeProject.daliDevices || []).filter(d => d.networkId !== id);
        commitUpdate({ ...activeProject, daliNetworks: networks, daliDevices: devices });
    };
    
    const handleStartDaliPlacement = (networkId: string, deviceType: DaliDeviceType) => {
        setMode('placing_dali_device');
        setActiveDaliPlacement({ networkId, deviceType });
        setActiveSymbolId(null);
        setActiveDisciplineId(null);
        setSelectedMeasurementId(null);
        setActiveDaliPsuPlacementNetworkId(null);
    };

    const placeDaliDeviceLogic = (pos: { x: number; y: number }, placementInfo: { networkId: string; deviceType: DaliDeviceType; ecdTypeId?: string } | null) => {
        if (!placementInfo || !activeProject || !activePdfId) return;

        const { networkId, deviceType, ecdTypeId } = placementInfo;
        let proj = { ...activeProject };

        const networks = [...(proj.daliNetworks || [])];
        const networkIndex = networks.findIndex(n => n.id === networkId);
        if (networkIndex === -1) return;

        let network = { ...networks[networkIndex] };

        const devices = proj.daliDevices || [];
        const networkDevices = devices.filter(d => d.networkId === networkId);
        const ecgDevices = networkDevices.filter(d => d.type === 'ECG');
        const ecdDevices = networkDevices.filter(d => d.type === 'ECD');

        // Check limits before placing
        if (deviceType === 'ECG') {
            if (ecgDevices.length >= network.ecgLimit) {
                if (network.ecgLimit < 64) {
                    if (window.confirm(`You are about to exceed the recommended DALI ECG device limit of 55 for network "${network.name}".\n\nContinuing will raise the limit to the maximum of 64 for this network. Do you want to proceed?`)) {
                        network.ecgLimit = 64;
                        networks[networkIndex] = network;
                    } else {
                        return; // User cancelled
                    }
                } else {
                    setError(`Cannot add more ECG devices. Maximum limit of 64 reached for network ${network.name}.`);
                    setTimeout(() => setError(null), 4000);
                    return;
                }
            }
        } else { // ECD
            if (ecdDevices.length >= network.ecdLimit) {
                if (network.ecdLimit < 32) {
                    if (window.confirm(`You are about to exceed the recommended DALI ECD device limit of 20 for network "${network.name}".\n\nContinuing will raise the limit to the maximum of 32 for this network. Do you want to proceed?`)) {
                        network.ecdLimit = 32;
                        networks[networkIndex] = network;
                    } else {
                        return; // User cancelled
                    }
                } else {
                    setError(`Cannot add more ECD devices. Maximum limit of 32 reached for network ${network.name}.`);
                    setTimeout(() => setError(null), 4000);
                    return;
                }
            }
        }
        
        // Find next available address
        const typeDevices = deviceType === 'ECG' ? ecgDevices : ecdDevices;
        const usedAddresses = new Set(typeDevices.map(d => d.shortAddress));
        let nextAddress = deviceType === 'ECG' ? 0 : 100;

        while(usedAddresses.has(nextAddress)) {
            nextAddress++;
        }

        const DALI_PIN_SIZE = 5;

        const newDevice: DaliDevice = {
            id: `dali_dev_${Date.now()}`,
            networkId: networkId,
            type: deviceType,
            shortAddress: nextAddress,
            pdfId: activePdfId,
            page: currentPage,
            location: {
                x: pos.x - DALI_PIN_SIZE,
                y: pos.y - (DALI_PIN_SIZE * 3),
                width: DALI_PIN_SIZE * 2,
                height: DALI_PIN_SIZE * 3,
            },
            ecdTypeId: deviceType === 'ECD' ? (ecdTypeId || network.defaultEcdTypeId || undefined) : undefined,
        };

        commitUpdate({ ...proj, daliNetworks: networks, daliDevices: [...devices, newDevice] });
    };
    
    const handlePlaceDaliDevice = (pos: { x: number; y: number }) => {
        placeDaliDeviceLogic(pos, activeDaliPlacement);
    };

    const handlePaintDaliDevice = (pos: { x: number; y: number }) => {
        placeDaliDeviceLogic(pos, daliDeviceToPaint);
    };
    
    const handleDeleteDaliDevice = (deviceId: string) => {
        if (!activeProject) return;
        commitUpdate({
            ...activeProject,
            daliDevices: (activeProject.daliDevices || []).filter(d => d.id !== deviceId)
        });
    };

    const handleStartDaliPaintSelection = () => {
        setMode('selecting_dali_painter_source');
        setActiveSymbolId(null);
        setActiveDisciplineId(null);
        setSelectedMeasurementId(null);
        setActiveDaliPlacement(null);
        setActiveDaliPsuPlacementNetworkId(null);
        setDaliDeviceToPaint(null);
        setDaliPsuLocationToPaint(null);
    };

    const handleDaliDevicePicked = (device: DaliDevice) => {
        if (!device) return;
        setDaliDeviceToPaint({
            networkId: device.networkId,
            deviceType: device.type,
            ecdTypeId: device.ecdTypeId,
        });
        setMode('painting_dali_device');
    };

    const handleDaliPsuPickedForPainting = (network: DaliNetwork) => {
        if (!network.psuLocation?.location?.trim()) {
            setError("The selected PSU has no location description to copy.");
            setTimeout(() => setError(null), 4000);
            setMode('idle');
            return;
        }
        setDaliPsuLocationToPaint(network.psuLocation.location);
        setMode('painting_dali_psu_location');
    };
    
    const handlePaintDaliPsuLocation = (networkId: string) => {
        if (!activeProject || daliPsuLocationToPaint === null) return;
        const networks = (activeProject.daliNetworks || []).map(n => {
            if (n.id === networkId && n.psuLocation) {
                // Do not paint if location is already the same
                if (n.psuLocation.location === daliPsuLocationToPaint) return n;
                const newPsuLocation = { ...n.psuLocation, location: daliPsuLocationToPaint };
                return { ...n, psuLocation: newPsuLocation };
            }
            return n;
        });
        commitUpdate({ ...activeProject, daliNetworks: networks });
    };

    const handleToggleDaliLabels = () => {
        setShowDaliLabels(prev => !prev);
    };

    const handleStartPlacePsu = (networkId: string) => {
        setMode('placing_dali_psu');
        setActiveDaliPsuPlacementNetworkId(networkId);
        setActiveSymbolId(null);
        setActiveDisciplineId(null);
        setSelectedMeasurementId(null);
        setActiveDaliPlacement(null);
    };

    const handlePlacePsu = (pos: { x: number; y: number }) => {
        if (!activeProject || !activeDaliPsuPlacementNetworkId || !activePdfId) return;

        const networks = (activeProject.daliNetworks || []).map(n => {
            if (n.id === activeDaliPsuPlacementNetworkId) {
                const PSU_SIZE = 10;
                const newLocation: PsuLocation = {
                    x: pos.x - PSU_SIZE,
                    y: pos.y - PSU_SIZE,
                    width: PSU_SIZE * 2,
                    height: PSU_SIZE * 2,
                    pdfId: activePdfId,
                    page: currentPage,
                    location: n.psuLocation?.location // Preserve existing location string
                };
                // Simply set or replace the single psuLocation
                return { ...n, psuLocation: newLocation };
            }
            return n;
        });

        commitUpdate({ ...activeProject, daliNetworks: networks });
        setMode('idle');
        setActiveDaliPsuPlacementNetworkId(null);
    };

    const handleDeletePsu = (networkId: string) => {
        if (!activeProject) return;
        const networks = (activeProject.daliNetworks || []).map(n => {
            if (n.id === networkId) {
                // Use object destructuring to remove the psuLocation property
                const { psuLocation, ...restOfNetwork } = n;
                return restOfNetwork;
            }
            return n;
        });
        commitUpdate({ ...activeProject, daliNetworks: networks });
    };

    const handleStartEditPsuLocation = (networkId: string) => {
        const network = activeProject?.daliNetworks?.find(n => n.id === networkId);
        if (network && network.psuLocation) {
            setEditingPsuNetwork(network);
        }
    };

    const handleSavePsuLocation = (location: string) => {
        if (!activeProject || !editingPsuNetwork || !editingPsuNetwork.psuLocation) return;
        
        const updatedLocation: PsuLocation = {
            ...editingPsuNetwork.psuLocation,
            location: location.trim(),
        };

        const networks = (activeProject.daliNetworks || []).map(n =>
            n.id === editingPsuNetwork.id ? { ...n, psuLocation: updatedLocation } : n
        );
        commitUpdate({ ...activeProject, daliNetworks: networks });
        setEditingPsuNetwork(null);
    };


    const handleRenumberDaliNetwork = (networkId: string) => {
        if (!activeProject || !window.confirm("Are you sure you want to re-address all devices on this network? This will re-sequence all ECGs from 0 and ECDs from 100.")) return;
        
        let devices = [...(activeProject.daliDevices || [])];
        const networkDevices = devices.filter(d => d.networkId === networkId);

        const ecgs = networkDevices.filter(d => d.type === 'ECG').sort((a,b) => a.shortAddress - b.shortAddress);
        const ecds = networkDevices.filter(d => d.type === 'ECD').sort((a,b) => a.shortAddress - b.shortAddress);

        let ecgAddress = 0;
        let ecdAddress = 100;

        const updatedDeviceIds = new Set<string>();

        ecgs.forEach(device => {
            devices = devices.map(d => d.id === device.id ? {...d, shortAddress: ecgAddress++} : d);
            updatedDeviceIds.add(device.id);
        });

        ecds.forEach(device => {
            devices = devices.map(d => d.id === device.id ? {...d, shortAddress: ecdAddress++} : d);
            updatedDeviceIds.add(device.id);
        });
        
        commitUpdate({ ...activeProject, daliDevices: devices });
    };

    const handleSaveDaliNetworkAsTemplate = (networkId: string) => {
        if (!activeProject) return;
        const network = activeProject.daliNetworks?.find(n => n.id === networkId);
        if (!network) return;

        const templateName = window.prompt("Enter a name for this network template:", network.name);
        if (!templateName || !templateName.trim()) return;

        const newTemplate: DaliNetworkTemplate = {
            id: `dali_template_${Date.now()}`,
            name: templateName.trim(),
            ecgLimit: network.ecgLimit,
            ecdLimit: network.ecdLimit,
            powerSupplyCapacity: network.powerSupplyCapacity,
            defaultEcdTypeId: network.defaultEcdTypeId || null,
        };

        const templates = [...(activeProject.daliNetworkTemplates || []), newTemplate];
        commitUpdate({ ...activeProject, daliNetworkTemplates: templates });
    };


    const handleAddEcdType = (newTypeData: Omit<EcdType, 'id'>) => {
        if (!activeProject) return;
        const newType: EcdType = {
            id: `ecdtype_${Date.now()}`,
            ...newTypeData,
        };
        const ecdTypes = [...(activeProject.ecdTypes || []), newType];
        commitUpdate({ ...activeProject, ecdTypes });
    };

    const handleUpdateEcdType = (updatedType: EcdType) => {
        if (!activeProject) return;
        const ecdTypes = (activeProject.ecdTypes || []).map(t => t.id === updatedType.id ? updatedType : t);
        commitUpdate({ ...activeProject, ecdTypes });
    };

    const handleDeleteEcdType = (typeId: string) => {
        if (!activeProject) return;
        const ecdTypes = (activeProject.ecdTypes || []).filter(t => t.id !== typeId);
        const daliDevices = (activeProject.daliDevices || []).map(d => {
            if (d.ecdTypeId === typeId) {
                return { ...d, ecdTypeId: undefined };
            }
            return d;
        });
        commitUpdate({ ...activeProject, ecdTypes, daliDevices });
    };
    
    const handleStartEditEcdDevice = (deviceId: string) => {
        const device = activeProject?.daliDevices?.find(d => d.id === deviceId);
        if (device && device.type === 'ECD') {
            setEditingEcdDevice(device);
        }
    };
    
    const handleAssignEcdTypeToDevice = (ecdTypeId: string) => {
        if (!activeProject || !editingEcdDevice) return;

        const daliDevices = (activeProject.daliDevices || []).map(d => 
            d.id === editingEcdDevice.id ? { ...d, ecdTypeId: ecdTypeId } : d
        );
        commitUpdate({ ...activeProject, daliDevices });
        setEditingEcdDevice(null);
    };

    // --- Area Management ---

    const handleStartAreaDrawing = () => {
        setMode('drawing_area');
        setDrawingPoints([]);
        setActiveSymbolId(null);
        setActiveDisciplineId(null);
    };

    const handleDrawPoint = (point: {x: number, y: number}) => {
        if (mode === 'setting_scale' && drawingPoints.length >= 2) return; // Only allow a single line for scale
        setDrawingPoints(prev => [...prev, point]);
    };

    const handleFinishAreaDrawing = () => {
        if (drawingPoints.length > 2) {
            setIsNamingArea(true); // Open modal to name the area
        } else {
            handleCancelDrawing();
        }
    };

    const handleCancelDrawing = () => {
        setMode('idle');
        setDrawingPoints([]);
        setIsNamingArea(false);
        setIsScaleModalOpen(false);
        setScaleCalibrationLine(null);
        setActiveDrawingMeasurementId(null);
        setActiveDaliPlacement(null);
        setDaliDeviceToPaint(null);
        setDaliPsuLocationToPaint(null);
        setActiveDaliPsuPlacementNetworkId(null);
    };

    const handleCreateArea = (name: string) => {
        if (!activePdfId || !activeProject) return;
        const colorPalette = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6'];

        const newArea: Area = {
            id: `area_${Date.now()}`,
            name,
            pdfId: activePdfId,
            points: drawingPoints,
            isVisible: true,
            color: colorPalette[activeProject.areas.length % colorPalette.length]
        };
        const updatedAreas = [...activeProject.areas, newArea];
        const updatedSymbols = assignSymbolsToArea(activeProject.symbols, activePdfId, updatedAreas);
        
        commitUpdate({ ...activeProject, areas: updatedAreas, symbols: updatedSymbols });
        handleCancelDrawing();
    };
    
    const handleUpdateArea = (areaId: string, updates: Partial<Area>) => {
        if (!activeProject) return;
        const newProject = {
            ...activeProject,
            areas: activeProject.areas.map(a => a.id === areaId ? {...a, ...updates} : a)
        };
        commitUpdate(newProject);
    };

    const handleDeleteArea = (areaId: string) => {
        if (!window.confirm("Are you sure you want to delete this area? Pins inside will become unassigned.") || !activeProject) {
            return;
        }
        const updatedAreas = activeProject.areas.filter(a => a.id !== areaId);
        const updatedSymbols = activeProject.symbols.map(s => {
             const newLocations = s.locations.map(loc => {
                 if (loc.areaId === areaId) {
                     return { ...loc, areaId: undefined };
                 }
                 return loc;
             });
             return { ...s, locations: newLocations };
         });
        commitUpdate({ ...activeProject, areas: updatedAreas, symbols: updatedSymbols });
    };
    
    // --- Symbol Management & Point-in-Polygon Logic ---
    
    const isPointInPolygon = (point: { x: number, y: number }, polygon: { x: number, y: number }[]): boolean => {
        let isInside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            const intersect = ((yi > point.y) !== (yj > point.y)) && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            if (intersect) isInside = !isInside;
        }
        return isInside;
    };

    const updateSymbolAreaAssignment = (location: Location, pdfId: string, areas: Area[]): Location => {
        const pinCenter = { x: location.x + location.width / 2, y: location.y + location.height / 2 };
        
        const areasForPdf = areas.filter(a => a.pdfId === pdfId && a.isVisible);
        
        for (const area of areasForPdf) {
            if (isPointInPolygon(pinCenter, area.points)) {
                return { ...location, areaId: area.id };
            }
        }
        
        return { ...location, areaId: undefined };
    };

    const assignSymbolsToArea = (symbols: SymbolInfo[], pdfId: string, allAreasForPdf: Area[]): SymbolInfo[] => {
        return symbols.map(s => {
            if (s.pdfId !== pdfId) return s;

            const updatedLocations = s.locations.map(loc => updateSymbolAreaAssignment(loc, pdfId, allAreasForPdf));
            return { ...s, locations: updatedLocations };
        });
    };

    const handleSetActiveSymbol = (symbolId: string | null) => {
        if (symbolId !== null) {
            setActiveDisciplineId(null);
        }
        setActiveSymbolId(symbolId);
    };
    
    const handleSetActiveDiscipline = (disciplineId: string | null) => {
        setActiveDisciplineId(disciplineId);
        setActiveSymbolId(null);
    };
    
    const startManualSelection = () => {
        if (!activeProject || !activePdfId) return;
        handleSetActiveSymbol(null);
        setMode('selecting_manual');
        setError(null);
    }

    const handleCancelSelection = () => {
        setMode('idle');
        setDrawingPoints([]);
    };

    const handleSymbolSelected = useCallback(async (symbolImage: string) => {
        if (!activeProject || !activePdfId) return;

        if (mode === 'selecting_manual') {
            setMode('idle');
            const tempId = `sym_manual_${Date.now()}`;
            
            const manualSymbolCount = activeProject.symbols.length;
            const newSymbolColor = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#8b5cf6', '#ec4899'][manualSymbolCount % 6];
            const newSymbol: SymbolInfo = {
                id: tempId,
                name: `Manual Symbol ${manualSymbolCount + 1}`,
                image: symbolImage,
                count: 0,
                locations: [],
                color: newSymbolColor,
                page: currentPage,
                pdfId: activePdfId,
                disciplineId: activeDisciplineId,
                type: 'manual',
                parentId: null,
            };
            commitUpdate({ ...activeProject, symbols: [...activeProject.symbols, newSymbol]});

            handleSetActiveSymbol(tempId);
            setMode('placing_dots');
        }
    }, [currentPage, mode, activeDisciplineId, activeProject, activePdfId]);
    
    const handlePlaceDot = (pos: { x: number; y: number }) => {
        if (mode !== 'placing_dots' || !activeSymbolId || !activePdfId || !activeProject) return;
        
        const newSymbols = activeProject.symbols.map(s => {
            if (s.id === activeSymbolId) {
                let newLocation: Location = {
                    x: pos.x - PIN_SIZE,
                    y: pos.y - (PIN_SIZE * 3),
                    width: PIN_SIZE * 2,
                    height: PIN_SIZE * 3,
                };
                newLocation = updateSymbolAreaAssignment(newLocation, activePdfId, activeProject.areas);

                const newLocations = [...s.locations, newLocation];
                return { ...s, locations: newLocations, count: newLocations.length };
            }
            return s;
        });
        commitUpdate({...activeProject, symbols: newSymbols });
    };

    const handleQuickPlaceDot = (pos: { x: number; y: number }) => {
        if (mode !== 'idle' || !activeSymbolId || !activeProject || !activePdfId) return;
    
        const symbol = activeProject.symbols.find(s => s.id === activeSymbolId);
        if (!symbol) return;
    
        if (symbol.pdfId !== activePdfId || symbol.page !== currentPage) {
            const pdfName = activeProject.pdfs.find(p => p.id === symbol.pdfId)?.name || 'the correct document';
            setError(`To add pins for "${symbol.name}", please switch to page ${symbol.page} of ${pdfName}.`);
            setTimeout(() => setError(null), 5000);
            return;
        }
    
        const newSymbols = activeProject.symbols.map(s => {
            if (s.id === activeSymbolId) {
                let newLocation: Location = {
                    x: pos.x - PIN_SIZE,
                    y: pos.y - (PIN_SIZE * 3),
                    width: PIN_SIZE * 2,
                    height: PIN_SIZE * 3,
                };
                newLocation = updateSymbolAreaAssignment(newLocation, activePdfId, activeProject.areas);

                const newLocations = [...s.locations, newLocation];
                return { ...s, locations: newLocations, count: newLocations.length };
            }
            return s;
        });
        commitUpdate({...activeProject, symbols: newSymbols });
    };

    const handleLocationDelete = (symbolId: string, locationIndex: number) => {
        if (!activeProject) return;
        const symbolsCopy: SymbolInfo[] = JSON.parse(JSON.stringify(activeProject.symbols));
        const targetSymbol = symbolsCopy.find((s) => s.id === symbolId);

        if (!targetSymbol || !targetSymbol.locations[locationIndex]) {
            console.warn("Symbol or location not found for deletion.");
            return;
        }

        targetSymbol.locations.splice(locationIndex, 1);
        targetSymbol.count--;

        commitUpdate({...activeProject, symbols: symbolsCopy});
    };

    const handleStartReassignPin = (symbolId: string, locationIndex: number) => {
        setPinToReassign({ symbolId, locationIndex });
    };

    const handleConfirmReassignPin = (newSymbolId: string) => {
        if (!pinToReassign || !activeProject || !activePdfId) return;
    
        const { symbolId: oldSymbolId, locationIndex } = pinToReassign;

        const oldSymbol = activeProject.symbols.find(s => s.id === oldSymbolId);
        const newSymbol = activeProject.symbols.find(s => s.id === newSymbolId);

        if (!oldSymbol || !newSymbol || oldSymbol.id === newSymbol.id) {
            setPinToReassign(null);
            return; 
        }

        let locationToMove = oldSymbol.locations[locationIndex];
        if (!locationToMove) {
            setPinToReassign(null);
            return;
        }
        locationToMove = updateSymbolAreaAssignment(locationToMove, activePdfId, activeProject.areas);

        const symbolsCopy: SymbolInfo[] = JSON.parse(JSON.stringify(activeProject.symbols));
        const updatedOldSymbol = symbolsCopy.find((s: SymbolInfo) => s.id === oldSymbolId)!;
        updatedOldSymbol.locations.splice(locationIndex, 1);
        updatedOldSymbol.count--;

        const updatedNewSymbol = symbolsCopy.find((s: SymbolInfo) => s.id === newSymbolId)!;
        updatedNewSymbol.locations.push(locationToMove);
        updatedNewSymbol.count++;

        commitUpdate({ ...activeProject, symbols: symbolsCopy });
        setPinToReassign(null);
    };


    const handleAddPoints = (symbolId: string) => {
        if (!activeProject) return;
        const symbol = activeProject.symbols.find(s => s.id === symbolId);
        if (symbol) {
            handleSetActiveSymbol(symbolId);
            setMode('placing_dots');
            setCurrentPage(symbol.page);
        }
    };

    const handleSymbolNameChange = (id: string, newName: string) => {
        if (!activeProject) return;
        commitUpdate({ ...activeProject, symbols: activeProject.symbols.map(s => s.id === id ? { ...s, name: newName } : s) });
    };

    const handleSymbolColorChange = (id: string, newColor: string) => {
        if (!activeProject) return;
        commitUpdate({ ...activeProject, symbols: activeProject.symbols.map(s => s.id === id ? { ...s, color: newColor } : s) });
    };
    
    const handleSymbolImageChange = (symbolId: string, file: File) => {
        if (!activeProject || !file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const newImage = event.target?.result as string;
            if (newImage) {
                const newProject = {
                    ...activeProject,
                    symbols: activeProject.symbols.map(s =>
                        s.id === symbolId ? { ...s, image: newImage } : s
                    )
                };
                commitUpdate(newProject);
            }
        };
        reader.onerror = (error) => {
            console.error("Failed to read image file:", error);
            setError("Could not update symbol image.");
        };
        reader.readAsDataURL(file);
    };

    const handleSymbolDelete = (idToDelete: string) => {
        if (!activeProject) return;
        const symbolToDelete = activeProject.symbols.find(s => s.id === idToDelete);
        if (!symbolToDelete) return;

        if (activeSymbolId === idToDelete) {
            handleSetActiveSymbol(null);
            setMode('idle');
        }
        commitUpdate({ ...activeProject, symbols: activeProject.symbols.filter(s => s.id !== idToDelete) });
    };

    const handleAddDiscipline = (name: string, parentId: string | null) => {
        if (!activeProject) return;
        if (name.trim() && !activeProject.disciplines.some(d => d.name.toLowerCase() === name.trim().toLowerCase())) {
            const newDiscipline: Discipline = {
                id: `disc_${Date.now()}`,
                name: name.trim(),
                parentId: parentId
            };
            commitUpdate({ ...activeProject, disciplines: [...activeProject.disciplines, newDiscipline] });
        }
    };

    const handleUpdateDisciplineName = (disciplineId: string, newName: string) => {
        if (!newName.trim() || !activeProject) return;
    
        const disciplineToUpdate = activeProject.disciplines.find(d => d.id === disciplineId);
        if (!disciplineToUpdate) return;
    
        const conflict = activeProject.disciplines.some(
            d => d.id !== disciplineId && 
                 d.parentId === disciplineToUpdate.parentId && 
                 d.name.toLowerCase() === newName.trim().toLowerCase()
        );
    
        if (conflict) {
            setError(`A discipline named "${newName.trim()}" already exists at this level.`);
            setTimeout(() => setError(null), 3000);
            return;
        }

        const newProject = {
            ...activeProject,
            disciplines: activeProject.disciplines.map(d => 
                d.id === disciplineId ? { ...d, name: newName.trim() } : d
            )
        };
        commitUpdate(newProject);
    };

    const handleAssignDiscipline = (symbolId: string, disciplineId: string | null) => {
        if (!activeProject) return;
        commitUpdate({ ...activeProject, symbols: activeProject.symbols.map(s => s.id === symbolId ? { ...s, disciplineId } : s)});
    };

    const handleDeleteDiscipline = (disciplineId: string) => {
        if (!window.confirm("Are you sure you want to delete this discipline and all its sub-disciplines? Symbols within will become uncategorized.") || !activeProject) {
            return;
        }
    
        const idsToDelete = new Set<string>([disciplineId]);
        const findChildrenRecursive = (parentId: string) => {
            activeProject.disciplines.forEach(d => {
                if (d.parentId === parentId) {
                    idsToDelete.add(d.id);
                    findChildrenRecursive(d.id);
                }
            });
        };
        findChildrenRecursive(disciplineId);
    
        const newDisciplines = activeProject.disciplines.filter(d => !idsToDelete.has(d.id));
        const newSymbols = activeProject.symbols.map(s => {
            if (s.disciplineId && idsToDelete.has(s.disciplineId)) {
                return { ...s, disciplineId: null };
            }
            return s;
        });
        
        if (activeDisciplineId && idsToDelete.has(activeDisciplineId)) {
            setActiveDisciplineId(null);
        }
    
        commitUpdate({ ...activeProject, disciplines: newDisciplines, symbols: newSymbols });
    };
    
    const handleUpdateDisciplineParent = (disciplineId: string, newParentId: string | null) => {
        if (!activeProject) return;
        if (disciplineId === newParentId) return;

        const isDescendant = (childId: string | null, parentIdToFind: string): boolean => {
            if (!childId) return false;
            if (childId === parentIdToFind) return true;
            const childDiscipline = activeProject.disciplines.find(d => d.id === childId);
            if (!childDiscipline || !childDiscipline.parentId) return false;
            return isDescendant(childDiscipline.parentId, parentIdToFind);
        };
        
        if (newParentId && isDescendant(newParentId, disciplineId)) {
             const tempError = "Cannot move a discipline into one of its own children.";
             console.warn(tempError);
             setError(tempError);
             setTimeout(() => setError(null), 3000);
             return;
        }
    
        const newDisciplines = activeProject.disciplines.map(d => {
            if (d.id === disciplineId) {
                return { ...d, parentId: newParentId };
            }
            return d;
        });
        commitUpdate({ ...activeProject, disciplines: newDisciplines });
    };
    
    const handleOpenExportModal = () => {
        if (!activeProject) return;
        setIsExportModalOpen(true);
    };

    const handleConfirmExport = async (onlyCounted: boolean) => {
        if (!activeProject) return;
        setIsExportModalOpen(false);
        setIsLoading(true);
        setError(null);
        try {
            await exportExcelWithSchedule(
                activeProject,
                onlyCounted
            );
        } catch (error) {
            console.error("Failed to export Excel:", error);
            setError((error as Error).message || "Failed to export Excel.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleExportPdfReport = () => {
        if (!activeProject) return;
        setIsExportPdfModalOpen(true);
    };

    const handleConfirmExportPdfReport = async (withLabels: boolean) => {
        if (!activeProject || !activePdfId) return;
        setIsExportingPdf(true);
        setError(null);
        try {
            await exportMarkedUpPdf(activeProject, activePdfId, currentPage, { withLabels });
        } catch(err) {
             console.error("Failed to export PDF report:", err);
             setError((err as Error).message || "Failed to generate PDF report.");
        } finally {
            setIsExportingPdf(false);
            setIsExportPdfModalOpen(false);
        }
    };

    const handleExportDaliPdfReport = async () => {
        if (!activeProject || !activePdfId) return;
        setIsExportingDaliPdf(true);
        setError(null);
        try {
            await exportDaliPdf(activeProject, activePdfId, currentPage);
        } catch(err) {
             console.error("Failed to export DALI PDF report:", err);
             setError((err as Error).message || "Failed to generate DALI PDF report.");
        } finally {
            setIsExportingDaliPdf(false);
        }
    };

    const handleOpenCopyModal = (symbolId: string) => {
        if (!activeProject) return;
        const symbol = activeProject.symbols.find(s => s.id === symbolId);
        if (symbol) {
            setSymbolToCopy(symbol);
        }
    };

    const handleCloseCopyModal = () => {
        setSymbolToCopy(null);
    };

    const handleCopySymbols = (targetPdfIds: string[]) => {
        if (!activeProject || !symbolToCopy) return;

        const sourceSymbol = activeProject.symbols.find(s => s.id === symbolToCopy.id);
        if (!sourceSymbol) return;

        let symbolsToAdd: SymbolInfo[] = [];

        targetPdfIds.forEach(pdfId => {
            const newSymbol: SymbolInfo = {
                ...sourceSymbol,
                id: `sym_manual_${pdfId}_${Date.now()}_${Math.random()}`,
                pdfId: pdfId,
                count: 0,
                locations: [],
            };
            symbolsToAdd.push(newSymbol);
        });

        commitUpdate({
            ...activeProject,
            symbols: [...activeProject.symbols, ...symbolsToAdd]
        });
        handleCloseCopyModal();
    };

    const handleBackupAll = async () => {
        if (!currentUser) return;
        setIsLoading(true);
        setError(null);
        try {
            await projectService.exportAllBackup(currentUser);
        } catch (err) {
            console.error("Backup failed:", err);
            setError((err as Error).message || "Failed to create backup.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleBackupSingleProject = async () => {
        if (!currentUser || !activeProjectId) return;
        setIsLoading(true);
        setError(null);
        try {
            await projectService.exportSingleProjectBackup(currentUser, activeProjectId);
        } catch (err) {
            console.error("Single project backup failed:", err);
            setError((err as Error).message || "Failed to create project backup.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestoreAll = async (file: File) => {
        if (!currentUser) return;
        if (!window.confirm("Restoring from a full backup will overwrite ALL your current projects and data for this user. This cannot be undone. Are you sure you want to continue?")) {
            return;
        }

        setIsRestoring(true);
        setError(null);
        try {
            const result = await projectService.importAllBackup(currentUser, file);
            if (result.success) {
                alert(result.message); // Alert before reload
                window.location.reload();
            } else {
                setError(result.message);
            }
        } catch (err: any) {
            console.error("Restore failed:", err);
            setError(err.message || "An unexpected error occurred during restore.");
        } finally {
            setIsRestoring(false);
        }
    };

    const handleRestoreSingleProject = async (file: File) => {
        if (!currentUser) return;
    
        setIsRestoring(true);
        setError(null);
        try {
            const result = await projectService.importSingleProjectBackup(currentUser, file);
            if (result.success) {
                alert(result.message); // Alert before reload
                window.location.reload();
            } else {
                setError(result.message);
            }
        } catch (err: any) {
            console.error("Single project restore failed:", err);
            setError(err.message || "An unexpected error occurred during project restore.");
        } finally {
            setIsRestoring(false);
        }
    };

    const reassignableSymbols = useMemo(() => {
        if (!pinToReassign || !activeProject || !activePdfId) return [];

        const currentSymbol = activeProject.symbols.find(s => s.id === pinToReassign.symbolId);
        if (!currentSymbol) return [];

        const potentialSymbols = activeProject.symbols.filter(s => 
            s.pdfId === activePdfId && 
            s.id !== pinToReassign.symbolId
        );

        const currentDisciplineId = currentSymbol.disciplineId;

        if (currentDisciplineId) {
            const findRoot = (discId: string): string => {
                let current = activeProject.disciplines.find(d => d.id === discId);
                while(current && current.parentId) {
                    const parent = activeProject.disciplines.find(d => d.id === current.parentId);
                    if (parent) {
                        current = parent;
                    } else {
                        break;
                    }
                }
                return current ? current.id : discId;
            };

            const getAllDescendants = (rootId: string): Set<string> => {
                 const ids = new Set<string>();
                 const stack: string[] = [rootId];
                 while (stack.length > 0) {
                     const currentId = stack.pop()!;
                     ids.add(currentId);
                     activeProject.disciplines.filter(d => d.parentId === currentId).forEach(child => stack.push(child.id));
                 }
                 return ids;
            }

            const rootId = findRoot(currentDisciplineId);
            const branchIds = getAllDescendants(rootId);
            
            return potentialSymbols.filter(s => s.disciplineId && branchIds.has(s.disciplineId));
        } else {
            // For uncategorized symbols, only show other uncategorized symbols.
            return potentialSymbols.filter(s => !s.disciplineId);
        }
    }, [pinToReassign, activeProject, activePdfId]);

    const symbolsToHighlight = useMemo(() => {
        if (!activeProject || !activePdfId) {
            return [];
        }

        if (mode === 'placing_dots' && activeSymbolId) {
            const symbolToEdit = activeProject.symbols.find(s => s.id === activeSymbolId);
            if (!symbolToEdit || symbolToEdit.page !== currentPage || symbolToEdit.pdfId !== activePdfId) {
                return [];
            }
            
            if (symbolToEdit.disciplineId) {
                // This helper function finds all child disciplines recursively
                const getAllChildDisciplineIds = (dId: string, allIds: Set<string>) => {
                    allIds.add(dId);
                    activeProject.disciplines.forEach(child => {
                        if (child.parentId === dId) {
                            getAllChildDisciplineIds(child.id, allIds);
                        }
                    });
                };
                const disciplineIds = new Set<string>();
                // Start the search from the active symbol's discipline
                getAllChildDisciplineIds(symbolToEdit.disciplineId, disciplineIds);
        
                // Return all symbols that are in this discipline branch, on the current page/pdf
                return activeProject.symbols.filter(s => 
                    s.disciplineId && 
                    disciplineIds.has(s.disciplineId) && 
                    s.page === currentPage && 
                    s.pdfId === activePdfId
                );
            }
            
            // If the symbol has no discipline, only highlight itself
            return [symbolToEdit];
        }

        if (mode !== 'idle' && !mode.startsWith('selecting') && !mode.startsWith('painting') && !mode.startsWith('placing_dali')) {
            return [];
        }

        if (activeSymbolId) {
            const activeSymbol = activeProject.symbols.find(s => s.id === activeSymbolId);
            if (activeSymbol && activeSymbol.page === currentPage && activeSymbol.pdfId === activePdfId) {
                return [activeSymbol];
            }
            return [];
        }
        
        if (activeDisciplineId) {
            const getAllChildDisciplineIds = (dId: string, allIds: Set<string>) => {
                allIds.add(dId);
                activeProject.disciplines.forEach(child => {
                    if (child.parentId === dId) {
                        getAllChildDisciplineIds(child.id, allIds);
                    }
                });
            };
            const disciplineIds = new Set<string>();
            getAllChildDisciplineIds(activeDisciplineId, disciplineIds);

            return activeProject.symbols.filter(s => s.disciplineId && disciplineIds.has(s.disciplineId) && s.page === currentPage && s.pdfId === activePdfId);
        }

        return [];
    }, [activeProject, activePdfId, mode, activeSymbolId, currentPage, activeDisciplineId]);

    if (!currentUser) {
        return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
    }
    
    if (!activeProject) {
        return <ProjectScreen projects={projects} onCreate={handleCreateProject} onLoad={handleLoadProject} onDelete={handleDeleteProject} onRestoreSingleProject={handleRestoreSingleProject} />;
    }
    
    const activeSymbolColor = activeProject.symbols.find(s => s.id === activeSymbolId)?.color;
    const areasForCurrentPdf = activeProject.areas.filter(a => a.pdfId === activePdfId);
    const measurementsForCurrentPdf = activeProject.measurements.filter(m => m.pdfId === activePdfId);
    const manualEntryToEdit = editingManualEntry ? activeProject.measurements.find(m => m.id === editingManualEntry.measurementId)?.manualEntries?.find(e => e.id === editingManualEntry.entryId) : undefined;

    const getSelectionBanner = () => {
        if (mode === 'selecting_manual') {
            return <div className="absolute top-4 bg-blue-500 text-white p-3 rounded-lg shadow-lg z-50">Draw a box around the symbol to add manually. Press 'Escape' to cancel.</div>;
        }
        if (mode === 'placing_dots') {
            return <div className="absolute top-4 bg-blue-500 text-white p-3 rounded-lg shadow-lg z-50">Click to place pins. Press 'Enter' or 'Escape' to finish.</div>;
        }
        if (mode === 'drawing_area') {
            return <div className="absolute top-4 bg-green-500 text-white p-3 rounded-lg shadow-lg z-50">Click to draw polygon points. Press 'Enter' to finish or 'Escape' to cancel.</div>;
        }
        if (mode === 'setting_scale') {
            return <div className="absolute top-4 bg-purple-500 text-white p-3 rounded-lg shadow-lg z-50">Draw a line over a known distance. Press 'Enter' when done or 'Escape' to cancel.</div>;
        }
        if (mode === 'drawing_measurement') {
            const text = activeDrawingMeasurementId ? 'Click to add a new segment. Press \'Enter\' to save.' : 'Click to draw measurement points. Press \'Enter\' to save.';
            return <div className="absolute top-4 bg-purple-500 text-white p-3 rounded-lg shadow-lg z-50">{text} Press 'Escape' to cancel.</div>;
        }
        if (mode === 'placing_dali_device') {
            const network = activeProject?.daliNetworks?.find(n => n.id === activeDaliPlacement?.networkId);
            const deviceTypeName = activeDaliPlacement?.deviceType === 'ECG' ? 'ECG (Gear)' : 'ECD (Control)';
            return <div className="absolute top-4 bg-cyan-500 text-white p-3 rounded-lg shadow-lg z-50">Click to place a {deviceTypeName} for network {network?.name}. Press 'Enter' or 'Escape' to finish.</div>;
        }
        if (mode === 'selecting_dali_painter_source') {
            return <div className="absolute top-4 bg-violet-500 text-white p-3 rounded-lg shadow-lg z-50">Click on a DALI device or PSU to copy its properties. Press 'Escape' to cancel.</div>;
        }
        if (mode === 'painting_dali_device') {
            return <div className="absolute top-4 bg-violet-500 text-white p-3 rounded-lg shadow-lg z-50">Click to place copies. Press 'Enter' or 'Escape' to finish.</div>;
        }
        if (mode === 'painting_dali_psu_location') {
            return <div className="absolute top-4 bg-violet-500 text-white p-3 rounded-lg shadow-lg z-50">Click on other PSUs to apply the location. Press 'Enter' or 'Escape' to finish.</div>;
        }
        if (mode === 'placing_dali_psu') {
            const network = activeProject?.daliNetworks?.find(n => n.id === activeDaliPsuPlacementNetworkId);
            return <div className="absolute top-4 bg-indigo-500 text-white p-3 rounded-lg shadow-lg z-50">Click to place a Power Supply Unit for network {network?.name}. Press 'Escape' to finish.</div>;
        }
        return null;
    }

    return (
        <div className="flex h-screen bg-gray-100 font-sans">
            <Sidebar
                projects={projects}
                activeProject={activeProject}
                onSwitchProject={handleLoadProject}
                onCreateNewProject={() => {setActiveProjectId(null); setActivePdfId(null);}}
                onDeleteProject={handleDeleteProject}
                onLogout={handleLogout}
                activePdfId={activePdfId}
                currentPage={currentPage}
                onSwitchPdf={handleSwitchPdf}
                onAddPdfs={handleAddPdfs}
                onUpdatePdfLevel={handleUpdatePdfLevel}
                onDeletePdf={handleDeletePdf}
                onStartManualSelection={startManualSelection}
                onExportExcel={handleOpenExportModal}
                onExportPdfReport={handleExportPdfReport}
                onExportDaliPdfReport={handleExportDaliPdfReport}
                onViewCounts={() => setIsCountsTableOpen(true)}
                isExporting={isLoading}
                isExportingPdf={isExportingPdf}
                isExportingDaliPdf={isExportingDaliPdf}
                isLoading={isLoading || isRestoring}
                mode={mode}
                onSymbolNameChange={handleSymbolNameChange}
                onSymbolColorChange={handleSymbolColorChange}
                onSymbolImageChange={handleSymbolImageChange}
                onSymbolDelete={handleSymbolDelete}
                onAddPoints={handleAddPoints}
                onOpenCopyModal={handleOpenCopyModal}
                activeSymbolId={activeSymbolId}
                setActiveSymbolId={handleSetActiveSymbol}
                onAddDiscipline={handleAddDiscipline}
                onUpdateDisciplineName={handleUpdateDisciplineName}
                onAssignDiscipline={handleAssignDiscipline}
                activeDisciplineId={activeDisciplineId}
                setActiveDisciplineId={handleSetActiveDiscipline}
                onDeleteDiscipline={handleDeleteDiscipline}
                onUpdateDisciplineParent={handleUpdateDisciplineParent}
                onBackupAll={handleBackupAll}
                onBackupSingleProject={handleBackupSingleProject}
                onRestoreAll={handleRestoreAll}
                onStartAreaDrawing={handleStartAreaDrawing}
                onDeleteArea={handleDeleteArea}
                onUpdateArea={handleUpdateArea}
                onStartSetScale={handleStartSetScale}
                onStartMeasure={handleStartMeasure}
                onStartAddToMeasurement={handleStartAddToMeasurement}
                onUpdateMeasurement={handleUpdateMeasurement}
                onDeleteMeasurement={handleDeleteMeasurement}
                measurements={measurementsForCurrentPdf}
                measurementGroups={activeProject.measurementGroups}
                onAddMeasurementGroup={handleAddMeasurementGroup}
                onUpdateMeasurementGroupName={handleUpdateMeasurementGroupName}
                onDeleteMeasurementGroup={handleDeleteMeasurementGroup}
                onAssignMeasurementToGroup={handleAssignMeasurementToGroup}
                onUpdateMeasurementGroupParent={handleUpdateMeasurementGroupParent}
                scaleInfo={activePdfMetadata?.scaleInfo}
                selectedMeasurementId={selectedMeasurementId}
                onSelectMeasurement={handleSelectMeasurementForEditing}
                onOpenManualLengthModal={handleOpenManualLengthModal}
                onDeleteManualEntry={handleDeleteManualEntry}
                pdfOpacity={pdfOpacity}
                onPdfOpacityChange={handlePdfOpacityChange}
                onAddDaliNetwork={handleAddDaliNetwork}
                onUpdateDaliNetwork={handleUpdateDaliNetwork}
                onDeleteDaliNetwork={handleDeleteDaliNetwork}
                onStartDaliPlacement={handleStartDaliPlacement}
                onOpenEcdSchedule={() => setIsEcdScheduleModalOpen(true)}
                onDaliNetworkHover={setHoveredDaliNetworkId}
                onStartDaliPaintSelection={handleStartDaliPaintSelection}
                showDaliLabels={showDaliLabels}
                onToggleDaliLabels={handleToggleDaliLabels}
                onStartPlacePsu={handleStartPlacePsu}
                onDeletePsu={handleDeletePsu}
                onRenumberDaliNetwork={handleRenumberDaliNetwork}
                onSaveDaliNetworkAsTemplate={handleSaveDaliNetworkAsTemplate}
            />
            <main className="flex-1 flex flex-col items-center justify-center p-4 bg-gray-200 overflow-auto">
                {error && <div className="absolute top-4 bg-red-500 text-white p-3 rounded-lg shadow-lg z-50 animate-pulse" onClick={() => setError(null)}>{error}</div>}
                {getSelectionBanner()}
                <PdfViewer
                    pdfData={activePdfData}
                    mode={mode}
                    onSymbolSelected={handleSymbolSelected}
                    onPlaceDot={handlePlaceDot}
                    onQuickPlaceDot={handleQuickPlaceDot}
                    onLocationDelete={handleLocationDelete}
                    onStartReassignPin={handleStartReassignPin}
                    symbolsToHighlight={symbolsToHighlight}
                    activeSymbolId={activeSymbolId}
                    activeSymbolColor={activeSymbolColor}
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                    onCancelSelection={handleCancelDrawing}
                    onFinishAreaDrawing={handleFinishAreaDrawing}
                    areas={areasForCurrentPdf}
                    drawingPoints={drawingPoints}
                    onDrawPoint={handleDrawPoint}
                    measurements={measurementsForCurrentPdf}
                    scaleInfo={activePdfMetadata?.scaleInfo}
                    activeDrawingMeasurementId={activeDrawingMeasurementId}
                    selectedMeasurementId={selectedMeasurementId}
                    onOpenManualLengthModal={handleOpenManualLengthModal}
                    onStartCreateLinearComponent={handleStartCreateLinearComponent}
                    onDeleteMeasurementSegment={handleDeleteMeasurementSegment}
                    onStartDragMeasurementNode={handleStartDragMeasurementNode}
                    onUpdateMeasurementPoint={handleUpdateMeasurementPoint}
                    onEndDragMeasurementNode={handleEndDragMeasurementNode}
                    pdfOpacity={pdfOpacity}
                    daliNetworks={activeProject.daliNetworks || []}
                    daliDevices={activeProject.daliDevices?.filter(d => d.pdfId === activePdfId) || []}
                    ecdTypes={activeProject.ecdTypes || []}
                    onPlaceDaliDevice={handlePlaceDaliDevice}
                    onDeleteDaliDevice={handleDeleteDaliDevice}
                    onStartEditEcdDevice={handleStartEditEcdDevice}
                    activeDaliPlacement={activeDaliPlacement}
                    hoveredDaliNetworkId={hoveredDaliNetworkId}
                    onDaliNetworkHover={setHoveredDaliNetworkId}
                    onDaliDevicePickedForPainting={handleDaliDevicePicked}
                    onDaliPsuPickedForPainting={handleDaliPsuPickedForPainting}
                    onPaintDaliDevice={handlePaintDaliDevice}
                    onPaintDaliPsuLocation={handlePaintDaliPsuLocation}
                    daliDeviceToPaint={daliDeviceToPaint}
                    daliPsuLocationToPaint={daliPsuLocationToPaint}
                    showDaliLabels={showDaliLabels}
                    onPlacePsu={handlePlacePsu}
                    onDeletePsu={handleDeletePsu}
                    onStartEditPsuLocation={handleStartEditPsuLocation}
                    activeDaliPsuPlacementNetworkId={activeDaliPsuPlacementNetworkId}
                    activePdfId={activePdfId}
                />
            </main>
            <CopySymbolModal
                isOpen={!!symbolToCopy}
                onClose={handleCloseCopyModal}
                onCopy={handleCopySymbols}
                symbolToCopy={symbolToCopy}
                pdfsInProject={activeProject.pdfs}
            />
            <AddPdfsModal
                isOpen={!!filesToAdd}
                onClose={() => setFilesToAdd(null)}
                onAdd={handleConfirmAddPdfs}
                files={filesToAdd || []}
            />
            <ExportExcelModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                onConfirm={handleConfirmExport}
                isExporting={isLoading}
            />
            <ExportPdfModal
                isOpen={isExportPdfModalOpen}
                onClose={() => setIsExportPdfModalOpen(false)}
                onConfirm={handleConfirmExportPdfReport}
                isExporting={isExportingPdf}
            />
            <ReassignSymbolModal
                isOpen={!!pinToReassign}
                onClose={() => setPinToReassign(null)}
                onConfirm={handleConfirmReassignPin}
                currentSymbol={activeProject.symbols.find(s => s.id === pinToReassign?.symbolId)}
                availableSymbols={reassignableSymbols}
                disciplines={activeProject.disciplines}
            />
            <AreaNamingModal
                isOpen={isNamingArea}
                onClose={handleCancelDrawing}
                onConfirm={handleCreateArea}
            />
            <CountsTableModal
                isOpen={isCountsTableOpen}
                onClose={() => setIsCountsTableOpen(false)}
                project={activeProject}
            />
            <ScaleModal
                isOpen={isScaleModalOpen}
                onClose={handleCancelDrawing}
                onConfirm={handleConfirmScale}
            />
            <ManualLengthModal
                isOpen={!!editingManualEntry}
                onClose={() => setEditingManualEntry(null)}
                onConfirm={handleSaveManualLength}
                initialLength={manualEntryToEdit?.length}
            />
            <LinearComponentModal
                isOpen={isLinearComponentModalOpen}
                onClose={() => setIsLinearComponentModalOpen(false)}
                onConfirm={handleConfirmCreateLinearComponent}
                project={activeProject}
            />
            <EcdTypeAssignModal
                isOpen={!!editingEcdDevice}
                onClose={() => setEditingEcdDevice(null)}
                onConfirm={handleAssignEcdTypeToDevice}
                ecdTypes={activeProject.ecdTypes || []}
                device={editingEcdDevice}
            />
            <EcdScheduleModal
                isOpen={isEcdScheduleModalOpen}
                onClose={() => setIsEcdScheduleModalOpen(false)}
                ecdTypes={activeProject.ecdTypes || []}
                onAdd={handleAddEcdType}
                onUpdate={handleUpdateEcdType}
                onDelete={handleDeleteEcdType}
            />
            <PsuLocationModal
                isOpen={!!editingPsuNetwork}
                onClose={() => setEditingPsuNetwork(null)}
                onConfirm={handleSavePsuLocation}
                initialLocation={editingPsuNetwork?.psuLocation?.location}
            />
        </div>
    );
};

export default App;



import React, { useRef, useEffect, useState, useCallback, useLayoutEffect } from 'react';
import type { Location, SymbolInfo, Area, LinearMeasurement, ScaleInfo, ManualEntry, DaliNetwork, DaliDevice, DaliDeviceType, EcdType, PsuLocation } from '../types';
import { LoadingIcon, AddIcon, PsuIcon } from './icons';
import { measurementService } from '../services/measurementService';

// Since pdf.js is loaded from a script tag, we declare its global variable.
declare const pdfjsLib: any;

interface PdfViewerProps {
    pdfData: string | null;
    mode: string;
    onSymbolSelected: (symbolImage: string) => void;
    onPlaceDot: (pos: { x: number; y: number }) => void;
    onQuickPlaceDot: (pos: { x: number; y: number }) => void;
    onLocationDelete: (symbolId: string, locationIndex: number) => void;
    onStartReassignPin: (symbolId: string, locationIndex: number) => void;
    symbolsToHighlight: SymbolInfo[];
    activeSymbolId: string | null;
    activeSymbolColor?: string;
    currentPage: number;
    setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
    onCancelSelection: () => void;
    onFinishAreaDrawing: () => void;
    areas: Area[];
    drawingPoints: { x: number; y: number }[];
    onDrawPoint: (point: { x: number; y: number }) => void;
    measurements: LinearMeasurement[];
    scaleInfo: ScaleInfo | undefined;
    activeDrawingMeasurementId: string | null;
    selectedMeasurementId: string | null;
    onOpenManualLengthModal: (measurementId: string, segmentIndex: number, pointIndex: number, entry?: ManualEntry) => void;
    onStartCreateLinearComponent: (point: { x: number; y: number; }) => void;
    onDeleteMeasurementSegment: (measurementId: string, segmentIndex: number) => void;
    onStartDragMeasurementNode: (measurementId: string, segmentIndex: number, pointIndex: number) => void;
    onUpdateMeasurementPoint: (newPoint: {x: number, y: number}) => void;
    onEndDragMeasurementNode: () => void;
    pdfOpacity: number;
    // DALI Props
    daliNetworks: DaliNetwork[];
    daliDevices: DaliDevice[];
    ecdTypes: EcdType[];
    onPlaceDaliDevice: (pos: { x: number; y: number }) => void;
    onDeleteDaliDevice: (deviceId: string) => void;
    onStartEditEcdDevice: (deviceId: string) => void;
    activeDaliPlacement: { networkId: string; deviceType: DaliDeviceType } | null;
    hoveredDaliNetworkId: string | null;
    onDaliNetworkHover: (networkId: string | null) => void;
    onDaliDevicePickedForPainting: (device: DaliDevice) => void;
    onDaliPsuPickedForPainting: (network: DaliNetwork) => void;
    onPaintDaliDevice: (pos: { x: number; y: number }) => void;
    onPaintDaliPsuLocation: (networkId: string) => void;
    daliDeviceToPaint: { deviceType: DaliDeviceType } | null;
    daliPsuLocationToPaint: string | null;
    showDaliLabels: boolean;
    onPlacePsu: (pos: { x: number; y: number }) => void;
    onDeletePsu: (networkId: string) => void;
    onStartEditPsuLocation: (networkId: string) => void;
    activeDaliPsuPlacementNetworkId: string | null;
    activePdfId: string | null;
}

const MAGNIFIER_SIZE = 160;
const MAGNIFIER_ZOOM = 2.5;

// --- Helper Functions ---

const pointToLineSegmentDistance = (p: {x: number, y: number}, p1: {x: number, y: number}, p2: {x: number, y: number}): number => {
    const l2 = Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2);
    if (l2 === 0) return Math.sqrt(Math.pow(p.x - p1.x, 2) + Math.pow(p.y - p1.y, 2));
    let t = ((p.x - p1.x) * (p2.x - p1.x) + (p.y - p1.y) * (p2.y - p1.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projection = {
        x: p1.x + t * (p2.x - p1.x),
        y: p1.y + t * (p2.y - p1.y),
    };
    return Math.sqrt(Math.pow(p.x - projection.x, 2) + Math.pow(p.y - projection.y, 2));
};

// --- Drawing Helper Functions ---

const drawPin = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, fill: string, stroke: string) => {
    ctx.save();
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;

    // Pin Body (Triangle pointing up to the pin head)
    ctx.beginPath();
    ctx.moveTo(x, y); // Tip of the pin
    ctx.lineTo(x - size, y - size * 2);
    ctx.lineTo(x + size, y - size * 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Pin Head (Circle)
    ctx.beginPath();
    ctx.arc(x, y - size * 2, size, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    
    ctx.restore();
};

const drawDaliHighlightOnCanvas = (ctx: CanvasRenderingContext2D, devices: DaliDevice[], hoveredNetworkId: string | null, scale: number, time: number) => {
    if (!hoveredNetworkId) return;

    devices.forEach(device => {
        if (device.networkId === hoveredNetworkId) {
            const loc = device.location;
            const isEcg = device.type === 'ECG';
            const size = isEcg ? 5 : 7;
            const centerX = (loc.x + loc.width / 2) * scale;
            const centerY = (loc.y + loc.height - size) * scale;
            
            const pulseRadius = 15 + Math.sin(time / 200) * 4;
            const pulseAlpha = 0.5 + Math.sin(time / 200) * 0.3;
            
            ctx.save();
            ctx.beginPath();
            ctx.arc(centerX, centerY, pulseRadius, 0, 2 * Math.PI);
            ctx.fillStyle = `rgba(255, 193, 7, ${pulseAlpha})`; // Amber/gold color
            ctx.fill();
            ctx.restore();
        }
    });
};


const drawDaliDeviceOnCanvas = (ctx: CanvasRenderingContext2D, device: DaliDevice, network: DaliNetwork | undefined, ecdType: EcdType | undefined, scale: number, showDaliLabels: boolean) => {
    if (!network) return;

    const isEcg = device.type === 'ECG';
    const color = isEcg ? '#f97316' : '#06b6d4'; // orange-500 for ECG, cyan-500 for ECD
    const size = 5;

    const loc = device.location;
    const pinTipX = (loc.x + loc.width / 2) * scale;
    const pinTipY = (loc.y + loc.height) * scale;

    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;

    // Draw shape
    ctx.beginPath();
    if (isEcg) {
        ctx.arc(pinTipX, pinTipY - size, size, 0, 2 * Math.PI);
    } else {
        ctx.rect(pinTipX - size, pinTipY - size * 2, size * 2, size * 2);
    }
    ctx.fill();
    ctx.stroke();

    // Draw text
    if (showDaliLabels) {
        const address = isEcg ? String(device.shortAddress).padStart(2, '0') : device.shortAddress;
        const ecdRef = ecdType ? ` [${ecdType.reference}]` : '';
        const label = `${network.name}.${address}${ecdRef}`;
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, pinTipX, pinTipY - size * 3.5);
    }

    ctx.restore();
};

const drawDaliPsuOnCanvas = (ctx: CanvasRenderingContext2D, loc: PsuLocation, scale: number) => {
    const centerX = (loc.x + loc.width / 2) * scale;
    const centerY = (loc.y + loc.height / 2) * scale;
    
    ctx.save();
    ctx.strokeStyle = '#4f46e5'; // indigo-600
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw power symbol path
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - 6);
    ctx.lineTo(centerX, centerY + 6);
    ctx.moveTo(centerX - 5, centerY - 3);
    ctx.lineTo(centerX, centerY);
    ctx.lineTo(centerX + 5, centerY - 3);
    ctx.moveTo(centerX - 5, centerY + 3);
    ctx.lineTo(centerX, centerY);
    ctx.lineTo(centerX + 5, centerY + 3);

    ctx.stroke();

    // Draw circle around it
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 10, 0, 2 * Math.PI);
    ctx.stroke();
    
    // Draw location text
    if (loc.location) {
        ctx.fillStyle = '#4f46e5';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(loc.location, centerX, centerY + 18); // Position text below the icon
    }

    ctx.restore();
};

const drawAreasOnCanvas = (ctx: CanvasRenderingContext2D, areas: Area[], scale: number) => {
    areas.forEach(area => {
        if (!area.isVisible || area.points.length < 2) return;
        
        ctx.save();
        ctx.fillStyle = area.color + '33'; // Semi-transparent fill
        ctx.strokeStyle = area.color;
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(area.points[0].x * scale, area.points[0].y * scale);
        for (let i = 1; i < area.points.length; i++) {
            ctx.lineTo(area.points[i].x * scale, area.points[i].y * scale);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        let centerX = area.points.reduce((sum, p) => sum + p.x, 0) / area.points.length;
        let centerY = area.points.reduce((sum, p) => sum + p.y, 0) / area.points.length;
        ctx.fillStyle = area.color;
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(area.name, centerX * scale, centerY * scale);
        ctx.restore();
    });
};

const drawMeasurementsOnCanvas = (
    ctx: CanvasRenderingContext2D, 
    measurements: LinearMeasurement[], 
    scaleInfo: ScaleInfo | undefined, 
    selectedMeasurementId: string | null, 
    scale: number, 
    mode: string, 
    hoveringNode: { measurementId: string, segmentIndex: number, pointIndex: number } | null,
    isShiftPressed: boolean
) => {
    measurements.filter(m => m.isVisible).forEach(measurement => {
        const isSelectedForEditing = mode === 'idle' && selectedMeasurementId === measurement.id;
        ctx.save();
        ctx.strokeStyle = measurement.color;
        ctx.lineWidth = isSelectedForEditing ? 5 : 3;
        ctx.lineCap = 'round';
        
        measurement.points.forEach(segment => {
            if(segment.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(segment[0].x * scale, segment[0].y * scale);
            for (let i = 1; i < segment.length; i++) {
                ctx.lineTo(segment[i].x * scale, segment[i].y * scale);
            }
            ctx.stroke();
        });
        
        if (scaleInfo) {
            const length = measurementService.calculateTotalLength(measurement, scaleInfo);
            const lengthText = measurementService.formatLength(length);
            const lastSegment = measurement.points[measurement.points.length - 1];
            const lastPoint = lastSegment[lastSegment.length - 1];
            ctx.fillStyle = measurement.color;
            ctx.font = 'bold 14px sans-serif';
            ctx.fillText(`${measurement.name}: ${lengthText}`, lastPoint.x * scale + 8, lastPoint.y * scale - 8);
        }
        
        if (isSelectedForEditing) {
            measurement.points.forEach((segment, segIdx) => {
                segment.forEach((point, ptIdx) => {
                    const scaledX = point.x * scale;
                    const scaledY = point.y * scale;

                    const isHovered = hoveringNode?.measurementId === measurement.id && hoveringNode.segmentIndex === segIdx && hoveringNode.pointIndex === ptIdx;
                    const canDrag = isHovered && isShiftPressed;
                    
                    ctx.fillStyle = '#ffffff';
                    ctx.lineWidth = canDrag ? 3 : 2;
                    ctx.strokeStyle = canDrag ? '#3b82f6' : measurement.color; // blue-500 for drag highlight
                    const radius = canDrag ? 8 : 6;

                    ctx.beginPath();
                    ctx.arc(scaledX, scaledY, radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();

                    const manualEntry = (measurement.manualEntries || []).find(e => e.segmentIndex === segIdx && e.pointIndex === ptIdx);
                    if(manualEntry) {
                        ctx.fillStyle = measurement.color;
                        ctx.font = 'bold 12px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        const tagText = `+${measurementService.formatLength(manualEntry.length)}`;
                        const textMetrics = ctx.measureText(tagText);
                        const padding = 4;
                        ctx.globalAlpha = 0.8;
                        ctx.fillRect(scaledX - textMetrics.width/2 - padding, scaledY - 22 - padding, textMetrics.width + padding*2, 14 + padding*2);
                        ctx.fillStyle = '#ffffff';
                        ctx.globalAlpha = 1.0;
                        ctx.fillText(tagText, scaledX, scaledY - 15);
                    }
                });
            });
        }
        ctx.restore();
    });
};

const drawSymbolHighlightsOnCanvas = (ctx: CanvasRenderingContext2D, symbolsToHighlight: SymbolInfo[], scale: number, time: number, mode: string, activeSymbolId: string | null) => {
    symbolsToHighlight.forEach(symbol => {
        const isPrimaryPlacing = mode === 'placing_dots' && symbol.id === activeSymbolId;
        const isSecondaryPlacing = mode === 'placing_dots' && symbol.id !== activeSymbolId;

        // When placing dots, use a simpler opacity-based highlight to avoid distraction.
        if (mode === 'placing_dots') {
            let alpha = 1.0;
            if (isPrimaryPlacing) alpha = 0.9;
            else if (isSecondaryPlacing) alpha = 0.3;
            else alpha = 0.9; // Default for placing mode if something else gets highlighted
            
            const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, '0');
            const fill = symbol.color + alphaHex;
            
            symbol.locations.forEach(loc => {
                const pinTipX = (loc.x + loc.width / 2) * scale;
                const pinTipY = (loc.y + loc.height) * scale;
                drawPin(ctx, pinTipX, pinTipY, 8, fill, symbol.color);
            });
            return; // Done for this symbol
        }
        
        // For idle selection, apply the glow effect.
        const hexColor = symbol.color;
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        const pulseAlpha = 0.5 + Math.sin(time / 200) * 0.3;
        const glowFillStyle = `rgba(${r}, ${g}, ${b}, ${pulseAlpha})`;
        
        const pulseRadius = 15 + Math.sin(time / 200) * 4;

        symbol.locations.forEach(loc => {
            const pinSize = 8;
            const pinTipX = (loc.x + loc.width / 2) * scale;
            const pinTipY = (loc.y + loc.height) * scale;
            const pinHeadCenterX = pinTipX;
            const pinHeadCenterY = pinTipY - (pinSize * 2);

            // 1. Draw the glow
            ctx.save();
            ctx.beginPath();
            ctx.arc(pinHeadCenterX, pinHeadCenterY, pulseRadius, 0, 2 * Math.PI);
            ctx.fillStyle = glowFillStyle;
            ctx.fill();
            ctx.restore();

            // 2. Draw the solid pin on top
            drawPin(ctx, pinTipX, pinTipY, pinSize, symbol.color, symbol.color);
        });
    });
};

const drawActiveDrawingOnCanvas = (ctx: CanvasRenderingContext2D, drawingPoints: {x:number, y:number}[], mousePos: {x:number, y:number} | null, mode: string, scale: number, isShiftPressed: boolean, scaleInfo: ScaleInfo | undefined, measurements: LinearMeasurement[], activeDrawingMeasurementId: string | null) => {
    const isMeasureMode = mode === 'drawing_measurement';
    const currentMeasurement = measurements.find(m => m.id === activeDrawingMeasurementId);
    const color = mode === 'drawing_area' ? '#10B981' : (currentMeasurement?.color || '#8B5CF6');

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.fillStyle = color + '4D';
    
    ctx.beginPath();
    ctx.moveTo(drawingPoints[0].x * scale, drawingPoints[0].y * scale);
    for(let i = 1; i < drawingPoints.length; i++) {
        ctx.lineTo(drawingPoints[i].x * scale, drawingPoints[i].y * scale);
    }

    let previewPos = mousePos;
    if (isMeasureMode && isShiftPressed && mousePos && drawingPoints.length > 0) {
        const lastPoint = drawingPoints[drawingPoints.length - 1];
        const lastScaledPoint = { x: lastPoint.x * scale, y: lastPoint.y * scale };
        const dx = mousePos.x - lastScaledPoint.x;
        const dy = mousePos.y - lastScaledPoint.y;

        if (Math.abs(dx) > Math.abs(dy)) {
            previewPos = { x: mousePos.x, y: lastScaledPoint.y };
        } else {
            previewPos = { x: lastScaledPoint.x, y: mousePos.y };
        }
    }

    if (previewPos) {
        ctx.lineTo(previewPos.x, previewPos.y);
    }
    ctx.stroke();

    if(mode === 'drawing_area' && drawingPoints.length > 2) {
         ctx.closePath();
         ctx.fill();
    }

    if (isMeasureMode && previewPos && scaleInfo) {
        let newSegmentPixels = 0;
        const unscaledPreviewPos = { x: previewPos.x / scale, y: previewPos.y / scale };
        const allPoints = [...drawingPoints, unscaledPreviewPos];
         for (let i = 0; i < allPoints.length - 1; i++) {
            const p1 = allPoints[i];
            const p2 = allPoints[i+1];
            newSegmentPixels += Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        }
        const unitsPerPixel = scaleInfo.knownLength / scaleInfo.linePixels;
        const newLengthInMeters = newSegmentPixels * unitsPerPixel;

        let lengthText = `Segment: ${measurementService.formatLength(newLengthInMeters)}`;

        if(currentMeasurement) {
            const existingLengthInMeters = measurementService.calculateTotalLength(currentMeasurement, scaleInfo);
            const totalLength = existingLengthInMeters + newLengthInMeters;
            lengthText = `Total: ${measurementService.formatLength(totalLength)} (+${measurementService.formatLength(newLengthInMeters)})`;
        }
        
        ctx.fillStyle = color;
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(lengthText, previewPos.x + 10, previewPos.y - 10);
    }

    drawingPoints.forEach(p => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x * scale, p.y * scale, 4, 0, 2 * Math.PI);
        ctx.fill();
    });
    ctx.restore();
}


export const PdfViewer: React.FC<PdfViewerProps> = ({
    pdfData,
    mode,
    onSymbolSelected,
    onPlaceDot,
    onQuickPlaceDot,
    onLocationDelete,
    onStartReassignPin,
    symbolsToHighlight,
    activeSymbolId,
    activeSymbolColor,
    currentPage,
    setCurrentPage,
    onCancelSelection,
    onFinishAreaDrawing,
    areas,
    drawingPoints,
    onDrawPoint,
    measurements,
    scaleInfo,
    activeDrawingMeasurementId,
    selectedMeasurementId,
    onOpenManualLengthModal,
    onStartCreateLinearComponent,
    onDeleteMeasurementSegment,
    onStartDragMeasurementNode,
    onUpdateMeasurementPoint,
    onEndDragMeasurementNode,
    pdfOpacity,
    daliNetworks,
    daliDevices,
    ecdTypes,
    onPlaceDaliDevice,
    onDeleteDaliDevice,
    onStartEditEcdDevice,
    activeDaliPlacement,
    hoveredDaliNetworkId,
    onDaliNetworkHover,
    onDaliDevicePickedForPainting,
    onDaliPsuPickedForPainting,
    onPaintDaliDevice,
    onPaintDaliPsuLocation,
    daliDeviceToPaint,
    daliPsuLocationToPaint,
    showDaliLabels,
    onPlacePsu,
    onDeletePsu,
    onStartEditPsuLocation,
    activeDaliPsuPlacementNetworkId,
    activePdfId,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const magnifierCanvasRef = useRef<HTMLCanvasElement>(null);
    const viewerContainerRef = useRef<HTMLDivElement>(null);
    const scrollTargetRef = useRef<{left: number, top: number} | null>(null);
    const renderTaskRef = useRef<any>(null); // To manage pdf.js render tasks
    const animationFrameRef = useRef<number | null>(null);
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [numPages, setNumPages] = useState<number>(0);
    const [isRendering, setIsRendering] = useState<boolean>(false);
    const [scale, setScale] = useState(1.5);

    const [selection, setSelection] = useState<Location | null>(null);
    const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
    const [hoveringElement, setHoveringElement] = useState<{type: 'pin' | 'dali' | 'psu', id: string, index?: number} | null>(null);
    const [mousePos, setMousePos] = useState<{x: number; y: number} | null>(null);
    const [isMagnifying, setIsMagnifying] = useState(false);
    const [isCtrlPressed, setIsCtrlPressed] = useState(false);
    const [isShiftPressed, setIsShiftPressed] = useState(false);
    
    // State for measurement modification
    const [isDraggingNode, setIsDraggingNode] = useState(false);
    const [hoveringSegment, setHoveringSegment] = useState<{ measurementId: string, segmentIndex: number, midPoint: {x: number, y: number} } | null>(null);
    const [hoveringNode, setHoveringNode] = useState<{ measurementId: string, segmentIndex: number, pointIndex: number } | null>(null);
    
    // DALI hover state
    const viewerHoveredPsuNetworkRef = useRef<string | null>(null);

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const overlayCanvas = overlayCanvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
        if(overlayCanvas) {
            const ctx = overlayCanvas.getContext('2d');
            ctx?.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        }
    }

    useEffect(() => {
        if (typeof pdfjsLib === 'undefined') {
            console.error('pdf.js is not loaded.');
            return;
        }
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

        if (!pdfData) {
            setPdfDoc(null);
            setNumPages(0);
            clearCanvas();
            return;
        }

        const pdfDataSource = pdfData.split(',');
        if (pdfDataSource.length < 2 || !pdfDataSource[1]) {
            console.error("Invalid PDF data: not a valid data URL.");
            setPdfDoc(null);
            setNumPages(0);
            return;
        }
        const loadingTask = pdfjsLib.getDocument({ data: atob(pdfDataSource[1]) });
        loadingTask.promise.then((doc: any) => {
            setPdfDoc(doc);
            setNumPages(doc.numPages);
        }).catch((error: any) => {
            console.error("Error loading PDF:", error);
        });
    }, [pdfData]);
    
    const renderPage = useCallback(async (pageNum: number) => {
        if (!pdfDoc) return;
        
        if (renderTaskRef.current) {
            renderTaskRef.current.cancel();
        }
        
        setIsRendering(true);
        try {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale });
            const canvas = canvasRef.current;
            const overlayCanvas = overlayCanvasRef.current;
            if (!canvas || !overlayCanvas) return;

            const context = canvas.getContext('2d');
            if (!context) return;
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            overlayCanvas.height = viewport.height;
            overlayCanvas.width = viewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: viewport,
            };
            
            const task = page.render(renderContext);
            renderTaskRef.current = task;
            
            await task.promise;
            
            renderTaskRef.current = null;

        } catch(e: any) {
            if (e.name !== 'RenderingCancelledException') {
                console.error("Error rendering page", e);
            }
        } finally {
            setIsRendering(false);
        }
    }, [pdfDoc, scale]);


    useEffect(() => {
        if (pdfDoc) {
            renderPage(currentPage);
        }
    }, [pdfDoc, currentPage, renderPage]);

    useLayoutEffect(() => {
        if (scrollTargetRef.current && viewerContainerRef.current) {
            viewerContainerRef.current.scrollLeft = scrollTargetRef.current.left;
            viewerContainerRef.current.scrollTop = scrollTargetRef.current.top;
            scrollTargetRef.current = null;
        }
    }, [scale]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.style.opacity = String(pdfOpacity);
        }
    }, [pdfOpacity]);
    
    // Effect for detecting global key presses (Ctrl for reassign, Alt for magnify)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onCancelSelection();
            }
            if (e.key === 'Control') setIsCtrlPressed(true);
            if (e.key === 'Shift') setIsShiftPressed(true);
            if (e.key === 'Alt' && (mode === 'placing_dots' || mode.startsWith('painting_dali') || mode.startsWith('placing_dali')) && !isMagnifying) {
                e.preventDefault();
                setIsMagnifying(true);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Control') setIsCtrlPressed(false);
            if (e.key === 'Shift') setIsShiftPressed(false);
            if (e.key === 'Alt') {
                 e.preventDefault();
                 setIsMagnifying(false);
            }
        };

        const handleBlur = () => {
             setIsMagnifying(false);
             setIsCtrlPressed(false);
             setIsShiftPressed(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
        };
    }, [mode, isMagnifying, onCancelSelection]);


    useEffect(() => {
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
    
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
    
        const hasHighlights = symbolsToHighlight.length > 0;
        const showPinPreview = (mode === 'placing_dots' || mode === 'placing_dali_device' || mode === 'painting_dali_device' || mode === 'placing_dali_psu') && mousePos && !isMagnifying;
        const isDrawing = drawingPoints.length > 0 && (mode === 'drawing_area' || mode === 'setting_scale' || mode === 'drawing_measurement');
        const showHoverTooltip = (hoveringElement?.type === 'pin' && hoveringElement.id && typeof hoveringElement.index === 'number') || hoveringElement?.type === 'dali' || hoveringElement?.type === 'psu';
        const daliMap = new Map(daliNetworks.map(n => [n.id, n]));
        const ecdTypeMap = new Map((ecdTypes || []).map(t => [t.id, t]));
        const daliDevicesOnPage = daliDevices.filter(d => d.page === currentPage);
        const hasDali = daliDevicesOnPage.length > 0 || daliNetworks.some(n => n.psuLocation?.pdfId === activePdfId && n.psuLocation?.page === currentPage);

        const animate = (time: number) => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            drawAreasOnCanvas(ctx, areas, scale);
            drawMeasurementsOnCanvas(ctx, measurements, scaleInfo, selectedMeasurementId, scale, mode, hoveringNode, isShiftPressed);
            
            drawDaliHighlightOnCanvas(ctx, daliDevicesOnPage, hoveredDaliNetworkId, scale, time);

            if (hasHighlights) {
                drawSymbolHighlightsOnCanvas(ctx, symbolsToHighlight, scale, time, mode, activeSymbolId);
            }

            if(hasDali) {
                daliNetworks.forEach(network => {
                    if (network.isVisible && network.psuLocation) {
                        const psuLoc = network.psuLocation;
                        if (psuLoc.pdfId === activePdfId && psuLoc.page === currentPage) {
                             drawDaliPsuOnCanvas(ctx, psuLoc, scale);
                        }
                    }
                });
                daliDevicesOnPage.forEach(device => {
                    const network = daliMap.get(device.networkId);
                    const ecdType = device.ecdTypeId ? ecdTypeMap.get(device.ecdTypeId) : undefined;
                    if (network?.isVisible) {
                        drawDaliDeviceOnCanvas(ctx, device, network, ecdType, scale, showDaliLabels);
                    }
                });
            }

            if (showPinPreview) {
                if (mode === 'placing_dots' && activeSymbolColor) {
                    drawPin(ctx, mousePos!.x, mousePos!.y, 8, activeSymbolColor + 'aa', activeSymbolColor);
                } else if (mode === 'placing_dali_psu' && mousePos) {
                    ctx.save();
                    ctx.globalAlpha = 0.7;
                    const PSU_SIZE = 10;
                    const dummyLocation: PsuLocation = {
                        x: (mousePos.x / scale) - PSU_SIZE,
                        y: (mousePos.y / scale) - PSU_SIZE,
                        width: PSU_SIZE * 2,
                        height: PSU_SIZE * 2,
                        pdfId: activePdfId!, 
                        page: currentPage
                    };
                    drawDaliPsuOnCanvas(ctx, dummyLocation, scale);
                    ctx.restore();
                } else {
                    let placementInfo: { deviceType: DaliDeviceType } | null = null;
                    if (mode === 'placing_dali_device' && activeDaliPlacement) {
                        placementInfo = { deviceType: activeDaliPlacement.deviceType };
                    } else if (mode === 'painting_dali_device' && daliDeviceToPaint) {
                        placementInfo = { deviceType: daliDeviceToPaint.deviceType };
                    }
                    if (placementInfo && mousePos) {
                         const isEcg = placementInfo.deviceType === 'ECG';
                         const color = isEcg ? '#f97316' : '#06b6d4';
                         const size = 5;
                         ctx.fillStyle = color + 'aa';
                         ctx.strokeStyle = color;
                         ctx.lineWidth = 1;
                         ctx.beginPath();
                        if (isEcg) {
                            ctx.arc(mousePos.x, mousePos.y - size, size, 0, 2 * Math.PI);
                        } else {
                            ctx.rect(mousePos.x - size, mousePos.y - size * 2, size * 2, size * 2);
                        }
                        ctx.fill();
                        ctx.stroke();
                    }
                }
            }
            if (selection) {
                ctx.strokeStyle = '#0ea5e9';
                ctx.lineWidth = 2;
                ctx.strokeRect(selection.x, selection.y, selection.width, selection.height);
            }
            if (isDrawing) {
                drawActiveDrawingOnCanvas(ctx, drawingPoints, mousePos, mode, scale, isShiftPressed, scaleInfo, measurements, activeDrawingMeasurementId);
            }
            if (hoveringSegment) {
                const { midPoint } = hoveringSegment;
                ctx.save();
                ctx.fillStyle = 'rgba(239, 68, 68, 0.8)'; // red-500 with transparency
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(midPoint.x, midPoint.y, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2.5;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(midPoint.x - 4, midPoint.y - 4);
                ctx.lineTo(midPoint.x + 4, midPoint.y + 4);
                ctx.moveTo(midPoint.x + 4, midPoint.y - 4);
                ctx.lineTo(midPoint.x - 4, midPoint.y + 4);
                ctx.stroke();
                ctx.restore();
            }
            if (showHoverTooltip) {
                let text = '';
                let pinTipX = 0, pinTipY = 0;
                 if (mode === 'painting_dali_psu_location' && hoveringElement?.type === 'psu' && daliPsuLocationToPaint) {
                    text = `Apply: "${daliPsuLocationToPaint}"`;
                    const network = daliNetworks.find(n => n.id === hoveringElement!.id);
                    if (network?.psuLocation) {
                        const loc = network.psuLocation;
                        pinTipX = (loc.x + loc.width / 2) * scale;
                        pinTipY = (loc.y + loc.height / 2) * scale;
                    }
                } else if (hoveringElement?.type === 'pin' && hoveringElement.id && typeof hoveringElement.index === 'number') {
                    const symbol = symbolsToHighlight.find(s => s.id === hoveringElement!.id);
                    if (symbol) {
                        const loc = symbol.locations[hoveringElement!.index!];
                        if (loc) {
                            pinTipX = (loc.x + loc.width / 2) * scale;
                            pinTipY = (loc.y + loc.height) * scale;
                            text = symbol.name;
                        }
                    }
                } else if (hoveringElement?.type === 'dali') {
                    const device = daliDevices.find(d => d.id === hoveringElement!.id);
                    const network = device ? daliNetworks.find(n => n.id === device.networkId) : undefined;
                     if(device && network) {
                        const loc = device.location;
                        pinTipX = (loc.x + loc.width / 2) * scale;
                        pinTipY = (loc.y + loc.height) * scale;
                        const address = device.type === 'ECG' ? String(device.shortAddress).padStart(2, '0') : device.shortAddress;
                        let ecdRefText = '';
                        if(device.type === 'ECD' && device.ecdTypeId) {
                            const type = ecdTypeMap.get(device.ecdTypeId);
                            if (type) ecdRefText = ` [${type.reference}]`;
                        }
                        text = `${network.name}.${address} (${device.type})${ecdRefText}`;
                    }
                } else if (hoveringElement?.type === 'psu') {
                    const network = daliNetworks.find(n => n.id === hoveringElement!.id);
                    if(network && network.psuLocation) {
                        const psuLoc = network.psuLocation;
                        if (psuLoc.pdfId === activePdfId && psuLoc.page === currentPage) {
                            const loc = psuLoc;
                            pinTipX = (loc.x + loc.width / 2) * scale;
                            pinTipY = (loc.y + loc.height / 2) * scale;
                            let psuText = `${network.name} PSU`;
                            if (loc.location) {
                                psuText += ` - ${loc.location}`;
                            }
                            text = psuText;
                        }
                    }
                }

                if (text) {
                    ctx.font = 'bold 12px sans-serif';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'bottom';
                    const textMetrics = ctx.measureText(text);
                    const padding = 5;
                    const rectWidth = textMetrics.width + padding * 2;
                    const rectHeight = 14 + padding * 2;
                    const rectX = pinTipX + 10;
                    const rectY = pinTipY - rectHeight - 10;
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                    ctx.beginPath();
                    ctx.roundRect(rectX, rectY, rectWidth, rectHeight, 4);
                    ctx.fill();
                    ctx.fillStyle = 'white';
                    ctx.fillText(text, rectX + padding, rectY + rectHeight - padding);
                }
            }
            animationFrameRef.current = requestAnimationFrame(animate);
        };
        
        if (hasHighlights || showPinPreview || selection || areas.length > 0 || isDrawing || measurements.length > 0 || showHoverTooltip || hoveringSegment || hasDali || hoveredDaliNetworkId) {
            animationFrameRef.current = requestAnimationFrame(animate);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [symbolsToHighlight, selection, scale, currentPage, mode, mousePos, activeSymbolColor, isMagnifying, activeSymbolId, areas, drawingPoints, measurements, scaleInfo, activeDrawingMeasurementId, selectedMeasurementId, isShiftPressed, hoveringElement, hoveringSegment, hoveringNode, daliNetworks, daliDevices, ecdTypes, activeDaliPlacement, hoveredDaliNetworkId, daliDeviceToPaint, showDaliLabels, activePdfId, daliPsuLocationToPaint]);

    useEffect(() => {
        if (!isMagnifying || !mousePos || !magnifierCanvasRef.current || !canvasRef.current || !(mode.startsWith('placing_dali') || mode.startsWith('painting_dali') || mode === 'placing_dots')) {
            return;
        }

        const magnifierCtx = magnifierCanvasRef.current.getContext('2d');
        const sourceCanvas = canvasRef.current;
        if (!magnifierCtx) return;

        magnifierCtx.fillStyle = 'white';
        magnifierCtx.fillRect(0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE);

        const sourceRectSize = MAGNIFIER_SIZE / MAGNIFIER_ZOOM;
        const sourceX = mousePos.x - sourceRectSize / 2;
        const sourceY = mousePos.y - sourceRectSize / 2;
        
        magnifierCtx.drawImage(
            sourceCanvas,
            sourceX, sourceY, sourceRectSize, sourceRectSize,
            0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE
        );
        
        magnifierCtx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
        magnifierCtx.lineWidth = 1;
        magnifierCtx.beginPath();
        magnifierCtx.moveTo(MAGNIFIER_SIZE / 2, 0);
        magnifierCtx.lineTo(MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE);
        magnifierCtx.moveTo(0, MAGNIFIER_SIZE / 2);
        magnifierCtx.lineTo(MAGNIFIER_SIZE, MAGNIFIER_SIZE / 2);
        magnifierCtx.stroke();

    }, [isMagnifying, mousePos, mode, scale]);

    const getCanvasMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const pos = getCanvasMousePos(e);
        const unscaledPos = { x: pos.x / scale, y: pos.y / scale };

        if (mode === 'idle' && selectedMeasurementId) {
            // Priority 1: Delete segment if hovering delete icon
            if (hoveringSegment) {
                const dist = Math.sqrt(Math.pow(hoveringSegment.midPoint.x - pos.x, 2) + Math.pow(hoveringSegment.midPoint.y - pos.y, 2));
                if (dist <= 10) { // Clicked on delete icon
                    onDeleteMeasurementSegment(hoveringSegment.measurementId, hoveringSegment.segmentIndex);
                    setHoveringSegment(null);
                    return;
                }
            }

            // Priority 2: Start dragging a node
            if (isShiftPressed && hoveringNode) {
                onStartDragMeasurementNode(hoveringNode.measurementId, hoveringNode.segmentIndex, hoveringNode.pointIndex);
                setIsDraggingNode(true);
                return;
            }

            // Priority 3: Open manual entry modal or start linear component
            if (hoveringNode) {
                const selectedMeasurement = measurements.find(m => m.id === selectedMeasurementId);
                 if (e.ctrlKey) {
                    const point = selectedMeasurement?.points[hoveringNode.segmentIndex][hoveringNode.pointIndex];
                    if (point) onStartCreateLinearComponent(point);
                } else {
                    const existingEntry = selectedMeasurement?.manualEntries?.find(me => me.segmentIndex === hoveringNode.segmentIndex && me.pointIndex === hoveringNode.pointIndex);
                    onOpenManualLengthModal(selectedMeasurementId, hoveringNode.segmentIndex, hoveringNode.pointIndex, existingEntry);
                }
                return;
            }
        }


        if (mode === 'drawing_area' || mode === 'setting_scale' || mode === 'drawing_measurement') {
            if (mode === 'drawing_area' && drawingPoints.length > 2) {
                 const firstPoint = drawingPoints[0];
                 const distance = Math.sqrt(Math.pow((firstPoint.x * scale) - pos.x, 2) + Math.pow((firstPoint.y * scale) - pos.y, 2));
                 if (distance < 10) { // Clicked near the start point to close the polygon
                     onFinishAreaDrawing();
                     return;
                 }
            }
            
            let pointToDraw = unscaledPos;
            if (mode === 'drawing_measurement' && isShiftPressed && drawingPoints.length > 0) {
                const lastPoint = drawingPoints[drawingPoints.length - 1];
                const dx = unscaledPos.x - lastPoint.x;
                const dy = unscaledPos.y - lastPoint.y;

                if (Math.abs(dx) > Math.abs(dy)) {
                    // Horizontal constraint
                    pointToDraw = { x: unscaledPos.x, y: lastPoint.y };
                } else {
                    // Vertical constraint
                    pointToDraw = { x: lastPoint.x, y: unscaledPos.y };
                }
            }
            onDrawPoint(pointToDraw);
            return;
        }

        if (mode === 'selecting_dali_painter_source') {
            // Check for PSU first
            for (const network of daliNetworks) {
                if (network.isVisible && network.psuLocation) {
                    const psuLoc = network.psuLocation;
                    if (psuLoc.pdfId === activePdfId && psuLoc.page === currentPage) {
                        if (unscaledPos.x >= psuLoc.x && unscaledPos.x <= psuLoc.x + psuLoc.width && unscaledPos.y >= psuLoc.y && unscaledPos.y <= psuLoc.y + psuLoc.height) {
                            onDaliPsuPickedForPainting(network);
                            return;
                        }
                    }
                }
            }
            // Then check for devices
            for (const device of daliDevices) {
                const network = daliNetworks.find(n => n.id === device.networkId);
                if (!network?.isVisible || device.page !== currentPage) continue;

                const loc = device.location;
                if (unscaledPos.x >= loc.x && unscaledPos.x <= loc.x + loc.width && unscaledPos.y >= loc.y && unscaledPos.y <= loc.y + loc.height) {
                    onDaliDevicePickedForPainting(device);
                    return;
                }
            }
            return;
        }
        
        if (mode === 'painting_dali_psu_location') {
            // Check for PSU click
            for (const network of daliNetworks) {
                if (network.isVisible && network.psuLocation) {
                    const psuLoc = network.psuLocation;
                    if (psuLoc.pdfId === activePdfId && psuLoc.page === currentPage) {
                        if (unscaledPos.x >= psuLoc.x && unscaledPos.x <= psuLoc.x + psuLoc.width && unscaledPos.y >= psuLoc.y && unscaledPos.y <= psuLoc.y + psuLoc.height) {
                             onPaintDaliPsuLocation(network.id);
                             return;
                        }
                    }
                }
            }
            return;
        }

        if (mode === 'idle') {
            // Check for PSU interaction
             for (const network of daliNetworks) {
                if (network.isVisible && network.psuLocation) {
                    const psuLoc = network.psuLocation;
                    if (psuLoc.pdfId === activePdfId && psuLoc.page === currentPage) {
                        if (unscaledPos.x >= psuLoc.x && unscaledPos.x <= psuLoc.x + psuLoc.width && unscaledPos.y >= psuLoc.y && unscaledPos.y <= psuLoc.y + psuLoc.height) {
                             if (e.ctrlKey) {
                                 onDeletePsu(network.id);
                             } else {
                                 onStartEditPsuLocation(network.id);
                             }
                             return;
                        }
                    }
                }
            }

            // Check for DALI device interaction
            for (const device of daliDevices) {
                const network = daliNetworks.find(n => n.id === device.networkId);
                if (!network?.isVisible || device.page !== currentPage) continue;

                const loc = device.location;
                if (unscaledPos.x >= loc.x && unscaledPos.x <= loc.x + loc.width && unscaledPos.y >= loc.y && unscaledPos.y <= loc.y + loc.height) {
                    if (e.ctrlKey) {
                        onDeleteDaliDevice(device.id);
                    } else if (device.type === 'ECD') {
                        onStartEditEcdDevice(device.id);
                    } else { // ECGs are simple, just delete
                        onDeleteDaliDevice(device.id);
                    }
                    return;
                }
            }

            // Check for symbol pin interaction
            if (symbolsToHighlight.length > 0) {
                for (const symbol of symbolsToHighlight) {
                    for (let i = 0; i < symbol.locations.length; i++) {
                        const loc = symbol.locations[i];
                        if (
                            unscaledPos.x >= loc.x &&
                            unscaledPos.x <= loc.x + loc.width &&
                            unscaledPos.y >= loc.y &&
                            unscaledPos.y <= loc.y + loc.height
                        ) {
                            if (e.ctrlKey) {
                                e.preventDefault();
                                onStartReassignPin(symbol.id, i);
                            } else {
                                onLocationDelete(symbol.id, i);
                            }
                            return; // Return because we acted on a pin.
                        }
                    }
                }
            }
        }

        // If we've reached here, we didn't click on an existing pin.
        // Now, check for the new quick-add functionality.
        if (mode === 'idle' && e.ctrlKey && activeSymbolId) {
            e.preventDefault();
            onQuickPlaceDot(unscaledPos);
            return; // Action taken, so return.
        }

        if (mode === 'placing_dots') {
            onPlaceDot(unscaledPos);
            return;
        }
        if (mode === 'placing_dali_device') {
            onPlaceDaliDevice(unscaledPos);
            return;
        }
        if (mode === 'painting_dali_device') {
            onPaintDaliDevice(unscaledPos);
            return;
        }
        if (mode === 'placing_dali_psu') {
            onPlacePsu(unscaledPos);
            return;
        }
        if (mode.startsWith('selecting')) {
            setStartPoint(pos);
            setSelection(null);
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const pos = getCanvasMousePos(e);
        const unscaledPos = { x: pos.x / scale, y: pos.y / scale };
    
        if (isDraggingNode) {
            onUpdateMeasurementPoint(unscaledPos);
            setMousePos(pos);
            return;
        }
    
        if (mode.startsWith('placing') || mode.startsWith('drawing') || mode.startsWith('setting') || mode.startsWith('painting')) {
            setMousePos(pos);
        } else if (mousePos) {
            setMousePos(null);
        }
    
        if (mode.startsWith('selecting') && startPoint) {
            const x = Math.min(pos.x, startPoint.x);
            const y = Math.min(pos.y, startPoint.y);
            const width = Math.abs(pos.x - startPoint.x);
            const height = Math.abs(pos.y - startPoint.y);
            setSelection({ x, y, width, height });
        } else {
            const isHoverDetectionMode = mode === 'idle' || mode === 'painting_dali_psu_location';
            if (isHoverDetectionMode) {
                let foundPin: {type: 'pin' | 'dali' | 'psu', id: string, index?: number} | null = null;
                let foundNode: { measurementId: string, segmentIndex: number, pointIndex: number } | null = null;
                let foundSegment: { measurementId: string, segmentIndex: number, midPoint: {x:number, y:number} } | null = null;
                
                let foundPsuId: string | null = null;

                if (selectedMeasurementId) {
                    const selectedMeasurement = measurements.find(m => m.id === selectedMeasurementId);
                    if (selectedMeasurement) {
                        for (let segIdx = 0; segIdx < selectedMeasurement.points.length; segIdx++) {
                            for (let ptIdx = 0; ptIdx < selectedMeasurement.points[segIdx].length; ptIdx++) {
                                const point = selectedMeasurement.points[segIdx][ptIdx];
                                const dist = Math.sqrt(Math.pow((point.x * scale) - pos.x, 2) + Math.pow((point.y * scale) - pos.y, 2));
                                if (dist <= (isShiftPressed ? 8 : 6)) {
                                    foundNode = { measurementId: selectedMeasurementId, segmentIndex: segIdx, pointIndex: ptIdx };
                                    break;
                                }
                            }
                            if (foundNode) break;
                        }

                        if (!foundNode) {
                            for (let segIdx = 0; segIdx < selectedMeasurement.points.length; segIdx++) {
                                const segment = selectedMeasurement.points[segIdx];
                                let isHoveringThisSegment = false;
                                for (let i = 0; i < segment.length - 1; i++) {
                                    if (pointToLineSegmentDistance(unscaledPos, segment[i], segment[i+1]) * scale < 5) {
                                        isHoveringThisSegment = true;
                                        break;
                                    }
                                }
                                if (isHoveringThisSegment) {
                                    const totalPoints = segment.length;
                                    const midPointIndex = Math.floor((totalPoints - 1) / 2);
                                    const p1 = segment[midPointIndex];
                                    const p2 = segment[midPointIndex + 1] || p1;
                                    foundSegment = {
                                        measurementId: selectedMeasurementId,
                                        segmentIndex: segIdx,
                                        midPoint: { x: (p1.x + p2.x) / 2 * scale, y: (p1.y + p2.y) / 2 * scale }
                                    };
                                    break;
                                }
                            }
                        }
                    }
                }
                setHoveringNode(foundNode);
                setHoveringSegment(foundSegment);

                if (!foundNode && !foundSegment) {
                    for (const network of daliNetworks) {
                        if (network.isVisible && network.psuLocation) {
                            const psuLoc = network.psuLocation;
                            if (psuLoc.pdfId === activePdfId && psuLoc.page === currentPage) {
                                 if (unscaledPos.x >= psuLoc.x && unscaledPos.x <= psuLoc.x + psuLoc.width && unscaledPos.y >= psuLoc.y && unscaledPos.y <= psuLoc.y + psuLoc.height) {
                                    foundPin = { type: 'psu', id: network.id };
                                    if (mode === 'idle') foundPsuId = network.id;
                                    break;
                                }
                            }
                        }
                    }
                     if (!foundPin) {
                         for (const device of daliDevices) {
                            const network = daliNetworks.find(n => n.id === device.networkId);
                            if (!network?.isVisible || device.page !== currentPage) continue;
                            const loc = device.location;
                            if (unscaledPos.x >= loc.x && unscaledPos.x <= loc.x + loc.width && unscaledPos.y >= loc.y && unscaledPos.y <= loc.y + loc.height) {
                                foundPin = { type: 'dali', id: device.id };
                                break;
                            }
                        }
                     }
                    if (!foundPin) {
                        for (const symbol of symbolsToHighlight) {
                            for (let i = 0; i < symbol.locations.length; i++) {
                                const loc = symbol.locations[i];
                                if (unscaledPos.x >= loc.x && unscaledPos.x <= loc.x + loc.width && unscaledPos.y >= loc.y && unscaledPos.y <= loc.y + loc.height) {
                                    foundPin = { type: 'pin', id: symbol.id, index: i };
                                    break;
                                }
                            }
                            if (foundPin) break;
                        }
                    }
                }
                if (foundPsuId !== viewerHoveredPsuNetworkRef.current) {
                    onDaliNetworkHover(foundPsuId);
                    viewerHoveredPsuNetworkRef.current = foundPsuId;
                }
                if(JSON.stringify(foundPin) !== JSON.stringify(hoveringElement)) {
                     setHoveringElement(foundPin);
                }
            } else if (hoveringElement || hoveringNode || hoveringSegment) {
                setHoveringElement(null);
                setHoveringNode(null);
                setHoveringSegment(null);
            }
        }
    };

    const handleMouseUp = async () => {
        if (isDraggingNode) {
            onEndDragMeasurementNode();
            setIsDraggingNode(false);
        }

        if (!mode.startsWith('selecting') || !selection || !canvasRef.current) {
            if (mode.startsWith('selecting')) {
                 setStartPoint(null);
                 setSelection(null);
                 if (!selection) onCancelSelection();
            }
            return;
        };
        
        if(selection.width < 5 || selection.height < 5) {
            setStartPoint(null);
            setSelection(null);
            return;
        }

        const symbolCanvas = document.createElement('canvas');
        symbolCanvas.width = selection.width;
        symbolCanvas.height = selection.height;
        const symbolCtx = symbolCanvas.getContext('2d');
        if(!symbolCtx || !canvasRef.current) return;

        symbolCtx.drawImage(
            canvasRef.current,
            selection.x,
            selection.y,
            selection.width,
            selection.height,
            0,
            0,
            selection.width,
            selection.height
        );
        const symbolImage = symbolCanvas.toDataURL('image/png');

        onSymbolSelected(symbolImage);

        setStartPoint(null);
        setSelection(null);
    };
    
    const handleMouseLeave = () => {
        if (mode.startsWith('selecting') && startPoint) {
            setStartPoint(null);
            setSelection(null);
            onCancelSelection();
        }
        if (isDraggingNode) {
            onEndDragMeasurementNode();
            setIsDraggingNode(false);
        }
        setHoveringElement(null);
        setHoveringNode(null);
        setHoveringSegment(null);
        if (mousePos) {
            setMousePos(null);
        }
        if (viewerHoveredPsuNetworkRef.current) {
            onDaliNetworkHover(null);
            viewerHoveredPsuNetworkRef.current = null;
        }
    };

    const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        e.preventDefault();
        const container = viewerContainerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const scrollLeft = container.scrollLeft;
        const scrollTop = container.scrollTop;
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const pointOnContentX = scrollLeft + mouseX;
        const pointOnContentY = scrollTop + mouseY;

        const oldScale = scale;
        const newScale = Math.max(0.5, Math.min(3, oldScale - e.deltaY * 0.001));

        if (newScale === oldScale) return;

        const newScrollLeft = (pointOnContentX * newScale / oldScale) - mouseX;
        const newScrollTop = (pointOnContentY * newScale / oldScale) - mouseY;

        scrollTargetRef.current = { left: newScrollLeft, top: newScrollTop };
        setScale(newScale);
    };
    
    const getCursor = () => {
        if (isDraggingNode) return 'cursor-grabbing';
        if (mode === 'idle') {
            if (hoveringSegment) return 'cursor-pointer';
            if (hoveringNode) return isShiftPressed ? 'cursor-grab' : 'cursor-pointer';
            if (hoveringElement?.type === 'pin') return isCtrlPressed ? 'cursor-alias' : 'cursor-pointer';
            if (hoveringElement?.type === 'dali' || hoveringElement?.type === 'psu') return 'cursor-pointer';
            if (isCtrlPressed && activeSymbolId) return 'cursor-copy';
        }
        if (mode.startsWith('selecting') || mode === 'drawing_area' || mode === 'setting_scale' || mode === 'drawing_measurement') return 'cursor-crosshair';
        if (mode === 'placing_dots' || mode === 'placing_dali_device' || mode === 'placing_dali_psu') return 'cursor-none';
        if (mode.startsWith('painting_dali') || mode === 'selecting_dali_painter_source') return 'cursor-copy';
        return 'cursor-grab';
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center space-y-2">
            <div
                ref={viewerContainerRef}
                className={`flex-grow w-full h-[calc(100%-40px)] overflow-auto bg-gray-300 shadow-inner relative ${getCursor()}`}
                onWheel={handleWheel}
            >
                 {isRendering && <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-30"><LoadingIcon/> Rendering PDF...</div>}
                <div className="relative">
                    <canvas
                        ref={canvasRef}
                        className={`bg-white shadow-lg`}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseLeave}
                    />
                    <canvas ref={overlayCanvasRef} className="absolute top-0 left-0 pointer-events-none z-10" />
                    {(mode.startsWith('placing_dali') || mode.startsWith('painting_dali') || mode === 'placing_dots') && isMagnifying && mousePos && (
                        <div
                            className="absolute pointer-events-none rounded-full border-4 border-blue-500 overflow-hidden shadow-lg z-20 bg-white"
                            style={{
                                left: mousePos.x - MAGNIFIER_SIZE / 2,
                                top: mousePos.y - MAGNIFIER_SIZE / 2,
                                width: MAGNIFIER_SIZE,
                                height: MAGNIFIER_SIZE,
                            }}
                        >
                            <canvas ref={magnifierCanvasRef} width={MAGNIFIER_SIZE} height={MAGNIFIER_SIZE} />
                        </div>
                    )}
                </div>
            </div>
            {numPages > 0 && (
                <div className="flex items-center space-x-4 bg-white px-4 py-1 rounded-full shadow-md">
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                        disabled={currentPage <= 1 || mode !== 'idle'}
                        className="px-3 py-1 rounded-full bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Prev
                    </button>
                    <span>Page {currentPage} of {numPages}</span>
                    <button 
                        onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))} 
                        disabled={currentPage >= numPages || mode !== 'idle'}
                        className="px-3 py-1 rounded-full bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
};

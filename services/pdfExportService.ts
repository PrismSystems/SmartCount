

import type { Project, PdfFile, SymbolInfo, Area, LinearMeasurement, DaliDevice, DaliNetwork } from '../types';
import { projectService } from './projectService';
import { measurementService } from './measurementService';

// Since pdf-lib is loaded from a script tag, we declare its global variable.
declare const PDFLib: any;

/**
 * Converts an SVG data URL to a PNG data URL.
 * This is necessary because pdf-lib cannot embed SVG images directly.
 */
async function svgToPngDataUrl(svgDataUrl: string, width: number, height: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = 3; // Render at higher resolution to avoid blurriness
            canvas.width = width * scale;
            canvas.height = height * scale;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Canvas context not available'));
            }
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = (err) => reject(err);
        img.src = svgDataUrl;
    });
}

/**
 * Draws a pin shape on a pdf-lib page, rotating it to match the page's orientation.
 */
function drawPdfLibPin(page: any, x: number, y: number, size: number, color: {r: number, g: number, b: number}, rotation: number) {
    const { rgb } = PDFLib;

    const angleRad = -rotation * Math.PI / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    const rotate = (px: number, py: number) => ({
        x: px * cos - py * sin,
        y: px * sin + py * cos,
    });

    // Pin's geometry in its local coordinate system (tip at origin, pointing up in +y)
    const localBaseLeft = { x: -size, y: 2 * size };
    const localBaseRight = { x: size, y: 2 * size };
    const localHeadCenter = { x: 0, y: 2 * size };

    // Rotate the points
    const rotatedBaseLeft = rotate(localBaseLeft.x, localBaseLeft.y);
    const rotatedBaseRight = rotate(localBaseRight.x, localBaseRight.y);
    const rotatedHeadCenter = rotate(localHeadCenter.x, localHeadCenter.y);

    // Translate to world coordinates (where x, y is the pin tip)
    const worldBaseLeft = { x: x + rotatedBaseLeft.x, y: y + rotatedBaseLeft.y };
    const worldBaseRight = { x: x + rotatedBaseRight.x, y: y + rotatedBaseRight.y };
    const worldHeadCenter = { x: x + rotatedHeadCenter.x, y: y + rotatedHeadCenter.y };

    // Draw the rotated pin body
    const pinBodyPath = `M ${x} ${y} L ${worldBaseLeft.x} ${worldBaseLeft.y} L ${worldBaseRight.x} ${worldBaseRight.y} Z`;
    page.drawSvgPath(pinBodyPath, {
        color: rgb(color.r, color.g, color.b),
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5,
    });

    // Draw the rotated pin head
    page.drawCircle({
        x: worldHeadCenter.x,
        y: worldHeadCenter.y,
        size: size,
        color: rgb(color.r, color.g, color.b),
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5,
    });
}

export const exportDaliPdf = async (project: Project, pdfId: string, pageNumber: number): Promise<void> => {
     if (typeof PDFLib === 'undefined') {
        throw new Error("PDF generation library (pdf-lib) failed to load. Please check your internet connection and try again.");
    }
    const { PDFDocument, rgb, StandardFonts } = PDFLib;

    const pdfInfo = project.pdfs.find(p => p.id === pdfId);
    if (!pdfInfo) throw new Error("Could not find the specified PDF in the project.");

    const pdfDataString = await projectService.getPdfData(pdfId);
    if (!pdfDataString) throw new Error("Could not load PDF data from storage.");
    
    const existingPdfBytes = Uint8Array.from(atob(pdfDataString.split(',')[1]), c => c.charCodeAt(0));
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const page = pdfDoc.getPages()[pageNumber - 1];
    const { width, height } = page.getSize();
    const rotation = page.getRotation().angle;

    const transformPoint = (p: {x: number, y: number}): {x: number, y: number} => ({ x: p.x, y: height - p.y });

    const daliDevicesOnPage = (project.daliDevices || []).filter(d => d.pdfId === pdfId && d.page === pageNumber);
    const daliNetworks = new Map((project.daliNetworks || []).map(n => [n.id, n]));
    
    // --- Draw DALI Devices ---
    daliDevicesOnPage.forEach(device => {
        const network = daliNetworks.get(device.networkId);
        if (network?.isVisible) {
            const isEcg = device.type === 'ECG';
            const color = isEcg ? hexToRgb('#f97316') : hexToRgb('#06b6d4');
            const size = 5;

            const loc = device.location;
            const pinTipX = loc.x + loc.width / 2;
            const pinTipY = loc.y + loc.height;

            const textY = pinTipY - size * 3;
            const transformedTextPos = transformPoint({ x: pinTipX, y: textY });

            const address = isEcg ? String(device.shortAddress).padStart(2, '0') : device.shortAddress;
            const label = `${network.name}.${address}`;

            page.drawText(label, {
                x: transformedTextPos.x - 10, // Adjust for centering
                y: transformedTextPos.y + 2,
                font: helveticaFont,
                size: 8,
                color: rgb(0,0,0),
            });
            
            if (isEcg) {
                const ecgCenterY = pinTipY - size;
                const transformedEcgCenter = transformPoint({ x: pinTipX, y: ecgCenterY });
                page.drawCircle({
                    x: transformedEcgCenter.x,
                    y: transformedEcgCenter.y,
                    size: size,
                    color: rgb(color.r, color.g, color.b),
                    borderColor: rgb(0,0,0),
                    borderWidth: 0.5,
                });
            } else { // ECD
                const ecdTopY = pinTipY - size * 2;
                const transformedEcdTopLeft = transformPoint({ x: pinTipX - size, y: ecdTopY });
                page.drawRectangle({
                    x: transformedEcdTopLeft.x,
                    y: transformedEcdTopLeft.y - (size * 2), // rect is drawn from bottom-left
                    width: size * 2,
                    height: size * 2,
                    color: rgb(color.r, color.g, color.b),
                    borderColor: rgb(0,0,0),
                    borderWidth: 0.5,
                });
            }
        }
    });

    // --- Draw DALI Legend ---
    const PADDING = 15;
    const LEGEND_WIDTH = 220;
    
    let legendX, legendYAnchor;
    if (rotation === 90 || rotation === 270) {
        legendX = PADDING;
        legendYAnchor = 'bottom';
    } else {
        legendX = width - LEGEND_WIDTH - PADDING;
        legendYAnchor = 'bottom';
    }
    
    let currentLegendY = PADDING;

    const networksOnPage = new Map<string, {name: string, ecg: number, ecd: number}>();
    daliDevicesOnPage.forEach(d => {
        const network = daliNetworks.get(d.networkId);
        if (network && network.isVisible) {
            if (!networksOnPage.has(network.id)) {
                networksOnPage.set(network.id, { name: network.name, ecg: 0, ecd: 0 });
            }
            const counts = networksOnPage.get(network.id)!;
            if (d.type === 'ECG') counts.ecg++;
            else counts.ecd++;
        }
    });
    const sortedNetworksOnPage = Array.from(networksOnPage.values()).sort((a,b) => a.name.localeCompare(b.name));

    if (sortedNetworksOnPage.length > 0) {
        const KEY_ROW_HEIGHT = 20;
        const COUNT_ROW_HEIGHT = 16;
        const legendHeight = PADDING * 2 + 20 + (KEY_ROW_HEIGHT * 2) + (sortedNetworksOnPage.length * COUNT_ROW_HEIGHT) + PADDING;

        page.drawRectangle({
            x: legendX,
            y: currentLegendY,
            width: LEGEND_WIDTH,
            height: legendHeight,
            color: rgb(1, 1, 1),
            opacity: 0.85,
            borderColor: rgb(0.8, 0.8, 0.8),
            borderWidth: 1,
        });

        let rowY = currentLegendY + legendHeight - PADDING;

        page.drawText('DALI Legend', {
            x: legendX + PADDING,
            y: rowY - 12,
            font: helveticaBoldFont,
            size: 14,
            color: rgb(0, 0, 0),
        });
        rowY -= (20 + PADDING/2);
        
        // Key
        const ecgColor = hexToRgb('#f97316');
        const ecdColor = hexToRgb('#06b6d4');
        page.drawCircle({ x: legendX + PADDING + 6, y: rowY, size: 6, color: rgb(ecgColor.r, ecgColor.g, ecgColor.b) });
        page.drawText('ECG (Electronic Control Gear)', { x: legendX + PADDING + 20, y: rowY - 4, font: helveticaFont, size: 9 });
        rowY -= KEY_ROW_HEIGHT;

        page.drawRectangle({ x: legendX + PADDING, y: rowY - 6, width: 12, height: 12, color: rgb(ecdColor.r, ecdColor.g, ecdColor.b) });
        page.drawText('ECD (Electronic Control Device)', { x: legendX + PADDING + 20, y: rowY - 4, font: helveticaFont, size: 9 });
        rowY -= (KEY_ROW_HEIGHT + PADDING/2);
        
        // Counts
        sortedNetworksOnPage.forEach(net => {
            page.drawText(`${net.name} - ECG: ${net.ecg}, ECD: ${net.ecd}`, {
                 x: legendX + PADDING,
                 y: rowY - 4,
                 font: helveticaFont,
                 size: 9,
            });
            rowY -= COUNT_ROW_HEIGHT;
        });
    }


    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pdfInfo.name.replace('.pdf', '')}-DALI-Report-Page-${pageNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};


/**
 * Main function to generate and trigger the download of a marked-up PDF.
 */
export const exportMarkedUpPdf = async (
    project: Project, 
    pdfId: string, 
    pageNumber: number,
    options: { withLabels?: boolean } = {}
): Promise<void> => {
    if (typeof PDFLib === 'undefined') {
        throw new Error("PDF generation library (pdf-lib) failed to load. Please check your internet connection and try again.");
    }
    const { PDFDocument, rgb, StandardFonts } = PDFLib;

    const pdfInfo = project.pdfs.find(p => p.id === pdfId);
    if (!pdfInfo) throw new Error("Could not find the specified PDF in the project.");

    const pdfDataString = await projectService.getPdfData(pdfId);
    if (!pdfDataString) throw new Error("Could not load PDF data from storage.");
    
    const existingPdfBytes = Uint8Array.from(atob(pdfDataString.split(',')[1]), c => c.charCodeAt(0));
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const page = pdfDoc.getPages()[pageNumber - 1];
    const { width, height } = page.getSize();
    const rotation = page.getRotation().angle;
    
    // Helper for coordinate transformation from top-left (canvas) to bottom-left (pdf-lib).
    // The canvas has a top-left origin, while pdf-lib has a bottom-left origin.
    // The page.getSize() and page drawing operations are relative to the current
    // page orientation (rotation is already accounted for).
    // Therefore, a simple y-axis flip is all that's needed.
    const transformPoint = (p: {x: number, y: number}): {x: number, y: number} => {
        return { x: p.x, y: height - p.y };
    };

    // --- Filter data for the current page ---
    const symbolsOnPage = project.symbols.filter(s => s.pdfId === pdfId && s.page === pageNumber);
    const areasOnPage = project.areas.filter(a => a.pdfId === pdfId && a.isVisible);
    const measurementsOnPage = project.measurements.filter(m => m.pdfId === pdfId && m.isVisible);

    // --- Draw Areas ---
    areasOnPage.forEach(area => {
        const transformedPoints = area.points.map(transformPoint);
        const color = hexToRgb(area.color);
        page.drawPolygon({
            points: transformedPoints,
            color: rgb(color.r, color.g, color.b),
            opacity: 0.2,
            borderColor: rgb(color.r, color.g, color.b),
            borderOpacity: 0.8,
            borderWidth: 1.5,
        });
    });

    // --- Draw Measurements ---
    measurementsOnPage.forEach(measurement => {
        const color = hexToRgb(measurement.color);
        measurement.points.forEach(segment => {
            if (segment.length < 2) return;
            const transformedPoints = segment.map(transformPoint);
            for(let i=0; i < transformedPoints.length -1; i++){
                page.drawLine({
                    start: transformedPoints[i],
                    end: transformedPoints[i+1],
                    thickness: 2,
                    color: rgb(color.r, color.g, color.b),
                    opacity: 0.8,
                });
            }
        });
    });

    // --- Draw Symbol Pins ---
    symbolsOnPage.forEach(symbol => {
        const color = hexToRgb(symbol.color);
        symbol.locations.forEach(loc => {
            const transformedCenter = transformPoint({ x: loc.x + loc.width / 2, y: loc.y + loc.height });
            drawPdfLibPin(page, transformedCenter.x, transformedCenter.y, 4, color, rotation);

            if (options.withLabels) {
                const text = symbol.name;
                const textSize = 6;
                
                // Position label slightly above and to the right of the pin head.
                const labelX = transformedCenter.x + 5; // Offset to the right
                const labelY = transformedCenter.y + 5; // Offset upwards (in PDF coordinates)

                page.drawText(text, {
                    x: labelX,
                    y: labelY,
                    font: helveticaFont,
                    size: textSize,
                    color: rgb(0, 0, 0),
                });
            }
        });
    });

    // --- Draw Legends ---
    const PADDING = 15;
    const LEGEND_WIDTH = 220;
    
    // Adjust legend position based on rotation to avoid covering content
    let legendX, legendYAnchor;
    if (rotation === 90 || rotation === 270) {
        // For landscape pages, anchor to bottom-left
        legendX = PADDING;
        legendYAnchor = 'bottom';
    } else {
        // For portrait pages, anchor to bottom-right
        legendX = width - LEGEND_WIDTH - PADDING;
        legendYAnchor = 'bottom';
    }
    
    let currentLegendY = PADDING;

    // --- Draw Symbol Legend ---
    const legendItems = new Map<string, { symbol: SymbolInfo; count: number }>();
    symbolsOnPage.forEach(s => {
        const key = s.name;
        const existing = legendItems.get(key);
        if (existing) {
            existing.count += s.locations.length;
        } else if (s.locations.length > 0) {
            legendItems.set(key, { symbol: s, count: s.locations.length });
        }
    });

    let symbolLegendHeight = 0;
    if (legendItems.size > 0) {
        const ROW_HEIGHT = 30;
        const IMG_SIZE = 20;
        symbolLegendHeight = PADDING * 2 + 20 + (legendItems.size * ROW_HEIGHT);

        // Draw background
        page.drawRectangle({
            x: legendX,
            y: currentLegendY,
            width: LEGEND_WIDTH,
            height: symbolLegendHeight,
            color: rgb(1, 1, 1),
            opacity: 0.85,
            borderColor: rgb(0.8, 0.8, 0.8),
            borderWidth: 1,
        });
        
        // Draw title
        page.drawText('Takeoff Legend', {
            x: legendX + PADDING,
            y: currentLegendY + symbolLegendHeight - PADDING - 12,
            font: helveticaBoldFont,
            size: 14,
            color: rgb(0, 0, 0),
        });

        let rowY = currentLegendY + symbolLegendHeight - PADDING - 20 - ROW_HEIGHT;

        for (const item of Array.from(legendItems.values())) {
            const { symbol, count } = item;
            const color = hexToRgb(symbol.color);
            let imageBytes;
            try {
                if (symbol.image.startsWith('data:image/svg+xml')) {
                     const pngDataUrl = await svgToPngDataUrl(symbol.image, IMG_SIZE, IMG_SIZE);
                     imageBytes = pngDataUrl.split(',')[1];
                } else {
                     imageBytes = symbol.image.split(',')[1];
                }
                const embeddedImage = await pdfDoc.embedPng(imageBytes);
                page.drawImage(embeddedImage, {
                    x: legendX + PADDING,
                    y: rowY + (ROW_HEIGHT - IMG_SIZE) / 2,
                    width: IMG_SIZE,
                    height: IMG_SIZE,
                });
            } catch(e) {
                console.warn(`Could not embed image for symbol ${symbol.name}`, e);
                 page.drawRectangle({
                    x: legendX + PADDING,
                    y: rowY + (ROW_HEIGHT - IMG_SIZE) / 2,
                    width: IMG_SIZE,
                    height: IMG_SIZE,
                    color: rgb(color.r, color.g, color.b),
                    borderColor: rgb(0.5,0.5,0.5),
                    borderWidth: 0.5,
                 });
            }
            
            const text = `${symbol.name}: ${count}`;
            page.drawText(text, {
                x: legendX + PADDING + IMG_SIZE + 10,
                y: rowY + (ROW_HEIGHT - 10) / 2,
                font: helveticaFont,
                size: 10,
                color: rgb(0, 0, 0),
            });

            rowY -= ROW_HEIGHT;
        }
        currentLegendY += symbolLegendHeight + PADDING;
    }


    // --- Draw Measurement Legend ---
    if (measurementsOnPage.length > 0) {
        const ROW_HEIGHT = 20;
        const COLOR_SWATCH_SIZE = 12;
        const measurementLegendHeight = PADDING * 2 + 20 + (measurementsOnPage.length * ROW_HEIGHT);
        
        // Draw background for measurement legend
        page.drawRectangle({
            x: legendX,
            y: currentLegendY,
            width: LEGEND_WIDTH,
            height: measurementLegendHeight,
            color: rgb(1, 1, 1),
            opacity: 0.85,
            borderColor: rgb(0.8, 0.8, 0.8),
            borderWidth: 1,
        });

        // Draw title for measurement legend
        page.drawText('Measurements', {
            x: legendX + PADDING,
            y: currentLegendY + measurementLegendHeight - PADDING - 12,
            font: helveticaBoldFont,
            size: 14,
            color: rgb(0, 0, 0),
        });

        let rowY = currentLegendY + measurementLegendHeight - PADDING - 20 - ROW_HEIGHT;
        const scaleInfo = pdfInfo?.scaleInfo;

        for (const measurement of measurementsOnPage) {
            const color = hexToRgb(measurement.color);
            
            page.drawRectangle({
                x: legendX + PADDING,
                y: rowY + (ROW_HEIGHT - COLOR_SWATCH_SIZE) / 2,
                width: COLOR_SWATCH_SIZE,
                height: COLOR_SWATCH_SIZE,
                color: rgb(color.r, color.g, color.b),
            });

            const totalLength = measurementService.calculateTotalLength(measurement, scaleInfo);
            const lengthText = measurementService.formatLength(totalLength);
            const text = `${measurement.name}: ${lengthText}`;
            
            page.drawText(text, {
                x: legendX + PADDING + COLOR_SWATCH_SIZE + 10,
                y: rowY + (ROW_HEIGHT - 10) / 2,
                font: helveticaFont,
                size: 10,
                color: rgb(0, 0, 0),
            });

            rowY -= ROW_HEIGHT;
        }
    }


    // --- Save and Download ---
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pdfInfo.name.replace('.pdf', '')}-Report-Page-${pageNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};


function hexToRgb(hex: string): { r: number, g: number, b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  } : { r: 0, g: 0, b: 0 };
}
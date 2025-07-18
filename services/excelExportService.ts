import type { SymbolInfo, Discipline, PdfFile, Area, Project, LinearMeasurement, DaliNetwork, DaliDevice, EcdType } from '../types';
import { measurementService } from './measurementService';
import { LINEAR_DISCIPLINE_NAME } from '../constants';

// ExcelJS is attached to the window object from a script tag in index.html
declare global {
    interface Window { ExcelJS?: any; }
}

const sanitizeText = (text: string | null | undefined): string => {
    if (!text) return '';
    return text.trim();
};

const sanitizeSheetName = (name: string): string => {
    return name.replace(/[\\/?*[\]]/g, '').substring(0, 31);
};

export const exportExcelWithSchedule = async (
    project: Project,
    onlyCounted: boolean
): Promise<void> => {
    if (typeof window.ExcelJS === 'undefined') {
        throw new Error("Excel export library (ExcelJS) failed to load. Please check your internet connection and try again.");
    }

    const { symbols, disciplines, pdfs, areas, name: projectName, measurements, daliNetworks, daliDevices, ecdTypes } = project;
    const aggregatedData = aggregateSymbolData(symbols);
    
    const linearDisciplineId = disciplines.find(d => d.name === LINEAR_DISCIPLINE_NAME && !d.parentId)?.id;
    const hasLinearComponents = linearDisciplineId ? symbols.some(s => s.disciplineId === linearDisciplineId && s.count > 0) : false;

    // Check if there is anything to export based on the filter
    const hasCountedSymbols = symbols.some(s => s.count > 0);
    const hasDataToExport = !onlyCounted || hasCountedSymbols || (measurements && measurements.length > 0) || (daliDevices && daliDevices.length > 0);

    if (!hasDataToExport) {
        alert("No data available to export based on the selected criteria (e.g., no symbols with counts > 0).");
        return;
    }


    const workbook = new window.ExcelJS.Workbook();
    workbook.creator = 'Smart Count';
    workbook.created = new Date();

    // 1. Create Summary Sheet
    generateSummarySheet(workbook, aggregatedData, disciplines, areas, onlyCounted, projectName);

    // 2. Create Per-PDF Sheets
    const sortedPdfs = [...pdfs].sort((a, b) => (a.level || a.name).localeCompare(b.level || b.name));
    sortedPdfs.forEach(pdf => {
        const sheetTitle = `${pdf.name}${pdf.level && pdf.level.trim() ? ` (Level ${pdf.level.trim()})` : ''}`;
        generatePerPdfSheet(workbook, aggregatedData, disciplines, areas, onlyCounted, sheetTitle, pdf.id);
    });
    
    // 3. Create Measurements Sheet
    if (measurements.length > 0 || hasLinearComponents) {
        generateMeasurementsSheet(workbook, project);
    }

    // 4. Create DALI Schedule Sheet
    if (daliDevices && daliDevices.length > 0) {
        generateDaliSheet(workbook, project);
    }
    
    // 5. Create DALI PSU Summary Sheet
    if (daliNetworks && daliNetworks.some(n => n.psuLocation)) {
        generateDaliPsuSummarySheet(workbook, project);
    }
    
    if (workbook.worksheets.length === 0) {
        alert("No data available to export based on the selected criteria.");
        return;
    }
    
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeFileName = projectName.replace(/[/\\?%*:|"<>]/g, '-');
    a.download = `${safeFileName}_Symbol_Schedule.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};


// --- Data Aggregation (no change needed) ---

export type AggregatedCounts = {
    total: number;
    byPdfAndArea: Map<string, Map<string, number>>; // pdfId -> areaId -> count
};

export type AggregatedEntry = {
    refSymbol: SymbolInfo;
    counts: AggregatedCounts;
    children: Map<string, { refSymbol: SymbolInfo; counts: AggregatedCounts }>;
};

export type AggregatedData = Map<string, AggregatedEntry>;

export function aggregateSymbolData(symbols: SymbolInfo[]): AggregatedData {
    const aggregatedData: AggregatedData = new Map();
    const getKey = (s: SymbolInfo) => `${s.disciplineId || 'uncategorized'}___${s.name}`;

    symbols.forEach(symbol => {
        const parent = symbol.parentId ? symbols.find(p => p.id === symbol.parentId) : symbol;
        if (!parent) return;

        const parentKey = getKey(parent);
        if (!aggregatedData.has(parentKey)) {
            aggregatedData.set(parentKey, {
                refSymbol: parent,
                counts: { total: 0, byPdfAndArea: new Map() },
                children: new Map(),
            });
        }
        const parentEntry = aggregatedData.get(parentKey)!;

        let targetEntry: { refSymbol: SymbolInfo; counts: AggregatedCounts };
        if (symbol.parentId) {
            const childKey = symbol.variantText || symbol.name;
            if (!parentEntry.children.has(childKey)) {
                parentEntry.children.set(childKey, { 
                    refSymbol: symbol, 
                    counts: { total: 0, byPdfAndArea: new Map() } 
                });
            }
            targetEntry = parentEntry.children.get(childKey)!;
        } else {
            targetEntry = parentEntry;
        }

        symbol.locations.forEach(loc => {
            targetEntry.counts.total++;
            const pdfId = symbol.pdfId;
            const areaId = loc.areaId || 'unassigned';

            if (!targetEntry.counts.byPdfAndArea.has(pdfId)) {
                targetEntry.counts.byPdfAndArea.set(pdfId, new Map());
            }
            const areaMap = targetEntry.counts.byPdfAndArea.get(pdfId)!;
            areaMap.set(areaId, (areaMap.get(areaId) || 0) + 1);
        });
    });

    return aggregatedData;
}


// --- Sheet Generation Functions ---

const thinBorder = {
    top: { style: 'thin' as const, color: { argb: 'FFD3D3D3' } },
    left: { style: 'thin' as const, color: { argb: 'FFD3D3D3' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFD3D3D3' } },
    right: { style: 'thin' as const, color: { argb: 'FFD3D3D3' } }
};

const applyStylesToRow = (row: any, styles: any, borders: boolean = false) => {
    row.eachCell((cell: any) => {
        cell.font = { ...cell.font, ...styles.font };
        cell.alignment = { ...cell.alignment, ...styles.alignment };
        if (borders) {
            cell.border = thinBorder;
        }
    });
};

function generateSummarySheet(workbook: any, aggregatedData: AggregatedData, disciplines: Discipline[], areas: Area[], onlyCounted: boolean, projectName: string) {
    const { rows, contentAdded } = generateSymbolSheetData(aggregatedData, disciplines, areas, onlyCounted, true);
    if (!contentAdded) return;
    
    const ws = workbook.addWorksheet('Summary');
    ws.columns = [
        { key: 'discipline', width: 35 },
        { key: 'symbol', width: 35 },
        { key: 'total', width: 15 }
    ];

    addStyledDataToSheet(ws, rows, projectName, ['Discipline', 'Symbol', 'Total']);
}


function generatePerPdfSheet(workbook: any, aggregatedData: AggregatedData, disciplines: Discipline[], areas: Area[], onlyCounted: boolean, sheetTitle: string, pdfId: string) {
    const areasForSheet = areas.filter(a => a.pdfId === pdfId);
    const { rows, contentAdded, areaColumns } = generateSymbolSheetData(aggregatedData, disciplines, areasForSheet, onlyCounted, false, pdfId);

    if (!contentAdded) return;
    
    const safeSheetName = sanitizeSheetName(sheetTitle);
    const ws = workbook.addWorksheet(safeSheetName);
    
    const columns = [
        { key: 'discipline', width: 35 },
        { key: 'symbol', width: 35 },
    ];
    areaColumns.forEach(area => {
        columns.push({ key: area.id, width: Math.max(area.name.length, 12) });
    });
    columns.push({ key: 'total', width: 15 });
    ws.columns = columns;

    const headers = ['Discipline', 'Symbol', ...areaColumns.map(a => a.name), 'Total'];
    addStyledDataToSheet(ws, rows, sheetTitle, headers);
}

function generateMeasurementsSheet(workbook: any, project: Project) {
    const { measurements, pdfs, symbols, disciplines, measurementGroups = [] } = project;
    const ws = workbook.addWorksheet('Measurements');
    let hasContent = false;

    ws.columns = [
        { key: 'document', width: 30 },
        { key: 'measurement', width: 40 },
        { key: 'drawn', width: 15 },
        { key: 'manual', width: 15 },
        { key: 'total', width: 15 },
    ];

    const pdfMap = new Map(pdfs.map(p => [p.id, p]));
    
    if (measurements.length > 0) {
        hasContent = true;
        const headerRow = ws.addRow(['Linear Measurements']);
        headerRow.font = { name: 'Calibri', size: 14, bold: true, color: { argb: "FF008000" } };
        ws.mergeCells(headerRow.number, 1, headerRow.number, 5);
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 22;
        ws.addRow([]); // Spacer

        const tableHeader = ws.addRow(['Document', 'Measurement/Group', 'Drawn (m)', 'Manual (m)', 'Total (m)']);
        applyStylesToRow(tableHeader, { font: { bold: true }, alignment: { horizontal: 'center' } }, true);

        const renderMeasurementGroupRows = (parentId: string | null, level: number = 0) => {
            const groups = measurementGroups.filter(g => g.parentId === parentId).sort((a,b) => a.name.localeCompare(b.name));
            groups.forEach(group => {
                const groupRow = ws.addRow(['', ' '.repeat(level*2) + group.name]);
                groupRow.getCell(2).font = { bold: true, italic: true };
                
                const groupMeasurements = measurements.filter(m => m.groupId === group.id).sort((a,b) => a.name.localeCompare(b.name));
                groupMeasurements.forEach(m => {
                    const pdf = pdfMap.get(m.pdfId);
                    const drawn = measurementService.calculateDrawnLength(m, pdf?.scaleInfo);
                    const manual = measurementService.calculateManualLength(m);
                    const total = drawn + manual;
                    const dataRow = ws.addRow([pdf?.name || '', ' '.repeat((level+1)*2) + m.name, drawn, manual, total]);
                    dataRow.getCell(3).numFmt = '0.00';
                    dataRow.getCell(4).numFmt = '0.00';
                    dataRow.getCell(5).numFmt = '0.00';
                    applyStylesToRow(dataRow, {}, true);
                });
                renderMeasurementGroupRows(group.id, level + 1);
            });
        };
        renderMeasurementGroupRows(null);
        
        const ungrouped = measurements.filter(m => !m.groupId).sort((a,b) => a.name.localeCompare(b.name));
        if (ungrouped.length > 0) {
            const ungroupedHeader = ws.addRow(['', 'Ungrouped']);
            ungroupedHeader.getCell(2).font = { bold: true, italic: true };
            ungrouped.forEach(m => {
                 const pdf = pdfMap.get(m.pdfId);
                 const drawn = measurementService.calculateDrawnLength(m, pdf?.scaleInfo);
                 const manual = measurementService.calculateManualLength(m);
                 const total = drawn + manual;
                 const dataRow = ws.addRow([pdf?.name || '', '  ' + m.name, drawn, manual, total]);
                 dataRow.getCell(3).numFmt = '0.00';
                 dataRow.getCell(4).numFmt = '0.00';
                 dataRow.getCell(5).numFmt = '0.00';
                 applyStylesToRow(dataRow, {}, true);
            });
        }
    }

    const linearDiscipline = disciplines.find(d => d.name === LINEAR_DISCIPLINE_NAME && !d.parentId);
    if (linearDiscipline) {
        const linearComponents = symbols.filter(s => s.disciplineId === linearDiscipline.id && s.count > 0);
        if (linearComponents.length > 0) {
            if (hasContent) {
                ws.addRow([]);
                const spacer = ws.addRow([]);
                spacer.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
                ws.addRow([]);
            }
            hasContent = true;
            const headerRow = ws.addRow(['Linear Components']);
            headerRow.font = { name: 'Calibri', size: 14, bold: true, color: { argb: "FF008000" } };
            ws.mergeCells(headerRow.number, 1, headerRow.number, 5);
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
            headerRow.height = 22;
            ws.addRow([]);

            const tableHeader = ws.addRow(['Discipline', 'Component Name', 'Total Count']);
            applyStylesToRow(tableHeader, { font: { bold: true }, alignment: { horizontal: 'center' } }, true);

            linearComponents.forEach(c => {
                const row = ws.addRow([linearDiscipline.name, c.name, c.count]);
                applyStylesToRow(row, {}, true);
            });
        }
    }

    if (!hasContent) {
        workbook.removeWorksheet('Measurements');
    }
}

function generateDaliSheet(workbook: any, project: Project) {
    const { daliNetworks = [], daliDevices = [], ecdTypes = [] } = project;
    const ws = workbook.addWorksheet('DALI Schedule');

    ws.columns = [
        { key: 'parameter', width: 25 }, { key: 'value', width: 25 },
        { key: 'col3', width: 20 }, { key: 'col4', width: 15 },
        { key: 'col5', width: 15 }, { key: 'col6', width: 20 }
    ];

    const mainHeader = ws.addRow(['DALI Network Schedule']);
    mainHeader.font = { name: 'Calibri', size: 14, bold: true, color: { argb: "FF008000" } };
    ws.mergeCells(mainHeader.number, 1, mainHeader.number, 6);
    mainHeader.alignment = { vertical: 'middle', horizontal: 'center' };
    mainHeader.height = 22;
    ws.addRow([]);

    const ecdTypesMap = new Map(ecdTypes.map(t => [t.id, t]));
    const ECG_CONSUMPTION_MA = 2;
    const DEFAULT_ECD_CONSUMPTION_MA = 6;
    const sortedNetworks = [...daliNetworks].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    sortedNetworks.forEach(network => {
        const networkDevices = daliDevices.filter(d => d.networkId === network.id);
        if (networkDevices.length === 0) return;

        const ecgDevices = networkDevices.filter(d => d.type === 'ECG');
        const ecdDevices = networkDevices.filter(d => d.type === 'ECD');
        
        const ecgConsumption = ecgDevices.length * ECG_CONSUMPTION_MA;
        const ecdConsumption = ecdDevices.reduce((sum, device) => {
            const type = device.ecdTypeId ? ecdTypesMap.get(device.ecdTypeId) : null;
            return sum + (type ? type.busCurrent : DEFAULT_ECD_CONSUMPTION_MA);
        }, 0);
        const totalConsumption = ecgConsumption + ecdConsumption;
        const isOverloaded = totalConsumption > network.powerSupplyCapacity;

        const networkHeader = ws.addRow([`Network: ${network.name}`]);
        networkHeader.font = { bold: true, italic: true, size: 12 };
        ws.mergeCells(networkHeader.number, 1, networkHeader.number, 6);

        const summaryHeader = ws.addRow(['Parameter', 'Value']);
        applyStylesToRow(summaryHeader, { font: { bold: true } }, true);

        const addSummaryRow = (label: string, value: string | number) => {
            const row = ws.addRow([label, value]);
            row.getCell(1).font = { bold: true };
            applyStylesToRow(row, {}, true);
        };

        addSummaryRow('PSU Capacity', `${network.powerSupplyCapacity} mA`);
        addSummaryRow('Total Load', `${totalConsumption.toFixed(1)} mA`);
        addSummaryRow('Status', isOverloaded ? 'OVERLOADED' : 'OK');
        addSummaryRow('Total ECG Count', `${ecgDevices.length} / ${network.ecgLimit}`);
        addSummaryRow('Total ECD Count', `${ecdDevices.length} / ${network.ecdLimit}`);
        ws.addRow([]);

        if (ecgDevices.length > 0) {
            const ecgHeader = ws.addRow(['Device Type', 'Quantity', 'Total Current (mA)']);
            applyStylesToRow(ecgHeader, { font: { bold: true } }, true);
            const ecgRow = ws.addRow(['ECG (Control Gear)', ecgDevices.length, ecgConsumption]);
            ecgRow.getCell(1).font = { bold: true };
            applyStylesToRow(ecgRow, {}, true);
        }

        if (ecdDevices.length > 0) {
            if(ecgDevices.length > 0) ws.addRow([]);
            const ecdHeader = ws.addRow(['ECD Reference', 'Description', 'Product Code', 'Unit Current (mA)', 'Quantity', 'Total Current (mA)']);
            applyStylesToRow(ecdHeader, { font: { bold: true } }, true);

            const ecdSummaryByType = new Map<string, { typeInfo: EcdType | null, quantity: number }>();
            ecdDevices.forEach(d => {
                const key = d.ecdTypeId || 'unassigned';
                if (!ecdSummaryByType.has(key)) {
                    ecdSummaryByType.set(key, { typeInfo: d.ecdTypeId ? ecdTypesMap.get(d.ecdTypeId) || null : null, quantity: 0 });
                }
                ecdSummaryByType.get(key)!.quantity++;
            });
            
            const sortedEcdSummary = Array.from(ecdSummaryByType.entries()).sort((a, b) => (a[1].typeInfo?.reference || 'zzz').localeCompare(b[1].typeInfo?.reference || 'zzz'));
            sortedEcdSummary.forEach(([key, { typeInfo, quantity }]) => {
                let rowData;
                if (key === 'unassigned') {
                    rowData = ['Unassigned', '', '', DEFAULT_ECD_CONSUMPTION_MA, quantity, quantity * DEFAULT_ECD_CONSUMPTION_MA];
                } else if (typeInfo) {
                    rowData = [typeInfo.reference, typeInfo.description, typeInfo.productCode, typeInfo.busCurrent, quantity, quantity * typeInfo.busCurrent];
                }
                if (rowData) {
                    const row = ws.addRow(rowData);
                    row.getCell(1).font = { bold: true };
                    applyStylesToRow(row, {}, true);
                }
            });
        }
        
        const spacer = ws.addRow([]);
        spacer.height = 15;
    });
}

function generateDaliPsuSummarySheet(workbook: any, project: Project) {
    const { daliNetworks = [], pdfs, daliDevices = [] } = project;
    const networksWithPsu = daliNetworks.filter(n => n.psuLocation);

    if (networksWithPsu.length === 0) {
        return; // No PSUs placed, so no summary sheet needed.
    }
    
    const ws = workbook.addWorksheet('DALI PSU Summary');

    ws.columns = [
        { key: 'col1', width: 40 }, // PDF / Level
        { key: 'col2', width: 30 }, // PSU Location
        { key: 'col3', width: 20 }, // DALI Network
        { key: 'col4', width: 15 }, // Page
        { key: 'ecgCount', width: 15 },
        { key: 'ecdCount', width: 15 },
    ];

    const mainHeader = ws.addRow(['DALI Power Supply Unit Summary']);
    mainHeader.font = { name: 'Calibri', size: 14, bold: true, color: { argb: "FF008000" } };
    ws.mergeCells(mainHeader.number, 1, mainHeader.number, 6);
    mainHeader.alignment = { vertical: 'middle', horizontal: 'center' };
    mainHeader.height = 22;
    ws.addRow([]); // Spacer

    const tableHeader = ws.addRow(['PDF / Level', 'PSU Location', 'DALI Network', 'Page No.', 'ECG Count', 'ECD Count']);
    applyStylesToRow(tableHeader, { font: { bold: true }, alignment: { horizontal: 'center' } }, true);

    const pdfMap = new Map(pdfs.map(p => [p.id, p]));
    const getDeviceCounts = (networkId: string) => {
        const networkDevices = daliDevices.filter(d => d.networkId === networkId);
        return {
            ecg: networkDevices.filter(d => d.type === 'ECG').length,
            ecd: networkDevices.filter(d => d.type === 'ECD').length
        };
    };
    
    const groupedByPdf = new Map<string, { pdfInfo: PdfFile, networks: DaliNetwork[] }>();
    networksWithPsu.forEach(network => {
        const pdfId = network.psuLocation!.pdfId;
        if (!groupedByPdf.has(pdfId)) {
            const pdfInfo = pdfMap.get(pdfId);
            if (pdfInfo) {
                groupedByPdf.set(pdfId, { pdfInfo, networks: [] });
            }
        }
        groupedByPdf.get(pdfId)?.networks.push(network);
    });

    const sortedPdfs = Array.from(groupedByPdf.values()).sort((a, b) => {
        const levelA = a.pdfInfo.level || a.pdfInfo.name;
        const levelB = b.pdfInfo.level || b.pdfInfo.name;
        return levelA.localeCompare(levelB);
    });

    sortedPdfs.forEach(({ pdfInfo, networks }) => {
        let pdfTotalEcg = 0;
        let pdfTotalEcd = 0;
        networks.forEach(net => {
            const counts = getDeviceCounts(net.id);
            pdfTotalEcg += counts.ecg;
            pdfTotalEcd += counts.ecd;
        });

        const pdfLevel = pdfInfo.level ? ` (${pdfInfo.level})` : '';
        const pdfRow = ws.addRow([`${pdfInfo.name}${pdfLevel}`, '', '', '', pdfTotalEcg, pdfTotalEcd]);
        pdfRow.font = { bold: true, size: 12 };
        pdfRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        ws.mergeCells(pdfRow.number, 1, pdfRow.number, 4);
        applyStylesToRow(pdfRow, {}, true);
        pdfRow.getCell(5).font = { bold: true, size: 12 };
        pdfRow.getCell(6).font = { bold: true, size: 12 };


        const groupedByLocation = new Map<string, DaliNetwork[]>();
        networks.forEach(network => {
            const locationKey = network.psuLocation?.location?.trim() || 'Unassigned Location';
            if (!groupedByLocation.has(locationKey)) {
                groupedByLocation.set(locationKey, []);
            }
            groupedByLocation.get(locationKey)!.push(network);
        });

        const sortedLocations = Array.from(groupedByLocation.keys()).sort((a, b) => a.localeCompare(b));

        sortedLocations.forEach(location => {
            const networksInLocation = groupedByLocation.get(location)!;
            let locationTotalEcg = 0;
            let locationTotalEcd = 0;
            networksInLocation.forEach(net => {
                const counts = getDeviceCounts(net.id);
                locationTotalEcg += counts.ecg;
                locationTotalEcd += counts.ecd;
            });

            const locationRow = ws.addRow(['', location, '', '', locationTotalEcg, locationTotalEcd]);
            locationRow.getCell(2).font = { bold: true, italic: true };
            ws.mergeCells(locationRow.number, 2, locationRow.number, 4);
            locationRow.getCell(5).font = { bold: true };
            locationRow.getCell(6).font = { bold: true };
            applyStylesToRow(locationRow, {}, true);

            networksInLocation.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

            networksInLocation.forEach(network => {
                const counts = getDeviceCounts(network.id);
                const detailRow = ws.addRow(['', '', network.name, network.psuLocation!.page, counts.ecg || '', counts.ecd || '']);
                detailRow.getCell(3).alignment = { indent: 1 };
                detailRow.getCell(4).alignment = { horizontal: 'center' };
                detailRow.getCell(5).alignment = { horizontal: 'center' };
                detailRow.getCell(6).alignment = { horizontal: 'center' };
                applyStylesToRow(detailRow, {}, true);
            });
        });

        ws.addRow([]);
    });
}


// --- Sheet Data & Styling Helpers ---

interface ExcelSheetRow {
    type: 'discipline' | 'symbol';
    data: (string | number)[];
    level: number;
}

function generateSymbolSheetData(aggregatedData: AggregatedData, disciplines: Discipline[], areasForSheet: Area[], onlyCounted: boolean, isSummarySheet: boolean, filterByPdfId?: string): { rows: ExcelSheetRow[], contentAdded: boolean, areaColumns: (Area | {id: string, name: string})[] } {
    let contentAdded = false;
    const rows: ExcelSheetRow[] = [];
    
    const linearDisciplineId = disciplines.find(d => d.name === LINEAR_DISCIPLINE_NAME && !d.parentId)?.id;

    const sortedAreas = areasForSheet.filter(area => area.name).sort((a, b) => a.name.localeCompare(b.name));
    const areaColumns = [...sortedAreas, { id: 'unassigned', name: 'Area Unassigned' }];
    
    const generateRowsForDiscipline = (parentId: string | null, level: number) => {
        const currentDisciplines = disciplines.filter(d => d.parentId === parentId && d.id !== linearDisciplineId).sort((a,b) => a.name.localeCompare(b.name));
        
        currentDisciplines.forEach(discipline => {
            const disciplineSymbols = Array.from(aggregatedData.values())
                .filter(entry => entry.refSymbol.disciplineId === discipline.id)
                .sort((a, b) => a.refSymbol.name.localeCompare(b.refSymbol.name));

            const symbolRows = generateSymbolRows(disciplineSymbols, areaColumns, onlyCounted, level + 1, isSummarySheet, filterByPdfId);

            if (symbolRows.length > 0) {
                if (contentAdded) rows.push({type: 'symbol', data:[], level: 0}); // spacer
                rows.push({ type: 'discipline', data: [discipline.name], level });
                rows.push(...symbolRows);
                contentAdded = true;
            }
            generateRowsForDiscipline(discipline.id, level + 1);
        });
    };
    
    generateRowsForDiscipline(null, 0);

    const uncategorizedSymbols = Array.from(aggregatedData.values()).filter(e => !e.refSymbol.disciplineId).sort((a, b) => a.refSymbol.name.localeCompare(b.refSymbol.name));
    const uncatSymbolRows = generateSymbolRows(uncategorizedSymbols, areaColumns, onlyCounted, 1, isSummarySheet, filterByPdfId);
    if (uncatSymbolRows.length > 0) {
         if (contentAdded) rows.push({type: 'symbol', data:[], level: 0});
         rows.push({ type: 'discipline', data: ['Uncategorized'], level: 0 });
         rows.push(...uncatSymbolRows);
         contentAdded = true;
    }
    
    return { rows, contentAdded, areaColumns };
}

function generateSymbolRows(symbolEntries: AggregatedEntry[], areaColumns: (Area | {id: string, name: string})[], onlyCounted: boolean, level: number, isSummarySheet: boolean, filterByPdfId?: string): ExcelSheetRow[] {
    const rows: ExcelSheetRow[] = [];
    symbolEntries.forEach(entry => {
        let grandTotal = 0;
        const countsByArea = new Map<string, number>();

        const allSymbolsInEntry = [entry, ...Array.from(entry.children.values())];
        
        allSymbolsInEntry.forEach(symbolData => {
            if (isSummarySheet) {
                grandTotal += symbolData.counts.total;
            } else {
                const pdfMap = symbolData.counts.byPdfAndArea.get(filterByPdfId!);
                if (pdfMap) {
                    pdfMap.forEach((count, areaId) => {
                        countsByArea.set(areaId, (countsByArea.get(areaId) || 0) + count);
                    });
                }
            }
        });
        
        if (!isSummarySheet) {
            grandTotal = Array.from(countsByArea.values()).reduce((sum, count) => sum + count, 0);
        }

        if (onlyCounted && grandTotal === 0) return;

        const rowData: (string|number)[] = ['', sanitizeText(entry.refSymbol.name)];
        if (isSummarySheet) {
            rowData.push(grandTotal);
        } else {
            areaColumns.forEach(col => {
                const count = countsByArea.get(col.id) || 0;
                rowData.push(count);
            });
            rowData.push(grandTotal);
        }
        rows.push({ type: 'symbol', data: rowData, level });
    });
    return rows;
}

function addStyledDataToSheet(ws: any, sheetRows: ExcelSheetRow[], title: string, headers: string[]) {
    const headerRow = ws.addRow([title]);
    headerRow.font = { name: 'Calibri', size: 14, bold: true, color: { argb: "FF008000" } };
    ws.mergeCells(headerRow.number, 1, headerRow.number, headers.length);
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 22;
    ws.addRow([]); // Spacer

    const tableHeader = ws.addRow(headers);
    applyStylesToRow(tableHeader, { font: { bold: true }, alignment: { horizontal: 'center' } }, true);

    sheetRows.forEach(rowInfo => {
        if(rowInfo.data.length === 0){
            ws.addRow([]);
            return;
        }

        const dataRow = ws.addRow(rowInfo.data);
        if (rowInfo.type === 'discipline') {
            const cell = dataRow.getCell(1);
            cell.value = ' '.repeat(rowInfo.level * 2) + cell.value;
            cell.font = { bold: true, italic: true };
        } else if (rowInfo.type === 'symbol') {
            const firstCell = dataRow.getCell(1);
            firstCell.value = ' '.repeat(rowInfo.level * 2) + firstCell.value;
            
            dataRow.eachCell((cell: any, colNumber: number) => {
                cell.border = thinBorder;
                if(colNumber > 2) { // Count columns
                    cell.alignment = { horizontal: 'center' };
                    if (cell.value === 0) cell.value = null; // Show blanks for 0
                }
            });
            dataRow.getCell(dataRow.cellCount).font = { bold: true };
        }
    });
}
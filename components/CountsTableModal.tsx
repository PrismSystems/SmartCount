
import React, { useMemo } from 'react';
import type { Project, Discipline, LinearMeasurement, ScaleInfo, PdfFile, MeasurementGroup, DaliNetwork, DaliDevice } from '../types';
import { aggregateSymbolData, AggregatedEntry, AggregatedData } from '../services/excelExportService';
import { measurementService } from '../services/measurementService';

interface CountsTableModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: Project | null;
}

const renderDisciplineRows = (
    discipline: Discipline,
    aggregatedData: AggregatedData,
    disciplines: Discipline[],
    level: number = 0
): JSX.Element[] => {
    const disciplineSymbols = Array.from(aggregatedData.values())
        .filter(entry => entry.refSymbol.disciplineId === discipline.id)
        .sort((a, b) => a.refSymbol.name.localeCompare(b.refSymbol.name));

    const symbolRows = disciplineSymbols.map(entry => {
        const allSymbolsInGroup = [entry, ...Array.from(entry.children.values())];
        const totalCount = allSymbolsInGroup.reduce((sum, s) => sum + s.counts.total, 0);
        if (totalCount === 0) return null;

        return (
            <tr key={entry.refSymbol.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="py-2 px-4 text-gray-800" style={{ paddingLeft: `${2.5 + level * 1.5}rem` }}>
                    {entry.refSymbol.name}
                </td>
                <td className="py-2 px-4 text-center font-semibold text-gray-800">
                    {totalCount}
                </td>
            </tr>
        );
    }).filter(Boolean) as JSX.Element[];

    const childDisciplines = disciplines
        .filter(d => d.parentId === discipline.id)
        .sort((a, b) => a.name.localeCompare(b.name));

    const allChildRows = childDisciplines.flatMap(child =>
        renderDisciplineRows(child, aggregatedData, disciplines, level + 1)
    );

    if (symbolRows.length === 0 && allChildRows.length === 0) {
        return [];
    }
    
    return [
        <tr key={discipline.id} className="bg-gray-100 sticky top-0">
            <td colSpan={2} className="py-2 px-4 font-bold text-gray-700" style={{ paddingLeft: `${1 + level * 1.5}rem` }}>
                {discipline.name}
            </td>
        </tr>,
        ...symbolRows,
        ...allChildRows
    ];
};


export const CountsTableModal: React.FC<CountsTableModalProps> = ({ isOpen, onClose, project }) => {
    
    const { symbolRows, grandTotal, measurementRows, daliRows, hasContent } = useMemo(() => {
        if (!project) return { symbolRows: [], grandTotal: 0, measurementRows: [], daliRows: [], hasContent: false };

        // Symbol aggregation
        const aggregatedData = aggregateSymbolData(project.symbols);
        let grandTotal = 0;
        
        const topLevelDisciplines = project.disciplines
            .filter(d => !d.parentId)
            .sort((a, b) => a.name.localeCompare(b.name));

        const disciplineRows = topLevelDisciplines.flatMap(disc =>
            renderDisciplineRows(disc, aggregatedData, project.disciplines)
        );
            
        const uncategorizedSymbols = Array.from(aggregatedData.values())
            .filter(entry => !entry.refSymbol.disciplineId)
            .sort((a, b) => a.refSymbol.name.localeCompare(b.refSymbol.name));
            
        let uncategorizedRows: JSX.Element[] = [];
        if (uncategorizedSymbols.some(entry => (entry.counts.total + Array.from(entry.children.values()).reduce((s, c) => s + c.counts.total, 0)) > 0)) {
            uncategorizedRows.push(
                <tr key="uncategorized-header" className="bg-gray-100 sticky top-0">
                    <td colSpan={2} className="py-2 px-4 font-bold text-gray-700">
                        Uncategorized
                    </td>
                </tr>
            );
            uncategorizedSymbols.forEach(entry => {
                const allSymbolsInGroup = [entry, ...Array.from(entry.children.values())];
                const totalCount = allSymbolsInGroup.reduce((sum, s) => sum + s.counts.total, 0);
                if (totalCount === 0) return;

                uncategorizedRows.push(
                    <tr key={entry.refSymbol.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="py-2 px-4 text-gray-800 pl-10">
                            {entry.refSymbol.name}
                        </td>
                        <td className="py-2 px-4 text-center font-semibold text-gray-800">
                            {totalCount}
                        </td>
                    </tr>
                );
            });
        }
        
        Array.from(aggregatedData.values()).forEach(entry => {
            const allSymbolsInGroup = [entry, ...Array.from(entry.children.values())];
            grandTotal += allSymbolsInGroup.reduce((sum, s) => sum + s.counts.total, 0);
        });

        const finalSymbolRows = [...disciplineRows, ...uncategorizedRows];

        // Measurement processing
        const pdfMap = new Map(project.pdfs.map(p => [p.id, p]));
        const measurementGroups = project.measurementGroups || [];

        const renderMeasurementGroupRows = (parentId: string | null, level: number = 0): JSX.Element[] => {
            const groups = measurementGroups.filter(g => g.parentId === parentId).sort((a,b) => a.name.localeCompare(b.name));
            
            return groups.flatMap(group => {
                const groupMeasurements = project.measurements.filter(m => m.groupId === group.id).sort((a,b) => a.name.localeCompare(b.name));
                const childGroupRows = renderMeasurementGroupRows(group.id, level + 1);

                if(groupMeasurements.length === 0 && childGroupRows.length === 0) return [];
                
                const groupHeader = (
                    <tr key={group.id} className="bg-gray-100 sticky top-0">
                        <td colSpan={3} className="py-2 px-4 font-bold text-gray-700" style={{ paddingLeft: `${1 + level * 1.5}rem` }}>
                            {group.name}
                        </td>
                    </tr>
                );

                const measurementRowsForGroup = groupMeasurements.map(m => {
                    const pdf = pdfMap.get(m.pdfId);
                    const length = measurementService.calculateTotalLength(m, pdf?.scaleInfo);
                    return (
                        <tr key={m.id} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="py-2 px-4 text-gray-800" style={{ paddingLeft: `${2.5 + level * 1.5}rem` }}>{m.name}</td>
                            <td className="py-2 px-4 text-gray-800">{pdf?.name || 'Unknown'}</td>
                            <td className="py-2 px-4 text-center font-semibold" style={{color: m.color}}>{measurementService.formatLength(length)}</td>
                        </tr>
                    );
                });

                return [groupHeader, ...measurementRowsForGroup, ...childGroupRows];
            });
        };
        
        const topLevelMeasurementRows = renderMeasurementGroupRows(null);
        
        const ungroupedMeasurements = project.measurements
            .filter(m => !m.groupId)
            .sort((a, b) => a.name.localeCompare(b.name));

        let finalMeasurementRows: JSX.Element[] = [...topLevelMeasurementRows];

        if (ungroupedMeasurements.length > 0) {
            finalMeasurementRows.push(
                <tr key="ungrouped-measure-header" className="bg-gray-100 sticky top-0">
                    <td colSpan={3} className="py-2 px-4 font-bold text-gray-700">Ungrouped</td>
                </tr>
            );
            ungroupedMeasurements.forEach(m => {
                 const pdf = pdfMap.get(m.pdfId);
                 const length = measurementService.calculateTotalLength(m, pdf?.scaleInfo);
                 finalMeasurementRows.push(
                    <tr key={m.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="py-2 px-4 text-gray-800 pl-10">{m.name}</td>
                        <td className="py-2 px-4 text-gray-800">{pdf?.name || 'Unknown'}</td>
                        <td className="py-2 px-4 text-center font-semibold" style={{color: m.color}}>{measurementService.formatLength(length)}</td>
                    </tr>
                 );
            });
        }
        
        // DALI processing
        const daliRows = (project.daliNetworks || [])
        .sort((a,b) => a.name.localeCompare(b.name))
        .map(network => {
            const ecgCount = (project.daliDevices || []).filter(d => d.networkId === network.id && d.type === 'ECG').length;
            const ecdCount = (project.daliDevices || []).filter(d => d.networkId === network.id && d.type === 'ECD').length;
            
            if (ecgCount === 0 && ecdCount === 0) return null;

            return (
                <tr key={network.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-2 px-4 font-semibold text-gray-800">{network.name}</td>
                    <td className="py-2 px-4 text-center text-gray-800">{ecgCount}</td>
                    <td className="py-2 px-4 text-center text-gray-800">{ecdCount}</td>
                </tr>
            );
        }).filter(Boolean) as JSX.Element[];


        const hasContent = finalSymbolRows.length > 0 || finalMeasurementRows.length > 0 || daliRows.length > 0;

        return { symbolRows: finalSymbolRows, grandTotal, measurementRows: finalMeasurementRows, daliRows, hasContent };

    }, [project]);
    
    if (!isOpen || !project) return null;

    return (
        <div 
            className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 transition-opacity"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl transform transition-all flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-start mb-4">
                     <h2 className="text-xl font-bold text-gray-800">Project Summary</h2>
                     <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
                </div>
                
                <div className="flex-grow overflow-y-auto max-h-[70vh] space-y-8">
                    {!hasContent && (
                        <p className="text-center py-12 text-gray-500">No counted symbols or measurements in this project.</p>
                    )}
                    {symbolRows.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">Symbol Counts</h3>
                            <div className="border rounded-lg overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Symbol
                                            </th>
                                            <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                                                Total Count
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                    {symbolRows}
                                    </tbody>
                                    {symbolRows.length > 0 && (
                                        <tfoot className="sticky bottom-0">
                                            <tr className="bg-gray-100 font-bold ">
                                                <td className="py-3 px-4 text-right text-gray-800">Grand Total</td>
                                                <td className="py-3 px-4 text-center text-gray-800">{grandTotal}</td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    )}
                    {measurementRows.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">Linear Measurements</h3>
                            <div className="border rounded-lg overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Measurement Name</th>
                                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">Document</th>
                                            <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Total Length</th>
                                        </tr>
                                    </thead>
                                     <tbody className="bg-white divide-y divide-gray-200">
                                        {measurementRows}
                                     </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    {daliRows.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">DALI Networks</h3>
                            <div className="border rounded-lg overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Network Name</th>
                                            <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">ECG Count</th>
                                            <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">ECD Count</th>
                                        </tr>
                                    </thead>
                                     <tbody className="bg-white divide-y divide-gray-200">
                                        {daliRows}
                                     </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
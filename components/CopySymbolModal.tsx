
import React, { useState, useEffect } from 'react';
import type { SymbolInfo, PdfFile } from '../types';

interface CopySymbolModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCopy: (targetPdfIds: string[]) => void;
    symbolToCopy: SymbolInfo | null;
    pdfsInProject: PdfFile[];
}

export const CopySymbolModal: React.FC<CopySymbolModalProps> = ({
    isOpen,
    onClose,
    onCopy,
    symbolToCopy,
    pdfsInProject
}) => {
    const [selectedPdfIds, setSelectedPdfIds] = useState<string[]>([]);

    useEffect(() => {
        // Reset state when modal is opened for a new symbol
        if (isOpen) {
            setSelectedPdfIds([]);
        }
    }, [isOpen]);

    if (!isOpen || !symbolToCopy) {
        return null;
    }

    const handleCheckboxChange = (pdfId: string) => {
        setSelectedPdfIds(prev =>
            prev.includes(pdfId)
                ? prev.filter(id => id !== pdfId)
                : [...prev, pdfId]
        );
    };

    const handleCopy = () => {
        if (selectedPdfIds.length > 0) {
            onCopy(selectedPdfIds);
        }
    };
    
    // Don't show the PDF the symbol is already in
    const destinationPdfs = pdfsInProject.filter(p => p.id !== symbolToCopy.pdfId);

    return (
        <div 
            className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 transition-opacity"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md transform transition-all"
                onClick={e => e.stopPropagation()}
            >
                <h2 className="text-xl font-bold text-gray-800 mb-4">Copy Symbol</h2>
                
                <p className="text-sm text-gray-600 mb-4">
                    Copy <span className="font-semibold">{symbolToCopy.name}</span> to other documents in this project.
                </p>
                
                <div className="mb-6 max-h-60 overflow-y-auto border rounded-lg p-3 space-y-2">
                    {destinationPdfs.length > 0 ? (
                        destinationPdfs.map(pdf => (
                            <label key={pdf.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedPdfIds.includes(pdf.id)}
                                    onChange={() => handleCheckboxChange(pdf.id)}
                                    className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-gray-700 font-medium truncate">{pdf.name}</span>
                            </label>
                        ))
                    ) : (
                        <p className="text-center text-gray-500 p-4">No other documents available to copy to.</p>
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
                        onClick={handleCopy}
                        disabled={selectedPdfIds.length === 0}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Copy to {selectedPdfIds.length > 0 ? selectedPdfIds.length : ''} Document{selectedPdfIds.length !== 1 ? 's' : ''}
                    </button>
                </div>
            </div>
        </div>
    );
};

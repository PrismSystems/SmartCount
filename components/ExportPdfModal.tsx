
import React from 'react';

interface ExportPdfModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (withLabels: boolean) => void;
    isExporting: boolean;
}

export const ExportPdfModal: React.FC<ExportPdfModalProps> = ({ isOpen, onClose, onConfirm, isExporting }) => {
    if (!isOpen) {
        return null;
    }

    return (
        <div 
            className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 transition-opacity"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md transform transition-all"
                onClick={e => e.stopPropagation()}
            >
                <h2 className="text-xl font-bold text-gray-800 mb-4">PDF Export Options</h2>
                
                <p className="text-sm text-gray-600 mb-6">
                    Choose whether to include symbol labels on the exported PDF.
                </p>
                
                <div className="flex flex-col space-y-3">
                    <button
                        onClick={() => onConfirm(true)}
                        disabled={isExporting}
                        className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {isExporting ? 'Exporting...' : 'Export with Labels'}
                    </button>
                    <button
                        onClick={() => onConfirm(false)}
                        disabled={isExporting}
                        className="w-full px-4 py-3 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                         {isExporting ? 'Exporting...' : 'Export without Labels'}
                    </button>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                    <button
                        onClick={onClose}
                        disabled={isExporting}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors font-semibold disabled:opacity-50"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

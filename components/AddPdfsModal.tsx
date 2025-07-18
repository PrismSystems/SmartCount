
import React, { useState, useEffect } from 'react';

interface AddPdfsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (filesWithLevels: { file: File, level: string }[]) => void;
    files: File[];
}

export const AddPdfsModal: React.FC<AddPdfsModalProps> = ({ isOpen, onClose, onAdd, files }) => {
    const [levels, setLevels] = useState<string[]>([]);

    useEffect(() => {
        if (files) {
            setLevels(Array(files.length).fill(''));
        }
    }, [files]);

    if (!isOpen) return null;

    const handleLevelChange = (index: number, value: string) => {
        const newLevels = [...levels];
        newLevels[index] = value;
        setLevels(newLevels);
    };

    const handleAddClick = () => {
        const filesWithLevels = files.map((file, index) => ({
            file,
            level: levels[index] || '',
        }));
        onAdd(filesWithLevels);
    };

    return (
        <div 
            className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 transition-opacity"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg transform transition-all"
                onClick={e => e.stopPropagation()}
            >
                <h2 className="text-xl font-bold text-gray-800 mb-4">Assign Levels to New Documents</h2>
                <p className="text-sm text-gray-600 mb-4">
                    Please provide a level for each of the documents you are adding. This can be a floor number (e.g., L01, G, 2) or any other identifier.
                </p>

                <div className="mb-6 max-h-80 overflow-y-auto border rounded-lg p-3 space-y-3">
                    {files.map((file, index) => (
                        <div key={file.name} className="flex items-center space-x-4 p-2 rounded-md bg-gray-50">
                            <span className="flex-1 text-gray-700 font-medium truncate" title={file.name}>{file.name}</span>
                            <input
                                type="text"
                                placeholder="e.g., Level 1"
                                value={levels[index] || ''}
                                onChange={(e) => handleLevelChange(index, e.target.value)}
                                className="w-48 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    ))}
                </div>

                <div className="flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors font-semibold"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleAddClick}
                        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold"
                    >
                        Add Documents
                    </button>
                </div>
            </div>
        </div>
    );
};



import React, { useState, useRef } from 'react';
import type { Project } from '../types';
import { UploadIcon, TrashIcon } from './icons';

interface ProjectScreenProps {
    projects: Project[];
    onCreate: (name: string, filesWithLevels: { file: File, level: string }[], templateId: string | null) => void;
    onLoad: (id: string) => void;
    onDelete: (id: string) => void | Promise<void>;
    onRestoreSingleProject: (file: File) => void;
}

export const ProjectScreen: React.FC<ProjectScreenProps> = ({ projects, onCreate, onLoad, onDelete, onRestoreSingleProject }) => {
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectFiles, setNewProjectFiles] = useState<File[]>([]);
    const [newProjectLevels, setNewProjectLevels] = useState<string[]>([]);
    const [templateId, setTemplateId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const restoreInputRef = useRef<HTMLInputElement>(null);

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProjectName.trim()) {
            setError('Please enter a project name.');
            return;
        }
        if (newProjectFiles.length === 0) {
            setError('Please select at least one PDF file.');
            return;
        }
        const filesWithLevels = newProjectFiles.map((file, index) => ({
            file,
            level: newProjectLevels[index] || ''
        }));
        onCreate(newProjectName.trim(), filesWithLevels, templateId);
        setNewProjectName('');
        setNewProjectFiles([]);
        setNewProjectLevels([]);
        setTemplateId(null);
        setError('');
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files ? Array.from(e.target.files) : [];
        setNewProjectFiles(files);
        setNewProjectLevels(Array(files.length).fill(''));
    };

    const handleRestoreClick = () => {
        restoreInputRef.current?.click();
    };

    const handleRestoreFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onRestoreSingleProject(file);
            if (restoreInputRef.current) {
                restoreInputRef.current.value = '';
            }
        }
    };
    
    const sortedProjects = [...projects].sort((a, b) => b.createdAt - a.createdAt);

    return (
        <div className="w-full h-full bg-gray-100 flex items-center justify-center p-8">
            <div className="w-full max-w-4xl mx-auto">
                <h1 className="text-4xl font-bold text-center text-gray-800 mb-2">Smart Count</h1>
                <p className="text-lg text-center text-gray-500 mb-12">Your takeoff, accelerated &#x1F680;.</p>

                <div className="grid md:grid-cols-2 gap-12">
                    {/* Create New Project Section */}
                    <div className="bg-white p-8 rounded-2xl shadow-lg">
                        <h2 className="text-2xl font-bold text-gray-700 mb-6">Create New Project</h2>
                        {error && <p className="text-red-500 mb-4">{error}</p>}
                        <form onSubmit={handleCreate} className="space-y-6">
                            <div>
                                <label htmlFor="project-name" className="block text-sm font-medium text-gray-600 mb-2">Project Name</label>
                                <input
                                    id="project-name"
                                    type="text"
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                    placeholder="e.g., Hospital Wing A Floor Plan"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label htmlFor="file-upload" className="block text-sm font-medium text-gray-600 mb-2">PDF Floor Plan(s)</label>
                                <label htmlFor="file-upload" className="w-full cursor-pointer bg-gray-50 text-gray-500 rounded-lg flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-all">
                                    <UploadIcon />
                                    <span className="ml-3 font-semibold truncate">{newProjectFiles.length > 0 ? `${newProjectFiles.length} file(s) selected` : 'Select PDF file(s)'}</span>
                                </label>
                                <input id="file-upload" type="file" accept=".pdf" multiple className="hidden" onChange={handleFileChange} />
                                {newProjectFiles.length > 0 && (
                                    <div className="mt-3 text-sm text-gray-500 space-y-2 max-h-24 overflow-y-auto p-2 border rounded-lg bg-gray-50">
                                        <p className="text-xs font-semibold text-gray-600 mb-2">Assign levels to your documents:</p>
                                        {newProjectFiles.map((f, index) => (
                                            <div key={f.name} className="flex items-center justify-between space-x-2">
                                                <p className="truncate flex-grow" title={f.name}>{f.name}</p>
                                                <input
                                                    type="text"
                                                    placeholder="Level (e.g., L01)"
                                                    value={newProjectLevels[index] || ''}
                                                    onChange={(e) => {
                                                        const newLevels = [...newProjectLevels];
                                                        newLevels[index] = e.target.value;
                                                        setNewProjectLevels(newLevels);
                                                    }}
                                                    className="p-1 border border-gray-300 rounded-md text-xs w-28"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label htmlFor="template-select" className="block text-sm font-medium text-gray-600 mb-2">Use Template (Optional)</label>
                                <select
                                    id="template-select"
                                    value={templateId || ''}
                                    onChange={(e) => setTemplateId(e.target.value || null)}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white"
                                >
                                    <option value="">No Template</option>
                                    {sortedProjects.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold text-lg hover:bg-blue-700 transition-all shadow-md">
                                Start Project
                            </button>
                        </form>
                    </div>

                    {/* Existing Projects Section */}
                    <div className="bg-white p-8 rounded-2xl shadow-lg">
                         <h2 className="text-2xl font-bold text-gray-700 mb-6">Existing Projects</h2>
                          <div className="mb-4">
                            <input
                                type="file"
                                ref={restoreInputRef}
                                className="hidden"
                                accept=".json"
                                onChange={handleRestoreFileChange}
                            />
                            <button onClick={handleRestoreClick} className="w-full py-2.5 bg-green-600 text-white rounded-lg font-semibold text-md hover:bg-green-700 transition-all shadow-md">
                                Restore Single Project
                            </button>
                         </div>
                         {sortedProjects.length === 0 ? (
                            <div className="text-center text-gray-500 py-10">
                                <p>You have no saved projects.</p>
                                <p>Create a new one to get started!</p>
                            </div>
                         ) : (
                            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 -mr-4">
                                {sortedProjects.map(p => (
                                    <div key={p.id} className="group flex items-center justify-between p-4 rounded-lg bg-gray-50 hover:bg-blue-50 transition-colors">
                                        <div>
                                            <p className="font-semibold text-gray-800">{p.name}</p>
                                            <p className="text-sm text-gray-500 truncate max-w-xs">{p.pdfs.map(pdf => pdf.name).join(', ')}</p>
                                        </div>
                                        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                             <button onClick={() => onLoad(p.id)} className="px-4 py-2 text-sm font-semibold bg-blue-500 text-white rounded-md hover:bg-blue-600">
                                                Load
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); if (window.confirm(`Are you sure you want to delete "${p.name}"?`)) onDelete(p.id); }}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-full"
                                                aria-label="Delete project"
                                            >
                                                <TrashIcon />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                         )}
                    </div>
                </div>
            </div>
        </div>
    );
};
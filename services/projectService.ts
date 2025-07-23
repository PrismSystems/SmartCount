

import type { Project, SymbolInfo, Discipline, PdfFile, Area, LinearMeasurement, MeasurementGroup, DaliNetwork, DaliDevice, EcdType, DaliNetworkTemplate } from '../types';
import { apiService } from './apiService';
import { authService } from './authService';

// Keep the backup/restore interfaces for compatibility
interface AllBackupData {
    projects: Project[];
    pdfStore: { id: string; data: string }[];
}

interface SingleProjectBackupData {
    type: 'singleProjectBackup';
    version: '1.0';
    project: Project;
    pdfStore: { id: string; data: string }[];
}

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]); // Remove data:application/pdf;base64, prefix
        };
        reader.onerror = error => reject(error);
    });
};

const getProjects = async (username: string): Promise<Project[]> => {
    try {
        return await apiService.getProjects();
    } catch (error) {
        console.error('Failed to fetch projects:', error);
        return [];
    }
};

const createProject = async (
    username: string, 
    name: string, 
    filesWithLevels: { file: File, level: string }[], 
    templateProjectId?: string | null
): Promise<Project> => {
    try {
        // Prepare initial data structure
        let initialData: any = {
            symbols: [],
            disciplines: [
                { id: 'disc_1', name: 'Electrical', parentId: null },
                { id: 'disc_2', name: 'Plumbing', parentId: null },
                { id: 'disc_3', name: 'HVAC', parentId: null },
            ],
            areas: [],
            measurements: [],
            measurementGroups: [],
            daliNetworks: [],
            daliDevices: [],
            ecdTypes: [],
            daliNetworkTemplates: [],
        };

        // If template is provided, copy its structure
        if (templateProjectId) {
            const projects = await getProjects(username);
            const templateProject = projects.find(p => p.id === templateProjectId);
            if (templateProject) {
                initialData = {
                    symbols: templateProject.symbols || [],
                    disciplines: templateProject.disciplines || initialData.disciplines,
                    areas: [], // Don't copy areas
                    measurements: [], // Don't copy measurements
                    measurementGroups: templateProject.measurementGroups || [],
                    daliNetworks: [], // Don't copy networks
                    daliDevices: [], // Don't copy devices
                    ecdTypes: templateProject.ecdTypes || [],
                    daliNetworkTemplates: templateProject.daliNetworkTemplates || [],
                };
            }
        }

        const files = filesWithLevels.map(f => f.file);
        const project = await apiService.createProject(name, files, initialData);
        
        // Update PDF levels if provided
        if (project.pdfs && filesWithLevels.some(f => f.level)) {
            const updatedPdfs = project.pdfs.map((pdf, index) => ({
                ...pdf,
                level: filesWithLevels[index]?.level || ''
            }));
            
            const updatedProject = {
                ...project,
                pdfs: updatedPdfs,
                ...initialData
            };
            
            return await saveProject(username, updatedProject);
        }

        return { ...project, ...initialData };
    } catch (error) {
        console.error('Failed to create project:', error);
        throw error;
    }
};

const saveProject = async (username: string, project: Project): Promise<Project> => {
    try {
        return await apiService.updateProject(project.id, {
            name: project.name,
            data: {
                symbols: project.symbols,
                disciplines: project.disciplines,
                areas: project.areas,
                measurements: project.measurements,
                measurementGroups: project.measurementGroups,
                daliNetworks: project.daliNetworks,
                daliDevices: project.daliDevices,
                ecdTypes: project.ecdTypes,
                daliNetworkTemplates: project.daliNetworkTemplates,
            }
        });
    } catch (error) {
        console.error('Failed to save project:', error);
        throw error;
    }
};

const deleteProject = async (username: string, projectId: string): Promise<void> => {
    try {
        await apiService.deleteProject(projectId);
    } catch (error) {
        console.error('Failed to delete project:', error);
        throw error;
    }
};

const addPdfsToProject = async (
    username: string, 
    project: Project, 
    filesWithLevels: { file: File, level: string }[]
): Promise<Project> => {
    try {
        const files = filesWithLevels.map(f => f.file);
        const updatedProject = await apiService.addPdfsToProject(project.id, files);
        
        // Update levels if provided
        if (filesWithLevels.some(f => f.level)) {
            const newPdfsStartIndex = project.pdfs.length;
            const updatedPdfs = updatedProject.pdfs.map((pdf, index) => {
                if (index >= newPdfsStartIndex) {
                    const levelIndex = index - newPdfsStartIndex;
                    return {
                        ...pdf,
                        level: filesWithLevels[levelIndex]?.level || ''
                    };
                }
                return pdf;
            });
            
            return await saveProject(username, {
                ...updatedProject,
                pdfs: updatedPdfs
            });
        }
        
        return updatedProject;
    } catch (error) {
        console.error('Failed to add PDFs to project:', error);
        throw error;
    }
};

const getPdfData = async (pdfId: string): Promise<string> => {
    try {
        return await apiService.getPdfData(pdfId);
    } catch (error) {
        console.error('Failed to get PDF data:', error);
        throw error;
    }
};

// Backup/restore functions - these will work with local data for now
const exportAllBackup = async (username: string): Promise<void> => {
    try {
        const projects = await getProjects(username);
        if (!projects || projects.length === 0) {
            throw new Error("No data to back up for this user.");
        }

        // For now, we'll export without PDF data since it's stored in S3
        const backupData: Omit<AllBackupData, 'pdfStore'> & { pdfStore: any[] } = {
            projects: projects,
            pdfStore: [] // PDF data is in S3, not included in backup
        };

        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        a.download = `smart-count-full-backup-${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Failed to export backup:', error);
        throw error;
    }
};

const exportSingleProjectBackup = async (username: string, projectId: string): Promise<void> => {
    try {
        const projects = await getProjects(username);
        const projectToBackup = projects.find(p => p.id === projectId);

        if (!projectToBackup) {
            throw new Error("Project not found.");
        }

        const backupData: Omit<SingleProjectBackupData, 'pdfStore'> & { pdfStore: any[] } = {
            type: 'singleProjectBackup',
            version: '1.0',
            project: projectToBackup,
            pdfStore: [] // PDF data is in S3, not included in backup
        };

        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeProjectName = projectToBackup.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const timestamp = new Date().toISOString().slice(0, 10);
        a.download = `smart-count-backup_${safeProjectName}_${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Failed to export single project backup:', error);
        throw error;
    }
};

// Import functions - simplified for now
const importAllBackup = async (username: string, file: File): Promise<{ success: boolean; message: string }> => {
    try {
        // For now, return a message that this feature needs backend support
        return {
            success: false,
            message: "Backup restore is not yet implemented for the server version. Please contact support."
        };
    } catch (error) {
        console.error('Failed to import backup:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : "Import failed"
        };
    }
};

const importSingleProjectBackup = async (username: string, file: File): Promise<{ success: boolean; message: string }> => {
    try {
        // For now, return a message that this feature needs backend support
        return {
            success: false,
            message: "Single project restore is not yet implemented for the server version. Please contact support."
        };
    } catch (error) {
        console.error('Failed to import single project backup:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : "Import failed"
        };
    }
};

export const projectService = {
    getProjects,
    createProject,
    saveProject,
    deleteProject,
    addPdfsToProject,
    getPdfData,
    exportAllBackup,
    exportSingleProjectBackup,
    importAllBackup,
    importSingleProjectBackup,
};

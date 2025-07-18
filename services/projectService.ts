

import type { Project, SymbolInfo, Discipline, PdfFile, Area, LinearMeasurement, MeasurementGroup, DaliNetwork, DaliDevice, EcdType, DaliNetworkTemplate } from '../types';

// ====== START of IndexedDB Service Logic ======
const DB_NAME = 'SmartCountDB';
const DB_VERSION = 1;
const PDF_STORE_NAME = 'pdfFiles';

let dbInstance: IDBDatabase | null = null;

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


const getDb = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (dbInstance) {
            return resolve(dbInstance);
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => {
            console.error('IndexedDB error:', request.error);
            reject('IndexedDB error');
        };
        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(PDF_STORE_NAME)) {
                db.createObjectStore(PDF_STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

const dbService = {
    async savePdf(id: string, data: string): Promise<void> {
        const db = await getDb();
        const transaction = db.transaction(PDF_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(PDF_STORE_NAME);
        return new Promise((resolve, reject) => {
            const request = store.put({ id, data });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },
    async getPdf(id: string): Promise<string | undefined> {
        const db = await getDb();
        const transaction = db.transaction(PDF_STORE_NAME, 'readonly');
        const store = transaction.objectStore(PDF_STORE_NAME);
        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => {
                resolve(request.result?.data);
            };
            request.onerror = () => reject(request.error);
        });
    },
    async getPdfsByIds(ids: string[]): Promise<{ id: string; data: string }[]> {
        if (!ids.length) return [];
        const db = await getDb();
        const transaction = db.transaction(PDF_STORE_NAME, 'readonly');
        const store = transaction.objectStore(PDF_STORE_NAME);

        const results: { id: string; data: string }[] = [];
        const promises = ids.map(id =>
            new Promise<void>((resolve, reject) => {
                const request = store.get(id);
                request.onsuccess = () => {
                    if (request.result) {
                        results.push(request.result);
                    }
                    resolve();
                };
                request.onerror = () => {
                    console.error(`Failed to get PDF ${id} from IndexedDB:`, request.error);
                    reject(request.error);
                };
            })
        );
        await Promise.all(promises);
        return results;
    },
    async deletePdfs(ids: string[]): Promise<void> {
        if (!ids.length) return;
        const db = await getDb();
        const transaction = db.transaction(PDF_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(PDF_STORE_NAME);
        
        const deletePromises = ids.map(id => {
            return new Promise<void>((resolve) => {
                const request = store.delete(id);
                request.onsuccess = () => resolve();
                request.onerror = () => {
                    console.error(`Failed to delete PDF ${id} from IndexedDB:`, request.error);
                    resolve();
                };
            });
        });
        
        await Promise.all(deletePromises);
    },
};
// ====== END of IndexedDB Service Logic ======


// The key for the entire multi-user database in localStorage
const DB_STORAGE_KEY = 'smart-count-db';

interface UserData {
    projects: Project[];
}

interface Database {
    [username: string]: UserData;
}

const getFullDatabase = (): Database => {
    try {
        const dbJson = localStorage.getItem(DB_STORAGE_KEY);
        return dbJson ? JSON.parse(dbJson) : {};
    } catch (error) {
        console.error("Failed to load database from localStorage", error);
        return {};
    }
};

const saveFullDatabase = (db: Database): void => {
    try {
        const dbToStore = JSON.parse(JSON.stringify(db));
        // Create a deep copy and remove PDF data before saving to localStorage
        Object.values(dbToStore).forEach((userData: any) => {
            userData.projects.forEach((project: Project) => {
                project.pdfs.forEach((pdf: PdfFile) => {
                    delete (pdf as any).data;
                });
            });
        });
        localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(dbToStore));
    } catch (error) {
        console.error("Failed to save database to localStorage", error);
         if (error instanceof DOMException && error.name === 'QuotaExceededError') {
             alert("Error: Storage quota exceeded. Please try deleting some old projects.");
        }
    }
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

const getProjects = (username: string): Project[] => {
    const db = getFullDatabase();
    return db[username]?.projects || [];
};

const saveProject = (username: string, projectToSave: Project): void => {
    const db = getFullDatabase();
    if (!db[username]) {
        db[username] = { projects: [] };
    }
    const projects = db[username].projects;
    const projectIndex = projects.findIndex(p => p.id === projectToSave.id);
    if (projectIndex > -1) {
        projects[projectIndex] = projectToSave;
    } else {
        // This case should ideally not be hit if creating projects is handled properly
        projects.push(projectToSave);
    }
    db[username].projects = projects;
    saveFullDatabase(db);
};

const createProject = async (username: string, name: string, filesWithLevels: { file: File, level: string }[], templateProjectId?: string | null): Promise<Project> => {
    const pdfPromises = filesWithLevels.map(async ({ file, level }, index) => {
        const data = await fileToBase64(file);
        const pdfFile: PdfFile = {
            id: `${username}_pdf_${Date.now()}_${index}`,
            name: file.name,
            level: level || '',
            data
        };
        await dbService.savePdf(pdfFile.id, data);
        return pdfFile;
    });
    const pdfs = await Promise.all(pdfPromises);
    
    let initialSymbols: SymbolInfo[] = [];
    let initialDisciplines: Discipline[] = [
        { id: 'disc_1', name: 'Electrical', parentId: null },
        { id: 'disc_2', name: 'Plumbing', parentId: null },
        { id: 'disc_3', name: 'HVAC', parentId: null },
    ];
    let initialAreas: Area[] = [];
    let initialMeasurements: LinearMeasurement[] = [];
    let initialMeasurementGroups: MeasurementGroup[] = [];
    let initialDaliNetworks: DaliNetwork[] = [];
    let initialDaliDevices: DaliDevice[] = [];
    let initialEcdTypes: EcdType[] = [];
    let initialDaliNetworkTemplates: DaliNetworkTemplate[] = [];


    if (templateProjectId) {
        const userProjects = getProjects(username);
        const templateProject = userProjects.find(p => p.id === templateProjectId);

        if (templateProject) {
            initialDisciplines = JSON.parse(JSON.stringify(templateProject.disciplines));
            initialAreas = JSON.parse(JSON.stringify(templateProject.areas));
            initialMeasurementGroups = JSON.parse(JSON.stringify(templateProject.measurementGroups || []));
            initialDaliNetworks = JSON.parse(JSON.stringify(templateProject.daliNetworks || []));
            initialEcdTypes = JSON.parse(JSON.stringify(templateProject.ecdTypes || []));
            initialDaliNetworkTemplates = JSON.parse(JSON.stringify(templateProject.daliNetworkTemplates || []));
            
            // Note: We don't copy measurements or devices between PDFs as they are location-specific.
            initialMeasurements = [];
            initialDaliDevices = [];

            const templateSymbols = JSON.parse(JSON.stringify(templateProject.symbols));
            
            const newSymbols: SymbolInfo[] = [];
            pdfs.forEach(pdf => {
                const parentIdMap = new Map<string, string>();
                
                templateSymbols.filter((s: SymbolInfo) => !s.parentId).forEach((parentSymbol: SymbolInfo) => {
                    const newParentId = `sym_${pdf.id}_${Date.now()}_${Math.random()}`;
                    parentIdMap.set(parentSymbol.id, newParentId);
                    newSymbols.push({
                        ...parentSymbol,
                        id: newParentId,
                        pdfId: pdf.id,
                        count: 0,
                        locations: [],
                        status: 'done' as 'done',
                        parentId: null,
                    });
                });

                templateSymbols.filter((s: SymbolInfo) => s.parentId).forEach((childSymbol: SymbolInfo) => {
                    if (childSymbol.parentId) {
                        const newParentId = parentIdMap.get(childSymbol.parentId);
                        if (newParentId) {
                            const newChildId = `sym_${pdf.id}_${Date.now()}_${Math.random()}`;
                            newSymbols.push({
                                ...childSymbol,
                                id: newChildId,
                                parentId: newParentId,
                                pdfId: pdf.id,
                                count: 0,
                                locations: [],
                                status: 'done' as 'done',
                            });
                        }
                    }
                });
            });
            initialSymbols = newSymbols;
        }
    }

    const newProject: Project = {
        id: `proj_${Date.now()}`,
        name,
        pdfs,
        symbols: initialSymbols,
        disciplines: initialDisciplines,
        areas: initialAreas,
        measurements: initialMeasurements,
        measurementGroups: initialMeasurementGroups,
        daliNetworks: initialDaliNetworks,
        daliDevices: initialDaliDevices,
        ecdTypes: initialEcdTypes,
        daliNetworkTemplates: initialDaliNetworkTemplates,
        createdAt: Date.now(),
    };

    const db = getFullDatabase();
    if (!db[username]) {
        db[username] = { projects: [] };
    }
    db[username].projects.push(newProject);
    saveFullDatabase(db);
    return newProject;
};

const addPdfsToProject = async (username: string, project: Project, filesWithLevels: { file: File, level: string }[]): Promise<Project> => {
    const pdfPromises = filesWithLevels.map(async ({ file, level }, index) => {
        const data = await fileToBase64(file);
        const pdfFile: PdfFile = {
            id: `${username}_pdf_${Date.now()}_${index}_add`,
            name: file.name,
            level: level || '',
            data,
        };
        await dbService.savePdf(pdfFile.id, data);
        return pdfFile;
    });
    const newPdfs = await Promise.all(pdfPromises);
    
    const updatedProject = {
        ...project,
        pdfs: [...project.pdfs, ...newPdfs],
    };

    saveProject(username, updatedProject); // Save the updated project back
    return updatedProject;
};

const deleteProject = async (username: string, id: string): Promise<void> => {
    const db = getFullDatabase();
    if (!db[username]) return;

    const projectToDelete = db[username].projects.find(p => p.id === id);

    if (projectToDelete) {
        const pdfIdsToDelete = projectToDelete.pdfs.map(p => p.id);
        await dbService.deletePdfs(pdfIdsToDelete);
    }
    
    db[username].projects = db[username].projects.filter(p => p.id !== id);
    saveFullDatabase(db);
};

const deletePdfFromProject = async (username: string, projectId: string, pdfId: string): Promise<Project | null> => {
    const db = getFullDatabase();
    if (!db[username]) return null;

    const projectIndex = db[username].projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) return null;

    const project = db[username].projects[projectIndex];
    
    const pdfToDelete = project.pdfs.find(p => p.id === pdfId);
    if (!pdfToDelete) return project;

    const updatedPdfs = project.pdfs.filter(p => p.id !== pdfId);
    const updatedSymbols = project.symbols.filter(s => s.pdfId !== pdfId);
    const updatedAreas = project.areas.filter(a => a.pdfId !== pdfId);
    const updatedMeasurements = project.measurements.filter(m => m.pdfId !== pdfId);
    const updatedDaliDevices = (project.daliDevices || []).filter(d => d.pdfId !== pdfId);


    await dbService.deletePdfs([pdfId]);

    const updatedProject: Project = {
        ...project,
        pdfs: updatedPdfs,
        symbols: updatedSymbols,
        areas: updatedAreas,
        measurements: updatedMeasurements,
        daliDevices: updatedDaliDevices,
    };

    db[username].projects[projectIndex] = updatedProject;
    saveFullDatabase(db);

    return updatedProject;
};

const exportAllBackup = async (username: string): Promise<void> => {
    const db = getFullDatabase();
    const userData = db[username];
    if (!userData || !userData.projects || userData.projects.length === 0) {
        throw new Error("No data to back up for this user.");
    }
    
    const allPdfIds = userData.projects.flatMap(p => p.pdfs.map(pdf => pdf.id));
    const pdfStore = await dbService.getPdfsByIds(allPdfIds);
    
    const backupData: AllBackupData = {
        projects: userData.projects,
        pdfStore: pdfStore
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
};

const exportSingleProjectBackup = async (username: string, projectId: string): Promise<void> => {
    const userProjects = getProjects(username);
    const projectToBackup = userProjects.find(p => p.id === projectId);

    if (!projectToBackup) {
        throw new Error("Project not found.");
    }

    const pdfIds = projectToBackup.pdfs.map(pdf => pdf.id);
    const pdfStore = await dbService.getPdfsByIds(pdfIds);

    const backupData: SingleProjectBackupData = {
        type: 'singleProjectBackup',
        version: '1.0',
        project: projectToBackup,
        pdfStore: pdfStore
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
};

const importAllBackup = async (username: string, file: File): Promise<{ success: boolean; message: string }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const content = event.target?.result;
                if (typeof content !== 'string') {
                    throw new Error('Failed to read file content.');
                }
                const backupData: AllBackupData & Partial<SingleProjectBackupData> = JSON.parse(content);
                
                // Basic validation
                if (backupData.type === 'singleProjectBackup') {
                    throw new Error('This appears to be a single project backup. Please use the "Restore Single Project" option.');
                }
                if (!backupData.projects || !backupData.pdfStore || !Array.isArray(backupData.projects)) {
                     throw new Error('Invalid backup file format for "All Projects".');
                }

                const db = getFullDatabase();
                
                // Delete old data for the user
                const oldUserData = db[username];
                if (oldUserData && oldUserData.projects) {
                    const oldPdfIds = oldUserData.projects.flatMap(p => p.pdfs.map(pdf => pdf.id));
                    await dbService.deletePdfs(oldPdfIds);
                }

                // Restore new data
                // 1. Restore projects to localStorage
                db[username] = { projects: backupData.projects };
                
                // 2. Restore PDFs to IndexedDB
                const pdfSavePromises = backupData.pdfStore.map(pdfData =>
                    dbService.savePdf(pdfData.id, pdfData.data)
                );
                await Promise.all(pdfSavePromises);

                // Save localStorage at the very end
                saveFullDatabase(db);

                resolve({ success: true, message: "Backup restored successfully. The application will now reload." });

            } catch (error) {
                console.error("Backup restore failed:", error);
                reject({ success: false, message: (error as Error).message || 'Failed to parse or restore backup file.' });
            }
        };
        reader.onerror = () => {
            reject({ success: false, message: 'Error reading file.' });
        };
        reader.readAsText(file);
    });
};

const importSingleProjectBackup = async (username: string, file: File): Promise<{ success: boolean; message: string }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const content = event.target?.result;
                if (typeof content !== 'string') {
                    throw new Error('Failed to read file content.');
                }
                const backupData: SingleProjectBackupData = JSON.parse(content);

                // Validation
                if (backupData.type !== 'singleProjectBackup' || !backupData.project || !backupData.pdfStore) {
                    throw new Error('This does not appear to be a valid single project backup file.');
                }

                const db = getFullDatabase();
                if (!db[username]) {
                    db[username] = { projects: [] };
                }
                const userProjects = db[username].projects;
                const importedProject = backupData.project;

                // Check for conflicts
                if (userProjects.some(p => p.id === importedProject.id)) {
                    throw new Error(`A project with the same internal ID (${importedProject.id}) already exists. This is highly unusual. Please contact support or backup and restore all projects.`);
                }
                if (userProjects.some(p => p.name.toLowerCase() === importedProject.name.toLowerCase())) {
                    throw new Error(`A project named "${importedProject.name}" already exists. Please rename the existing project before restoring this one.`);
                }
                
                // Restore PDFs to IndexedDB
                const pdfSavePromises = backupData.pdfStore.map(pdfData =>
                    dbService.savePdf(pdfData.id, pdfData.data)
                );
                await Promise.all(pdfSavePromises);

                // Add project to user's list
                userProjects.push(importedProject);
                saveFullDatabase(db);
                
                resolve({ success: true, message: `Project "${importedProject.name}" restored successfully. Please reload the application to see it in your list.` });

            } catch (error: any) {
                console.error("Single project restore failed:", error);
                reject({ success: false, message: error.message || 'Failed to parse or restore the project backup file.' });
            }
        };
        reader.onerror = () => {
            reject({ success: false, message: 'Error reading file.' });
        };
        reader.readAsText(file);
    });
};

export const projectService = {
    getProjects,
    createProject,
    saveProject,
    deleteProject,
    addPdfsToProject,
    deletePdfFromProject,
    getPdfData: dbService.getPdf,
    exportAllBackup,
    importAllBackup,
    exportSingleProjectBackup,
    importSingleProjectBackup,
};
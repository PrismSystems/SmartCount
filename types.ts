

export interface Location {
    x: number;
    y: number;
    width: number;
    height: number;
    areaId?: string;
}

export interface Area {
    id: string;
    name: string;
    pdfId: string;
    points: { x: number; y: number }[];
    isVisible: boolean;
    color: string;
}

export interface ScaleInfo {
    linePixels: number;
    knownLength: number; // Always in meters
}

export interface ManualEntry {
    id:string;
    length: number; // Always in meters
    // The point this entry is attached to, for visualization
    segmentIndex: number; 
    pointIndex: number;
}

export interface MeasurementGroup {
    id: string;
    name: string;
    parentId: string | null;
}

export interface LinearMeasurement {
    id:string;
    pdfId: string;
    name: string;
    color: string;
    points: { x: number; y: number }[][]; // Array of segments
    isVisible: boolean;
    manualEntries?: ManualEntry[];
    groupId: string | null;
}

export interface Discipline {
    id: string;
    name: string;
    parentId: string | null;
}

export interface PdfFile {
    id: string;
    name: string;
    level: string;
    data?: string; // base64, now optional as it's stored in IndexedDB
    scaleInfo?: ScaleInfo;
}

export interface SymbolInfo {
    id:string;
    name:string;
    image: string; // base64 data URL
    count: number;
    locations: Location[];
    color: string;
    page: number;
    pdfId: string;
    disciplineId: string | null;
    type: 'manual' | 'ai';
    parentId: string | null;
    variantText?: string;
    status?: 'pending' | 'processing' | 'done' | 'error';
}

export type DaliDeviceType = 'ECG' | 'ECD';

export interface EcdType {
    id: string;
    reference: string;
    productCode: string;
    description: string;
    busCurrent: number; // in mA
}

export interface DaliDevice {
    id: string;
    networkId: string;
    type: DaliDeviceType;
    shortAddress: number;
    location: Omit<Location, 'areaId'>;
    pdfId: string;
    page: number;
    ecdTypeId?: string;
}

export interface PsuLocation {
    x: number;
    y: number;
    width: number;
    height: number;
    pdfId: string;
    page: number;
    location?: string;
}

export interface DaliNetwork {
    id:string;
    name: string; // "DA1", "DA2"
    isVisible: boolean;
    ecgLimit: number;
    ecdLimit: number;
    powerSupplyCapacity: number; // in mA
    defaultEcdTypeId?: string | null;
    psuLocation?: PsuLocation;
}

export interface DaliNetworkTemplate {
    id: string;
    name: string;
    ecgLimit: number;
    ecdLimit: number;
    powerSupplyCapacity: number;
    defaultEcdTypeId: string | null;
}

export interface Project {
    id: string;
    name: string;
    pdfs: PdfFile[];
    symbols: SymbolInfo[];
    disciplines: Discipline[];
    areas: Area[];
    createdAt: number;
    measurements: LinearMeasurement[];
    measurementGroups: MeasurementGroup[];
    daliNetworks?: DaliNetwork[];
    daliDevices?: DaliDevice[];
    ecdTypes?: EcdType[];
    daliNetworkTemplates?: DaliNetworkTemplate[];
}
// services/driveService.ts
import { INITIAL_RATES, INITIAL_EMPLOYEES, INITIAL_CONFIG } from '../constants';

// Declare globals for Google Scripts
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = "https://www.googleapis.com/auth/drive.file";

let tokenClient: any;

export function initGapi() {
  return new Promise<void>((resolve, reject) => {
    if (typeof window.gapi === 'undefined') {
      reject(new Error("GAPI script not loaded")); 
      return;
    }
    window.gapi.load('client', async () => {
      try {
        await window.gapi.client.init({
          apiKey: API_KEY,
          discoveryDocs: DISCOVERY_DOCS,
        });
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}

export function initGis(onTokenCallback: (response: any) => void) {
  return new Promise<void>((resolve, reject) => {
    if (typeof window.google === 'undefined') {
      reject(new Error("GIS script not loaded"));
      return;
    }
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: onTokenCallback,
    });
    resolve();
  });
}

export function requestAccessToken() {
  if (!tokenClient) throw new Error("GIS not initialized");
  tokenClient.requestAccessToken({ prompt: '' });
}

// --- SMART SYSTEM LOADER ---

export interface SystemIds {
  rootId: string;
  configId: string;
  currentYearId: string;
}

export async function initializeSystem(): Promise<{ ids: SystemIds, data: any }> {
  // 1. Locate or Create Folders
  const rootName = "Gem_Payroll_System";
  let rootId = await findFile(rootName, 'application/vnd.google-apps.folder');
  if (!rootId) rootId = await createFolder(rootName);

  let configId = await findFile("00_Config", 'application/vnd.google-apps.folder', rootId);
  if (!configId) configId = await createFolder("00_Config", rootId);

  const year = new Date().getFullYear();
  const yearFolderName = `${year}_Payroll`;
  let yearFolderId = await findFile(yearFolderName, 'application/vnd.google-apps.folder', rootId);
  if (!yearFolderId) yearFolderId = await createFolder(yearFolderName, rootId);

  const ids = { rootId, configId, currentYearId: yearFolderId };

  // 2. Load Config Files (Or create them if they don't exist)
  const [rates, employees, config] = await Promise.all([
    ensureFile('master_rates.json', ids.configId, INITIAL_RATES),
    // We wrap the array in an object because Google Drive prefers JSON objects
    ensureFile('personnel_master_db.json', ids.configId, { employees: INITIAL_EMPLOYEES }),
    ensureFile('app_config.json', ids.configId, INITIAL_CONFIG)
  ]);

  return {
    ids,
    data: {
      rates,
      employees: employees.employees || employees, // Handle wrapper if present
      config
    }
  };
}

// Helper: Tries to find a file; if missing, creates it with default data
async function ensureFile(filename: string, parentId: string, defaultContent: any) {
  const existingId = await findFile(filename, 'application/json', parentId);
  
  if (existingId) {
    console.log(`Loading existing ${filename}...`);
    return await loadJsonFile(existingId);
  } else {
    console.log(`Creating new ${filename}...`);
    await saveJsonFile(filename, defaultContent, parentId);
    return defaultContent;
  }
}

// --- BASIC DRIVE OPERATIONS ---

async function findFile(name: string, mimeType: string, parentId?: string): Promise<string | null> {
  let query = `name = '${name}' and mimeType = '${mimeType}' and trashed = false`;
  if (parentId) query += ` and '${parentId}' in parents`;
  
  try {
    const response = await window.gapi.client.drive.files.list({
      q: query,
      fields: 'files(id, name)',
    });
    const files = response.result.files;
    return (files && files.length > 0) ? files[0].id : null;
  } catch (err) {
    console.error("Error finding file:", err);
    return null;
  }
}

async function createFolder(name: string, parentId?: string): Promise<string> {
  const metadata: any = {
    name: name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) metadata.parents = [parentId];
  
  const response = await window.gapi.client.drive.files.create({
    resource: metadata,
    fields: 'id',
  });
  return response.result.id;
}

export async function saveJsonFile(filename: string, content: any, parentId: string) {
  const fileContent = JSON.stringify(content, null, 2);
  const file = new Blob([fileContent], { type: 'application/json' });
  
  // Check if file exists to overwrite it
  const existingId = await findFile(filename, 'application/json', parentId);
  
  const tokenObj = window.gapi.client.getToken();
  if (!tokenObj) throw new Error("No Access Token");
  
  const metadata = {
    name: filename,
    mimeType: 'application/json',
    parents: existingId ? [] : [parentId],
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const url = existingId 
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const method = existingId ? 'PATCH' : 'POST';

  await fetch(url, {
    method: method,
    headers: new Headers({ 'Authorization': 'Bearer ' + tokenObj.access_token }),
    body: form,
  });
}

export async function loadJsonFile(fileId: string) {
  try {
    const response = await window.gapi.client.drive.files.get({
      fileId: fileId,
      alt: 'media',
    });
    return response.result;
  } catch (err) {
    console.error("Error loading file:", err);
    return null;
  }
}

// Fixed: Added underscore to rootId to ignore unused parameter warning
export async function listAllPayrollRuns(_rootId: string): Promise<DriveFile[]> {
  const q = `name contains 'Payroll_Run' and mimeType = 'application/json' and trashed = false`;
  try {
    const response = await window.gapi.client.drive.files.list({
      q: q,
      fields: 'files(id, name, createdTime)',
      orderBy: 'createdTime desc',
      pageSize: 50
    });
    return response.result.files || [];
  } catch (err) {
    return [];
  }
}

export interface DriveFile {
  id: string;
  name: string;
  createdTime?: string;
}
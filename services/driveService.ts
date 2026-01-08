import { INITIAL_RATES, INITIAL_EMPLOYEES, INITIAL_CONFIG } from '../constants';

// --- CONFIGURATION ---
const HARDCODED_ROOT_ID = "1MYPXAh9-juU58I403toaS3CqigObEjKn"; 


const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];

// CHANGED: Widen scope to ensure we see files created by Admin
const SCOPES = "https://www.googleapis.com/auth/drive"; 

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

let tokenClient: any;

export function initGapi() {
  return new Promise<void>((resolve, reject) => {
    if (typeof window.gapi === 'undefined') {
      reject(new Error("GAPI not loaded"));
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
      reject(new Error("GIS not loaded"));
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
  
  // 1. Use the Hardcoded ID directly
  // This solves the "Ghost Folder" issue
  const rootId = HARDCODED_ROOT_ID;
  
  // Safety check: verify we can access this folder
  try {
    await window.gapi.client.drive.files.get({ fileId: rootId });
  } catch (err) {
    console.error("Cannot access Hardcoded Root Folder. Check ID or Permissions.", err);
    throw new Error("Cannot access Root Folder. Please ensure it is shared with you.");
  }

  // 2. Find/Create Subfolders inside the known Root
  let configId = await findFile("00_Config", 'application/vnd.google-apps.folder', rootId);
  if (!configId) configId = await createFolder("00_Config", rootId);

  const year = new Date().getFullYear();
  const yearFolderName = `${year}_Payroll`;
  let yearFolderId = await findFile(yearFolderName, 'application/vnd.google-apps.folder', rootId);
  if (!yearFolderId) yearFolderId = await createFolder(yearFolderName, rootId);

  const ids = { rootId, configId, currentYearId: yearFolderId };

  // 3. Load Config Files
  // We use Promise.all to load them in parallel
  const [rates, employees, config] = await Promise.all([
    ensureFile('master_rates.json', ids.configId, INITIAL_RATES),
    ensureFile('personnel_master_db.json', ids.configId, { employees: INITIAL_EMPLOYEES }),
    ensureFile('app_config.json', ids.configId, INITIAL_CONFIG)
  ]);

  return {
    ids,
    data: {
      rates,
      employees: employees?.employees || employees || [],
      config
    }
  };
}

// --- BULLETPROOF JSON LOADER ---
export async function loadJsonFile(fileId: string) {
  try {
    const response = await window.gapi.client.drive.files.get({
      fileId: fileId,
      alt: 'media',
    });

    if (response.result && typeof response.result === 'object' && Object.keys(response.result).length > 0) {
      return response.result;
    }
    if (response.body) {
      try { return JSON.parse(response.body); } catch (e) { console.warn("Body parse failed"); }
    }
    if (typeof response.result === 'string') {
      return JSON.parse(response.result);
    }
    return null;
  } catch (err) {
    console.error(`Error loading file [${fileId}]:`, err);
    return null;
  }
}

// --- HELPERS ---

async function ensureFile(filename: string, parentId: string, defaultContent: any) {
  const existingId = await findFile(filename, 'application/json', parentId);
  if (existingId) {
    console.log(`Loading existing ${filename}...`);
    return await loadJsonFile(existingId);
  } else {
    // Only create if it TRULY doesn't exist
    console.log(`File ${filename} not found. Creating new default...`);
    await saveJsonFile(filename, defaultContent, parentId);
    return defaultContent;
  }
}

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
  const metadata: any = { name, mimeType: 'application/vnd.google-apps.folder' };
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
  const existingId = await findFile(filename, 'application/json', parentId);
  
  const tokenObj = window.gapi.client.getToken();
  if (!tokenObj) throw new Error("No Access Token");
  
  const metadata = { name: filename, mimeType: 'application/json', parents: existingId ? [] : [parentId] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const url = existingId 
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  await fetch(url, {
    method: existingId ? 'PATCH' : 'POST',
    headers: new Headers({ 'Authorization': 'Bearer ' + tokenObj.access_token }),
    body: form,
  });
}

export async function listAllPayrollRuns(_rootId: string): Promise<DriveFile[]> {
  const q = `name contains 'Payroll_Run' and mimeType = 'application/json' and trashed = false and '${_rootId}' in parents`;
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

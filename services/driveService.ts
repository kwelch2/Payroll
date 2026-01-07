// services/driveService.ts

// Global types for GAPI
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Scopes
const SCOPES = "https://www.googleapis.com/auth/drive.file";
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];

let tokenClient: any;

// --- INITIALIZATION ---

export function initGapi() {
  return new Promise<void>((resolve, reject) => {
    if (typeof window.gapi === 'undefined') {
      console.error("GAPI script not loaded.");
      reject(new Error("Google API script failed to load."));
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
    if (typeof window.google === 'undefined' || !window.google.accounts) {
      console.error("GIS script not loaded.");
      reject(new Error("Google Identity Services script failed to load."));
      return;
    }
    try {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse: any) => {
          onTokenCallback(tokenResponse);
        },
      });
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

export function requestAccessToken() {
  if (!tokenClient) {
    alert("Login service not ready. Please refresh.");
    throw new Error("GIS not initialized");
  }
  tokenClient.requestAccessToken({ prompt: '' });
}

// --- FOLDER & FILE LOGIC ---

export interface SystemIds {
  rootId: string;
  configId: string;
  currentYearId: string;
}

export async function ensureSystemFolders(): Promise<SystemIds> {
  const rootName = "Gem_Payroll_System";
  
  // 1. Root
  let rootId = await findFile(rootName, 'application/vnd.google-apps.folder');
  if (!rootId) rootId = await createFolder(rootName);

  // 2. Config
  let configId = await findFile("00_Config", 'application/vnd.google-apps.folder', rootId);
  if (!configId) configId = await createFolder("00_Config", rootId);

  // 3. Current Year
  const year = new Date().getFullYear();
  const yearFolderName = `${year}_Payroll`;
  let currentYearId = await findFile(yearFolderName, 'application/vnd.google-apps.folder', rootId);
  if (!currentYearId) currentYearId = await createFolder(yearFolderName, rootId);

  return { rootId, configId, currentYearId };
}

export async function fetchSystemConfig(configFolderId: string) {
  // Helper to find and load a specific file by name in the config folder
  const loadConfigByName = async (filename: string) => {
    try {
      const q = `'${configFolderId}' in parents and name = '${filename}' and mimeType = 'application/json' and trashed = false`;
      const response = await window.gapi.client.drive.files.list({
        q: q,
        fields: 'files(id)',
      });
      
      const files = response.result.files;
      if (files && files.length > 0) {
        // Found it, now download content
        return await loadJsonFile(files[0].id);
      }
      return null; // File doesn't exist yet
    } catch (err) {
      console.warn(`Could not load ${filename}`, err);
      return null;
    }
  };

  // Run all searches in parallel
  const [rates, employees, config] = await Promise.all([
    loadConfigByName('master_rates.json'),
    loadConfigByName('personnel.json'),
    loadConfigByName('app_config.json')
  ]);

  return { rates, employees, config };
}

// UPDATED: Lists all JSON files in the entire System folder (Current + Past years)
export async function listAllPayrollRuns(rootId: string): Promise<DriveFile[]> {
  try {
    // 1. Get all subfolders (Years) inside Root
    const folderQuery = `'${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const folderRes = await window.gapi.client.drive.files.list({
      q: folderQuery,
      fields: 'files(id, name)',
    });
    
    const folders = folderRes.result.files || [];
    // Always include the root just in case files are saved there directly
    const folderIds = [rootId, ...folders.map((f: any) => f.id)];

    // 2. Fetch files from ALL identified folders
    let allFiles: DriveFile[] = [];
    
    for (const fid of folderIds) {
      const fileQuery = `'${fid}' in parents and mimeType = 'application/json' and name contains 'Payroll_Run' and trashed = false`;
      const fileRes = await window.gapi.client.drive.files.list({
        q: fileQuery,
        fields: 'files(id, name, createdTime, parents)',
        orderBy: 'createdTime desc',
      });
      if (fileRes.result.files) {
        allFiles = [...allFiles, ...fileRes.result.files];
      }
    }
    
    // Sort combined list by date desc
    return allFiles.sort((a, b) => 
      (new Date(b.createdTime || 0).getTime()) - (new Date(a.createdTime || 0).getTime())
    );

  } catch (err) {
    console.error("Error listing all runs:", err);
    return [];
  }
}

// Helper: Basic Find
async function findFile(name: string, mimeType: string, parentId?: string): Promise<string | null> {
  let query = `name = '${name}' and mimeType = '${mimeType}' and trashed = false`;
  if (parentId) query += ` and '${parentId}' in parents`;
  
  if (!window.gapi.client) throw new Error("GAPI not initialized");

  const response = await window.gapi.client.drive.files.list({
    q: query,
    fields: 'files(id)',
  });
  
  const files = response.result.files;
  return (files && files.length > 0) ? files[0].id : null;
}

// Helper: Basic Create
async function createFolder(name: string, parentId?: string): Promise<string> {
  const metadata: any = { name, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) metadata.parents = [parentId];
  
  const response = await window.gapi.client.drive.files.create({
    resource: metadata,
    fields: 'id',
  });
  return response.result.id;
}

// Helper: Save
export async function saveJsonFile(filename: string, content: any, parentId: string) {
  const fileContent = JSON.stringify(content, null, 2);
  const file = new Blob([fileContent], { type: 'application/json' });
  const metadata = { name: filename, mimeType: 'application/json', parents: [parentId] };

  const tokenObj = window.gapi.client.getToken();
  const accessToken = tokenObj ? tokenObj.access_token : null;
  if (!accessToken) throw new Error("No access token.");

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
    body: form,
  });
}

// Helper: Load
export async function loadJsonFile(fileId: string) {
  const response = await window.gapi.client.drive.files.get({
    fileId: fileId,
    alt: 'media',
  });
  return response.result;
}

export interface DriveFile {
  id: string;
  name: string;
  createdTime?: string;
  parents?: string[];
}
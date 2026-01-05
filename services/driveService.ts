/* global gapi, google */

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

export interface DriveConfig {
  clientId: string;
  apiKey: string;
}

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

// --- INITIALIZATION ---

export async function initGoogleApi(config: DriveConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    window.gapi.load('client', async () => {
      try {
        await window.gapi.client.init({
          apiKey: config.apiKey,
          discoveryDocs: [DISCOVERY_DOC],
        });
        gapiInited = true;
        if (gisInited) resolve();
      } catch (e) {
        reject(e);
      }
    });

    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: config.clientId,
      scope: SCOPES,
      callback: '', 
    });
    gisInited = true;
    if (gapiInited) resolve();
  });
}

export async function signIn(): Promise<void> {
  return new Promise((resolve, reject) => {
    tokenClient.callback = async (resp: any) => {
      if (resp.error !== undefined) {
        reject(resp);
      }
      resolve();
    };
    tokenClient.requestAccessToken({ prompt: 'select_account' });
  });
}

// --- FILE SYSTEM LOGIC ---

// Helper: Find a file or folder by name in a specific parent
// MODIFIED: Made mimeType optional and permissive to fix "file not found" issues
async function findItem(name: string, parentId: string = 'root', mimeType?: string) {
  let query = `name = '${name}' and '${parentId}' in parents and trashed = false`;
  if (mimeType) {
    query += ` and mimeType = '${mimeType}'`;
  }
  
  const response = await window.gapi.client.drive.files.list({
    q: query,
    fields: 'files(id, name, mimeType)',
  });
  
  return response.result.files?.[0] || null;
}

// Helper: Create a folder
async function createFolder(name: string, parentId: string = 'root') {
  const metadata = {
    name: name,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentId],
  };
  
  const response = await window.gapi.client.drive.files.create({
    resource: metadata,
    fields: 'id',
  });
  return response.result;
}

// Ensure the folder structure exists: Gem_Payroll_System > 00_Config
export async function ensureSystemFolders() {
  // 1. Root Folder
  let root = await findItem('Gem_Payroll_System', 'root', 'application/vnd.google-apps.folder');
  if (!root) root = await createFolder('Gem_Payroll_System');

  // 2. Config Folder
  let config = await findItem('00_Config', root.id, 'application/vnd.google-apps.folder');
  if (!config) config = await createFolder('00_Config', root.id);

  // 3. Current Year Folder (for output)
  const currentYear = new Date().getFullYear().toString();
  let yearFolder = await findItem(currentYear, root.id, 'application/vnd.google-apps.folder');
  if (!yearFolder) yearFolder = await createFolder(currentYear, root.id);

  return { rootId: root.id, configId: config.id, yearFolderId: yearFolder.id };
}

// Load specific JSON file content
// MODIFIED: Removed strict 'application/json' check in findItem to handle text/plain uploads
export async function loadJsonFile(filename: string, parentId: string) {
  const file = await findItem(filename, parentId); // Look for ANY file with this name
  if (!file) return null;

  const response = await window.gapi.client.drive.files.get({
    fileId: file.id,
    alt: 'media',
  });
  return response.result;
}

// Save specific JSON file (Create or Update)
export async function saveJsonFile(filename: string, content: object, parentId: string) {
  const existing = await findItem(filename, parentId);
  
  const fileContent = JSON.stringify(content, null, 2);
  const blob = new Blob([fileContent], { type: 'application/json' });
  const accessToken = window.gapi.client.getToken().access_token;
  
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify({
    name: filename,
    mimeType: 'application/json',
    parents: existing ? [] : [parentId] // Only set parent on create
  })], { type: 'application/json' }));
  form.append('file', blob);

  const method = existing ? 'PATCH' : 'POST';
  const urlId = existing ? `/${existing.id}` : '';
  const url = `https://www.googleapis.com/upload/drive/v3/files${urlId}?uploadType=multipart`;

  await fetch(url, {
    method: method,
    headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
    body: form
  });
}
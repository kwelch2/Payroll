// services/driveService.ts

const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = "https://www.googleapis.com/auth/drive.file";

let tokenClient: any;
// REMOVED: let gapiInited = false;
// REMOVED: let gisInited = false;

// Initialize GAPI (Client)
export function initGapi() {
  return new Promise<void>((resolve, reject) => {
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

// Initialize GIS (Auth)
export function initGis(onTokenCallback: (response: any) => void) {
  return new Promise<void>((resolve) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (tokenResponse: any) => {
        onTokenCallback(tokenResponse);
      },
    });
    resolve();
  });
}

export function requestAccessToken() {
  if (!tokenClient) throw new Error("GIS not initialized");
  tokenClient.requestAccessToken({ prompt: '' });
}

// --- FOLDER LOGIC ---

export async function ensureSystemFolders() {
  const rootName = "Gem_Payroll_System";
  
  let rootId = await findFile(rootName, 'application/vnd.google-apps.folder');
  if (!rootId) {
    rootId = await createFolder(rootName);
  }

  let configId = await findFile("00_Config", 'application/vnd.google-apps.folder', rootId);
  if (!configId) {
    configId = await createFolder("00_Config", rootId);
  }

  const year = new Date().getFullYear();
  const yearFolderName = `${year}_Payroll`;
  let yearFolderId = await findFile(yearFolderName, 'application/vnd.google-apps.folder', rootId);
  if (!yearFolderId) {
    yearFolderId = await createFolder(yearFolderName, rootId);
  }

  return { rootId, configId, yearFolderId };
}

async function findFile(name: string, mimeType: string, parentId?: string): Promise<string | null> {
  let query = `name = '${name}' and mimeType = '${mimeType}' and trashed = false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }
  
  const response = await window.gapi.client.drive.files.list({
    q: query,
    fields: 'files(id, name)',
  });
  
  const files = response.result.files;
  if (files && files.length > 0) {
    return files[0].id;
  }
  return null;
}

async function createFolder(name: string, parentId?: string): Promise<string> {
  const fileMetadata: any = {
    name: name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    fileMetadata.parents = [parentId];
  }
  
  const response = await window.gapi.client.drive.files.create({
    resource: fileMetadata,
    fields: 'id',
  });
  return response.result.id;
}

// --- FILE OPERATIONS ---

export async function saveJsonFile(filename: string, content: any, parentId: string) {
  const fileContent = JSON.stringify(content, null, 2);
  const file = new Blob([fileContent], { type: 'application/json' });
  const metadata = {
    name: filename,
    mimeType: 'application/json',
    parents: [parentId],
  };

  const accessToken = window.gapi.client.getToken().access_token;
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
    body: form,
  });
}

export async function loadJsonFile(filenameOrId: string, parentId?: string) {
  let fileId = filenameOrId;
  
  if (filenameOrId.endsWith('.json')) {
    const foundId = await findFile(filenameOrId, 'application/json', parentId);
    if (!foundId) return null;
    fileId = foundId;
  }

  const response = await window.gapi.client.drive.files.get({
    fileId: fileId,
    alt: 'media',
  });
  return response.result;
}

// --- SAVED FILES LIST ---
export interface DriveFile {
  id: string;
  name: string;
  createdTime?: string;
}

export async function listSavedFiles(folderId: string): Promise<DriveFile[]> {
  const query = `'${folderId}' in parents and mimeType = 'application/json' and trashed = false`;
  
  try {
    const response = await window.gapi.client.drive.files.list({
      q: query,
      fields: 'files(id, name, createdTime)',
      orderBy: 'createdTime desc',
      pageSize: 20
    });
    return response.result.files || [];
  } catch (err) {
    console.error("Error listing files:", err);
    return [];
  }
}

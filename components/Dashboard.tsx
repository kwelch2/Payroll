import React, { useState, useEffect } from 'react';
import { Cloud, Save, Download, Settings, Loader2, CheckCircle, AlertTriangle, Key, FolderOpen, Database } from 'lucide-react';
import { initGoogleApi, signIn, ensureSystemFolders, loadJsonFile, saveJsonFile } from '../services/driveService';
import { MasterRates, Employee, AppConfig } from '../types';
import { GOOGLE_CLIENT_ID, GOOGLE_API_KEY } from '../constants';

interface DashboardProps {
  rates: MasterRates;
  setRates: (r: MasterRates) => void;
  employees: Employee[];
  setEmployees: (e: Employee[]) => void;
  config: AppConfig;
  setConfig: (c: AppConfig) => void;
}

export default function Dashboard({ rates, setRates, employees, setEmployees, config, setConfig }: DashboardProps) {
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [apiKey, setApiKey] = useState(GOOGLE_API_KEY);
  const [clientId, setClientId] = useState(GOOGLE_CLIENT_ID);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [folderIds, setFolderIds] = useState<{rootId: string, configId: string, yearFolderId: string} | null>(null);

  // Load from local storage
  useEffect(() => {
    const storedKey = localStorage.getItem('gc_google_api_key');
    const storedClient = localStorage.getItem('gc_google_client_id');
    if (storedKey) setApiKey(storedKey);
    if (storedClient) setClientId(storedClient);
  }, []);

  const handleSaveKeys = () => {
    localStorage.setItem('gc_google_api_key', apiKey);
    localStorage.setItem('gc_google_client_id', clientId);
    setIsConfiguring(false);
    alert("Credentials saved.");
  };

  const handleConnect = async () => {
    if (!apiKey || !clientId) {
      alert("Please check API Key and Client ID settings.");
      setIsConfiguring(true);
      return;
    }
    try {
      setIsLoading(true);
      setStatusMsg("Initializing...");
      await initGoogleApi({ apiKey, clientId });
      await signIn();
      setIsAuthorized(true);
      
      setStatusMsg("Scanning Drive Folders...");
      const folders = await ensureSystemFolders();
      setFolderIds(folders);
      
      setStatusMsg("Connected to Drive Folder: Gem_Payroll_System");
    } catch (err: any) {
      console.error(err);
      if (err.error === 'redirect_uri_mismatch') {
        setStatusMsg("Error: Redirect URI Mismatch");
        alert("REDIRECT URI MISMATCH:\n\nYou must add this domain (e.g., http://localhost:5173) to the 'Authorized JavaScript Origins' in your Google Cloud Console for this Client ID.");
      } else {
        setStatusMsg("Connection Failed.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSystem = async () => {
    if (!folderIds) return;
    try {
      setIsLoading(true);
      let loadedCount = 0;
      let logs = [];

      // Load Master Rates
      setStatusMsg("Loading master_rates.json...");
      const loadedRates = await loadJsonFile('master_rates.json', folderIds.configId);
      if (loadedRates) {
        setRates(loadedRates);
        logs.push("Loaded Rates");
        loadedCount++;
      } else {
        logs.push("Missing Rates file");
      }

      // Load Personnel DB
      setStatusMsg("Loading personnel_master_db.json...");
      const loadedEmps = await loadJsonFile('personnel_master_db.json', folderIds.configId);
      if (loadedEmps) {
        setEmployees(loadedEmps);
        logs.push("Loaded Personnel");
        loadedCount++;
      } else {
        logs.push("Missing Personnel file");
      }
      
      setStatusMsg(`Done. ${logs.join('. ')}`);
    } catch (err) {
      console.error(err);
      setStatusMsg("Error loading files from Drive.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSystem = async () => {
    if (!folderIds) return;
    try {
      setIsLoading(true);
      setStatusMsg("Saving Master DBs...");
      
      await saveJsonFile('master_rates.json', rates, folderIds.configId);
      await saveJsonFile('personnel_master_db.json', employees, folderIds.configId);
      
      setStatusMsg("Saved to '00_Config' successfully.");
    } catch (err) {
      console.error(err);
      setStatusMsg("Error saving files.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full text-center space-y-6">
      
      {/* Config Modal */}
      {isConfiguring && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-lg text-left">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Key size={20} /> Connection Settings
            </h3>
            <div className="space-y-4">
              <div>
                <label className="label">Client ID</label>
                <input className="input-field bg-gray-100" value={clientId} onChange={e => setClientId(e.target.value)} />
                <p className="text-xs text-red-500 mt-1">Must have correct JS Origin authorized.</p>
              </div>
              <div>
                <label className="label">API Key</label>
                <input className="input-field" value={apiKey} onChange={e => setApiKey(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setIsConfiguring(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleSaveKeys} className="btn-primary">Save & Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Panel */}
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-2xl w-full border border-gray-100 relative">
        <button 
          onClick={() => setIsConfiguring(true)}
          className="absolute top-4 right-4 text-gray-400 hover:text-blue-600 transition-colors"
        >
          <Settings size={20} />
        </button>

        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-4 shadow-sm">
          <Database size={32} />
        </div>
        
        <h2 className="text-3xl font-bold text-gray-900 mb-2">System Processing Engine</h2>
        <p className="text-gray-500 mb-8 max-w-md mx-auto">
          Connects to <strong>Gem_Payroll_System</strong> on Google Drive.<br/>
          Loads configuration from <code>00_Config</code>.
        </p>
        
        {/* Status */}
        <div className="mb-8 h-8 flex items-center justify-center">
          {isLoading ? (
            <span className="flex items-center gap-2 text-blue-600 font-medium animate-pulse">
              <Loader2 className="animate-spin" size={18} /> {statusMsg}
            </span>
          ) : (
            <span className={`flex items-center gap-2 font-medium ${statusMsg.toLowerCase().includes('error') || statusMsg.toLowerCase().includes('missing') ? 'text-red-600' : 'text-green-600'}`}>
               {statusMsg && (statusMsg.toLowerCase().includes('error') ? <AlertTriangle size={18} /> : <CheckCircle size={18} />)}
               {statusMsg || "Ready to connect"}
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="space-y-4">
          {!isAuthorized ? (
             <button 
              onClick={handleConnect}
              className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold text-lg hover:bg-black transition-all shadow-lg flex items-center justify-center gap-3"
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5 bg-white rounded-full border border-white" />
              Connect Processing Engine
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={handleLoadSystem}
                className="py-4 bg-white border-2 border-blue-100 text-blue-700 rounded-xl font-bold hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
              >
                <FolderOpen size={20} />
                Load Master DBs
              </button>
              <button 
                onClick={handleSaveSystem}
                className="py-4 bg-blue-50 border-2 border-blue-100 text-blue-700 rounded-xl font-bold hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
              >
                <Save size={20} />
                Update Master DBs
              </button>
            </div>
          )}
        </div>
        
        {folderIds && (
          <div className="mt-6 p-3 bg-gray-50 rounded text-xs text-gray-400 text-left font-mono">
            <div>ROOT: {folderIds.rootId}</div>
            <div>CNFG: {folderIds.configId}</div>
            <div>YEAR: {folderIds.yearFolderId}</div>
          </div>
        )}
      </div>
    </div>
  );
}
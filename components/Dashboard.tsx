import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Database, FolderOpen, FileText, Loader, RotateCcw 
} from 'lucide-react';
import { 
  initGapi, initGis, requestAccessToken, 
  ensureSystemFolders, loadJsonFile, listSavedFiles, DriveFile 
} from '../services/driveService';
import Editor from './Editor';
import RateMatrix from './RateMatrix';
import ConfigPanel from './ConfigPanel';
import { Employee, MasterRates, PayrollRow } from '../types';

export default function Dashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'rates' | 'config'>('editor');
  
  // Data State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rates, setRates] = useState<MasterRates | null>(null);
  const [payrollData, setPayrollData] = useState<PayrollRow[]>([]);
  
  // System State
  const [statusMsg, setStatusMsg] = useState("Initializing...");
  const [folderIds, setFolderIds] = useState<{ rootId: string, configId: string, yearFolderId: string } | null>(null);
  
  // Saved Files State
  const [savedFiles, setSavedFiles] = useState<DriveFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  // 1. INITIALIZATION & AUTO-LOGIN
  useEffect(() => {
    const startDrive = async () => {
      try {
        await initGapi();
        await initGis((token) => {
          if (token && token.access_token) {
            setIsAuthenticated(true);
            setStatusMsg("Connected to Drive.");
          }
        });
      } catch (err) {
        console.error(err);
        setStatusMsg("Error connecting to Google Drive.");
      }
    };
    startDrive();
  }, []);

  // 2. AUTO-LOAD SYSTEM WHEN AUTHENTICATED
  useEffect(() => {
    if (isAuthenticated) {
      handleLoadSystem();
    }
  }, [isAuthenticated]);

  const handleAuth = () => {
    requestAccessToken();
  };

  // 3. LOAD RATES, PERSONNEL & FIND SAVED FILES
  const handleLoadSystem = async () => {
    try {
      setStatusMsg("Locating System Folders...");
      const ids = await ensureSystemFolders();
      setFolderIds(ids);

      const logs: string[] = [];
      let loadedCount = 0;

      // Load Rates
      setStatusMsg("Loading master_rates.json...");
      const loadedRates = await loadJsonFile('master_rates.json', ids.configId);
      if (loadedRates) {
        setRates(loadedRates);
        logs.push("Loaded Rates");
        loadedCount++;
      } else {
        logs.push("Missing Rates file");
      }

      // Load Personnel
      setStatusMsg("Loading personnel_master_db.json...");
      const loadedEmps = await loadJsonFile('personnel_master_db.json', ids.configId);
      if (loadedEmps) {
        // Fix: Ensure we grab the array, not the whole object
        setEmployees(loadedEmps.employees || []); 
        logs.push("Loaded Personnel");
        loadedCount++;
      } else {
        logs.push("Missing Personnel file");
      }

      // Refresh Saved Files List
      refreshSavedFiles(ids.yearFolderId);

      setStatusMsg(loadedCount === 2 ? "System Ready." : `System Partial: ${logs.join(', ')}`);
    } catch (err) {
      console.error(err);
      setStatusMsg("Error loading system files.");
    }
  };

  const refreshSavedFiles = async (yearId: string) => {
    setIsLoadingFiles(true);
    const files = await listSavedFiles(yearId);
    setSavedFiles(files);
    setIsLoadingFiles(false);
  };

  // 4. LOAD A SPECIFIC PREVIOUS SAVE
  const handleLoadSave = async (file: DriveFile) => {
    if (!confirm(`Overwrite current work and load "${file.name}"?`)) return;
    
    try {
      setStatusMsg(`Loading ${file.name}...`);
      const fileContent = await loadJsonFile(file.id); // Load by ID
      if (fileContent && fileContent.rows) {
        setPayrollData(fileContent.rows);
        setStatusMsg(`Loaded ${fileContent.rows.length} rows from ${file.name}`);
      } else {
        alert("Invalid file format.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to load file.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="bg-blue-600 text-white p-2 rounded-lg shadow-sm">
               <ShieldCheck size={24} />
             </div>
             <div>
               <h1 className="text-xl font-bold text-gray-900 tracking-tight">Gem Payroll</h1>
               <div className="flex items-center gap-2">
                 <div className={`w-2 h-2 rounded-full ${isAuthenticated ? 'bg-green-500' : 'bg-red-500'}`}></div>
                 <span className="text-xs text-gray-500 font-medium">{statusMsg}</span>
               </div>
             </div>
          </div>

          <div className="flex items-center gap-2">
             {!isAuthenticated && (
               <button onClick={handleAuth} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm text-sm">
                 Connect Drive
               </button>
             )}
             
             {/* Saved Runs Dropdown */}
             {isAuthenticated && folderIds && (
               <div className="relative group">
                 <button className="flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                   <FolderOpen size={16} /> 
                   {isLoadingFiles ? "Syncing..." : "Load Saved Run"}
                 </button>
                 
                 {/* Dropdown Menu */}
                 <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-2 hidden group-hover:block animate-in fade-in slide-in-from-top-2">
                   <h3 className="text-xs font-bold text-gray-400 uppercase px-2 py-1 mb-1">Recent Saves</h3>
                   {savedFiles.length === 0 ? (
                     <div className="text-xs text-gray-400 px-2 py-2 italic">No files found in {new Date().getFullYear()} folder.</div>
                   ) : (
                     <div className="max-h-60 overflow-y-auto space-y-1">
                       {savedFiles.map(file => (
                         <button 
                           key={file.id}
                           onClick={() => handleLoadSave(file)}
                           className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors truncate flex items-center gap-2"
                           title={file.name}
                         >
                           <FileText size={14} className="shrink-0" />
                           <span className="truncate">{file.name}</span>
                         </button>
                       ))}
                     </div>
                   )}
                   <div className="border-t border-gray-100 mt-2 pt-2 text-center">
                     <button 
                       onClick={() => refreshSavedFiles(folderIds.yearFolderId)} 
                       className="text-xs text-blue-600 hover:underline flex items-center justify-center gap-1 w-full"
                     >
                       <RotateCcw size={10} /> Refresh List
                     </button>
                   </div>
                 </div>
               </div>
             )}
          </div>
        </div>

        {/* NAVIGATION */}
        {isAuthenticated && rates && (
          <div className="max-w-7xl mx-auto px-4 flex gap-6 mt-1">
             <button onClick={() => setActiveTab('editor')} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'editor' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
               Payroll Editor
             </button>
             <button onClick={() => setActiveTab('rates')} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'rates' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
               Rate Matrix
             </button>
             <button onClick={() => setActiveTab('config')} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'config' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
               Configuration
             </button>
          </div>
        )}
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full">
        {!isAuthenticated ? (
          <div className="flex flex-col items-center justify-center h-96 text-center">
             <div className="bg-blue-100 p-4 rounded-full text-blue-600 mb-4">
               <Database size={48} />
             </div>
             <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Gem Payroll</h2>
             <p className="text-gray-500 max-w-md">Please connect to Google Drive to access your secure personnel database and rate matrix.</p>
          </div>
        ) : !rates ? (
          <div className="flex flex-col items-center justify-center h-64">
             <Loader className="animate-spin text-blue-600 mb-4" size={32} />
             <p className="text-gray-500">Loading System Configuration...</p>
          </div>
        ) : (
          <>
            {activeTab === 'editor' && (
              <Editor 
                data={payrollData} 
                setData={setPayrollData} 
                employees={employees} 
                rates={rates} 
              />
            )}
            {activeTab === 'rates' && <RateMatrix rates={rates} />}
            {activeTab === 'config' && <ConfigPanel />}
          </>
        )}
      </main>
    </div>
  );
}

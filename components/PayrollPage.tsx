import { useState } from 'react';
import { FolderOpen, FilePlus } from 'lucide-react';
import Editor from './Editor';
import { PayrollRow, Employee, MasterRates } from '../types';
import { listAllPayrollRuns, loadJsonFile, DriveFile, SystemIds } from '../services/driveService';

interface PayrollPageProps {
  data: PayrollRow[];
  setData: (data: PayrollRow[]) => void;
  employees: Employee[];
  rates: MasterRates;
  systemIds: SystemIds | null;
}

export default function PayrollPage({ data, setData, employees, rates, systemIds }: PayrollPageProps) {
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [fileList, setFileList] = useState<DriveFile[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");

  const handleListFiles = async () => {
    if (!systemIds) {
      alert("System not fully initialized. Please wait or refresh.");
      return;
    }
    setShowLoadModal(true);
    setIsLoadingList(true);
    const files = await listAllPayrollRuns(systemIds.rootId);
    setFileList(files);
    setIsLoadingList(false);
  };

  const handleLoadFile = async (file: DriveFile) => {
    if(!confirm(`Load "${file.name}"? Unsaved changes will be lost.`)) return;
    
    setLoadingMsg("Downloading...");
    try {
      const content = await loadJsonFile(file.id);
      if (content && content.rows) {
        setData(content.rows);
        setShowLoadModal(false);
      } else {
        alert("File appears to be empty or invalid format.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to load file.");
    } finally {
      setLoadingMsg("");
    }
  };

  const handleNewRun = () => {
    if(data.length > 0 && !confirm("Start a new run? Current rows will be cleared.")) return;
    setData([]);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Top Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
         <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-800 px-2">Payroll Worksheet</h2>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full border border-gray-200">
               {data.length} Rows
            </span>
         </div>
         
         <div className="flex items-center gap-2">
            <button 
              onClick={handleNewRun}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <FilePlus size={16} /> New Run
            </button>
            <div className="h-6 w-px bg-gray-200"></div>
            <button 
              onClick={handleListFiles}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <FolderOpen size={16} /> Load Run
            </button>
         </div>
      </div>

      {/* Editor Area */}
      {loadingMsg ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 animate-pulse">
           {loadingMsg}
        </div>
      ) : (
        <Editor 
          data={data} 
          setData={setData} 
          employees={employees} 
          rates={rates} 
        />
      )}

      {/* Load File Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
             <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
               <h3 className="font-bold text-gray-800">Select Saved Run</h3>
               <button onClick={() => setShowLoadModal(false)} className="text-gray-400 hover:text-gray-600">Close</button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-2">
                {isLoadingList ? (
                  <div className="p-8 text-center text-gray-400">Scanning System Folders...</div>
                ) : fileList.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">No saved files found in Gem_Payroll_System.</div>
                ) : (
                  <div className="space-y-1">
                    {fileList.map(f => (
                      <button 
                        key={f.id}
                        onClick={() => handleLoadFile(f)}
                        className="w-full text-left p-3 hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-100 group transition-all"
                      >
                        <div className="font-medium text-gray-800 group-hover:text-blue-700">{f.name}</div>
                        <div className="text-xs text-gray-400 flex justify-between mt-1">
                          <span>{new Date(f.createdTime || '').toLocaleString()}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
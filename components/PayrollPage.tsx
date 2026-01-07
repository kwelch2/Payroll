import React, { useState, useRef } from 'react';
import { FolderOpen, FilePlus } from 'lucide-react';
import Editor from './Editor';
import { PayrollRow, Employee, MasterRates } from '../types';
import { listAllPayrollRuns, loadJsonFile, DriveFile, SystemIds } from '../services/driveService';
import { calculatePayRow } from '../services/payrollService';

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
  
  // Ref for the hidden file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- ACTIONS ---

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
    if(data.length > 0 && !confirm(`Load "${file.name}"? Unsaved changes will be lost.`)) return;
    
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

  // Combined Action: Clear Data -> Open CSV Import
  const handleNewRun = () => {
    if(data.length > 0 && !confirm("Start a new run? Current rows will be cleared.")) return;
    
    setData([]);
    
    // Automatically trigger the file picker
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset input so same file can be selected again
      fileInputRef.current.click();
    }
  };

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n');
      const newRows: PayrollRow[] = [];
      let headerIndex = -1;
      
      // Find header
      for (let i = 0; i < Math.min(lines.length, 20); i++) {
        if (lines[i].includes("Last Name") && lines[i].includes("Start Date")) {
          headerIndex = i;
          break;
        }
      }

      if (headerIndex === -1) {
        alert("Could not find valid header row. Ensure CSV has 'Last Name', 'Start Date', etc.");
        return;
      }

      for (let i = headerIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); // Robust split
        const cleanCols = cols.map(c => c.replace(/^"|"$/g, '').trim());
        if (cleanCols.length < 10) continue;

        // Map Columns (Adjust indices if your CSV changes)
        const lastName = cleanCols[0];
        const firstName = cleanCols[1];
        const startDate = cleanCols[5];
        const startTime = cleanCols[6];
        const endDate = cleanCols[7];
        const endTime = cleanCols[8];
        const payCode = cleanCols[9];
        const hours = parseFloat(cleanCols[10]);

        if (payCode && !isNaN(hours)) {
           const fullName = `${lastName}, ${firstName}`;
           const row = calculatePayRow(fullName, payCode, hours, employees, rates);
           row.startDate = startDate;
           row.startTime = startTime;
           row.endDate = endDate;
           row.endTime = endTime;
           newRows.push(row);
        }
      }
      
      if (newRows.length > 0) {
        setData(newRows);
      }
    };
    reader.readAsText(file);
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
            {/* Hidden Input for CSV Import */}
            <input 
              type="file" 
              accept=".csv" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleCSVImport} 
            />

            <button 
              onClick={handleNewRun}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Clear table and import CSV"
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
          systemIds={systemIds} 
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
                        <div className="text-xs text-gray-400 mt-1">
                          {f.createdTime ? new Date(f.createdTime).toLocaleString() : 'Unknown Date'}
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
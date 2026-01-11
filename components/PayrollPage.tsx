import React, { useState, useRef } from 'react';
import { FolderOpen, FilePlus, ChevronRight, Folder, FileText, ArrowLeft } from 'lucide-react';
import Editor from './Editor';
import { PayrollRow, Employee, MasterRates } from '../types';
import { 
  loadJsonFile, DriveFile, SystemIds, 
  listYearFolders, listPayrollFiles 
} from '../services/driveService';
import { calculatePayRow } from '../services/payrollService';
import { useFeedback } from './FeedbackProvider';
import { getErrorMessage } from '../services/errorUtils';

interface PayrollPageProps {
  data: PayrollRow[];
  setData: (data: PayrollRow[]) => void;
  employees: Employee[];
  rates: MasterRates;
  systemIds: SystemIds | null;
}

export default function PayrollPage({ data, setData, employees, rates, systemIds }: PayrollPageProps) {
  const [showLoadModal, setShowLoadModal] = useState(false);
  
  // Browsing State
  const [viewMode,QH] = useState<'years' | 'files'>('years');
  const [yearFolder, setYearFolder] = useState<DriveFile | null>(null);
  const [browserList, setBrowserList] = useState<DriveFile[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  
  const [loadingMsg, setLoadingMsg] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { notify, confirm } = useFeedback();

  // --- BROWSING ACTIONS ---

  const openBrowser = async () => {
    if (!systemIds) {
      notify('error', 'System not fully initialized. Please wait or refresh.');
      return;
    }
    setShowLoadModal(true);
    loadYears();
  };

  const loadYears = async () => {
    QH('years');
    setYearFolder(null);
    setIsLoadingList(true);
    try {
      const years = await listYearFolders();
      setBrowserList(years);
    } catch (err) {
      console.error(err);
      notify('error', 'Failed to load year folders.');
    } finally {
      setIsLoadingList(false);
    }
  };

  const loadFilesForYear = async (folder: DriveFile) => {
    QH('files');
    setYearFolder(folder);
    setIsLoadingList(true);
    try {
      const files = await listPayrollFiles(folder.id);
      setBrowserList(files);
    } catch (err) {
      console.error(err);
      notify('error', `Failed to load files for ${folder.name}.`);
    } finally {
      setIsLoadingList(false);
    }
  };

  const handleLoadFile = async (file: DriveFile) => {
    if (data.length > 0) {
      const approved = await confirm({
        title: 'Load Saved Run',
        message: `Load "${file.name}"? Unsaved changes will be lost.`,
        confirmLabel: 'Load',
        cancelLabel: 'Cancel'
      });
      if (!approved) return;
    }
    
    setLoadingMsg("Downloading...");
    try {
      const content = await loadJsonFile(file.id);
      if (content && content.rows) {
        setData(content.rows);
        setShowLoadModal(false);
      } else {
        notify('error', 'File appears to be empty or invalid format.');
      }
    } catch (err) {
      console.error(err);
      notify('error', getErrorMessage(err, 'Failed to load file.'));
    } finally {
      setLoadingMsg("");
    }
  };

  const handleNewRun = async () => {
    if (data.length > 0) {
      const approved = await confirm({
        title: 'Start New Run',
        message: 'Start a new run? Current rows will be cleared.',
        confirmLabel: 'Start',
        cancelLabel: 'Cancel'
      });
      if (!approved) return;
    }
    setData([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; 
      fileInputRef.current.click();
    }
  };

  // --- SMART CSV IMPORT ---
  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim().length > 0);
      const newRows: PayrollRow[] = [];
      
      // 1. Detect Header Row
      let headerIndex = -1;
      let headerRow: string[] = [];

      for (let i = 0; i < Math.min(lines.length, 20); i++) {
        const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
        // Look for key columns to identify header
        if (
            (row.includes("Last Name") && row.includes("Pay Code")) || 
            (row.includes("Employee") && row.includes("Code"))
        ) {
          headerIndex = i;
          headerRow = row;
          break;
        }
      }

      if (headerIndex === -1) {
        notify('error', "Could not detect CSV Headers. File must contain 'Last Name' (or 'Employee') and 'Pay Code'.");
        return;
      }

      // 2. Map Columns Dynamically
      const findCol = (patterns: string[]) => headerRow.findIndex(h => patterns.some(p => h.toLowerCase().includes(p.toLowerCase())));

      const idxLast = findCol(["Last Name", "LastName", "Employee Name"]);
      const idxFirst = findCol(["First Name", "FirstName"]); // Might be -1 if Name is combined
      const idxCode = findCol(["Pay Code", "PayCode", "Code"]);
      const idxHours = findCol(["Hours", "Qty", "Quantity", "Hrs"]);
      
      // Date/Time Mapping
      const idxStartDate = findCol(["Start Date", "Date"]);
      const idxStartTime = findCol(["Start Time", "Time"]);
      const idxEndDate = findCol(["End Date"]);
      const idxEndTime = findCol(["End Time"]);

      // 3. Process Rows
      for (let i = headerIndex + 1; i < lines.length; i++) {
        const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
        
        // Basic Validation
        if (cols.length < 5) continue; 

        // Name Logic
        let lastName = idxLast > -1 ? cols[idxLast] : "Unknown";
        let firstName = idxFirst > -1 ? cols[idxFirst] : "";
        
        // Handle "Last, First" in single column if needed
        if (idxFirst === -1 && lastName.includes(',')) {
            const parts = lastName.split(',');
            lastName = parts[0].trim();
            firstName = parts[1].trim();
        }

        const payCode = idxCode > -1 ? cols[idxCode] : "";
        const hoursStr = idxHours > -1 ? cols[idxHours] : "0";
        const hours = parseFloat(hoursStr);

        // Date Extraction
        const startDate = idxStartDate > -1 ? cols[idxStartDate] : "";
        const startTime = idxStartTime > -1 ? cols[idxStartTime] : "";
        const endDate = idxEndDate > -1 ? cols[idxEndDate] : "";
        const endTime = idxEndTime > -1 ? cols[idxEndTime] : "";

        if (payCode && (!isNaN(hours) || payCode)) {
           const fullName = `${lastName}, ${firstName}`;
           
           // Calculate Rates
           const row = calculatePayRow(fullName, payCode, hours || 0, employees, rates);
           
           // Attach Dates explicitly
           row.startDate = startDate;
           row.startTime = startTime;
           row.endDate = endDate;
           row.endTime = endTime;
           
           newRows.push(row);
        }
      }
      
      if (newRows.length > 0) {
        setData(newRows);
        notify('success', `Successfully imported ${newRows.length} rows.`);
      } else {
        notify('error', 'No valid rows found. Please check your CSV format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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
              title="Start fresh with a CSV import"
            >
              <FilePlus size={16} /> New Run
            </button>
            
            <div className="h-6 w-px bg-gray-200"></div>
            
            <button 
              onClick={openBrowser}
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

      {/* Load File Modal (Browser) */}
      {showLoadModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col h-[500px]">
             
             {/* Header */}
             <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
               <div className="flex items-center gap-2">
                 {viewMode === 'files' && (
                   <button onClick={loadYears} className="p-1 rounded hover:bg-gray-200 text-gray-600">
                     <ArrowLeft size={18} />
                   </button>
                 )}
                 <div>
                   <h3 className="font-bold text-gray-800">
                     {viewMode === 'years' ? 'Select Year' : `${yearFolder?.name} Files`}
                   </h3>
                   <p className="text-xs text-gray-500">
                     {viewMode === 'years' ? 'Browse Gem_Payroll_System/Files' : 'Select a payroll run to load'}
                   </p>
                 </div>
               </div>
               <button onClick={() => setShowLoadModal(false)} className="text-gray-400 hover:text-gray-600">Close</button>
             </div>
             
             {/* List Area */}
             <div className="flex-1 overflow-y-auto p-2 bg-gray-50/50">
                {isLoadingList ? (
                  <div className="p-8 text-center text-gray-400">Loading...</div>
                ) : browserList.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-2">
                    <FolderOpen size={32} className="opacity-20" />
                    <span>Empty Folder</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {browserList.map(item => (
                      <button 
                        key={item.id}
                        onClick={() => viewMode === 'years' ? loadFilesForYear(item) : handleLoadFile(item)}
                        className="w-full text-left p-3 hover:bg-white bg-white/50 rounded-lg border border-transparent hover:border-gray-200 hover:shadow-sm group transition-all flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-gray-100 rounded text-gray-500 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                              {viewMode === 'years' ? <Folder size={20} /> : <FileText size={20} />}
                           </div>
                           <div>
                              <div className="font-bold text-gray-800">{item.name}</div>
                              {item.createdTime && <div className="text-[10px] text-gray-400">{new Date(item.createdTime).toLocaleDateString()}</div>}
                           </div>
                        </div>
                        {viewMode === 'years' && <ChevronRight size={16} className="text-gray-300" />}
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
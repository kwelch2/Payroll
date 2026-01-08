import React, { useState, useRef } from 'react';
import { FolderOpen, FilePlus } from 'lucide-react';
import Editor from './Editor';
import { PayrollRow, Employee, MasterRates } from '../types';
import { listAllPayrollRuns, loadJsonFile, DriveFile, SystemIds } from '../services/driveService';
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
  const [fileList, setFileList] = useState<DriveFile[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { notify, confirm } = useFeedback();

  // --- ACTIONS ---

  const handleListFiles = async () => {
    if (!systemIds) {
      notify('error', 'System not fully initialized. Please wait or refresh.');
      return;
    }
    setShowLoadModal(true);
    setIsLoadingList(true);
    try {
      const files = await listAllPayrollRuns(systemIds.rootId);
      setFileList(files);
    } catch (err) {
      console.error(err);
      notify('error', getErrorMessage(err, 'Failed to load payroll runs.'));
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

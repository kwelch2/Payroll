import React, { useEffect, useMemo, useState } from 'react';
import { PayrollRow, Employee, MasterRates } from '../types';
import { calculatePayRow, getRowColor } from '../services/payrollService';
import { saveJsonFile, SystemIds } from '../services/driveService';
import { 
  Edit2, Printer, RefreshCw, FileUp, 
  AlertTriangle, UploadCloud, ChevronRight, 
  Filter, Clock, DollarSign, Hash 
} from 'lucide-react';
import RowModal from './RowModal';
import PrintWizard from './PrintWizard';
import { useFeedback } from './FeedbackProvider';
import { getErrorMessage } from '../services/errorUtils';

interface EditorProps {
  data: PayrollRow[];
  setData: (data: PayrollRow[]) => void;
  employees: Employee[];
  rates: MasterRates;
  systemIds: SystemIds | null;
}

type ViewMode = 'summary' | 'detail';
type FilterMode = 'all' | 'flagged' | 'standby';

export default function Editor({ data, setData, employees, rates, systemIds }: EditorProps) {
  const [editingRow, setEditingRow] = useState<PayrollRow | null>(null);
  const [showPrintWizard, setShowPrintWizard] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { notify, confirm, prompt } = useFeedback();
  
  // Filter States
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  
  // Accordion States
  const [collapsedEmp, setCollapsedEmp] = useState<Set<string>>(new Set());
  const [expandedCode, setExpandedCode] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;

  // --- Helpers ---

  const getEffectiveTotal = (row: PayrollRow) => {
    if (row.manual_rate_override !== undefined && row.manual_rate_override !== null) {
       const def = rates.pay_codes.definitions.find(d => d.label === row.code);
       const isFlat = def?.type === 'flat';
       return row.manual_rate_override * (isFlat ? 1 : row.hours);
    }
    return row.total || 0;
  };

  // --- Stats Calculation ---
  const stats = useMemo(() => {
    return data.reduce((acc, row) => {
      const total = getEffectiveTotal(row);
      const isStandby = row.code.toLowerCase().includes('standby') || row.code.toLowerCase().includes('on call');
      
      return {
        grandTotal: acc.grandTotal + total,
        totalHours: acc.totalHours + row.hours,
        standbyQty: acc.standbyQty + (isStandby ? row.hours : 0), // row.hours acts as Qty for flat rates
        flagged: acc.flagged + (row.alert ? 1 : 0)
      };
    }, { grandTotal: 0, totalHours: 0, standbyQty: 0, flagged: 0 });
  }, [data, rates]);

  // --- Filtering ---
  const filteredData = useMemo(() => {
    return data.filter(row => {
      if (filterMode === 'flagged') return !!row.alert;
      if (filterMode === 'standby') return row.code.toLowerCase().includes('standby') || row.code.toLowerCase().includes('on call');
      return true;
    });
  }, [data, filterMode]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterMode, filteredData.length]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const pagedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // --- Grouping ---
  const groupedData = useMemo(() => {
    const groups: Record<string, { 
      name: string, 
      payLevel: string, 
      totalPay: number, 
      totalHours: number, 
      codes: Record<string, { totalPay: number, totalHours: number, rows: PayrollRow[] }> 
    }> = {};

    filteredData.forEach(row => {
      if (!groups[row.name]) {
        groups[row.name] = { 
          name: row.name, 
          payLevel: row.payLevel, 
          totalPay: 0, 
          totalHours: 0, 
          codes: {} 
        };
      }
      
      const emp = groups[row.name];
      const pay = getEffectiveTotal(row);

      emp.totalPay += pay;
      emp.totalHours += row.hours;

      if (!emp.codes[row.code]) {
        emp.codes[row.code] = { totalPay: 0, totalHours: 0, rows: [] };
      }
      
      emp.codes[row.code].totalPay += pay;
      emp.codes[row.code].totalHours += row.hours;
      emp.codes[row.code].rows.push(row);
    });

    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredData, rates]);

  // --- Handlers ---

  const toggleEmp = (name: string) => {
    const newSet = new Set(collapsedEmp);
    if (newSet.has(name)) newSet.delete(name);
    else newSet.add(name);
    setCollapsedEmp(newSet);
  };

  const toggleCode = (id: string) => {
    const newSet = new Set(expandedCode);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedCode(newSet);
  };

  const handleUpdateRow = (updated: PayrollRow) => {
    setData(data.map(r => r.id === updated.id ? updated : r));
    setEditingRow(null);
  };

  const handleDeleteRow = async (id: string) => {
    const approved = await confirm({
      title: 'Delete Line Item',
      message: 'Are you sure you want to delete this line?',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel'
    });
    if (approved) {
      setData(data.filter(r => r.id !== id));
      setEditingRow(null);
    }
  };

  const handleRefreshDraft = () => {
    const refreshed = data.map(r => {
      const calc = calculatePayRow(r.name, r.code, r.hours, employees, rates);
      calc.manual_rate_override = r.manual_rate_override;
      calc.manual_note = r.manual_note;
      calc.id = r.id;
      calc.startDate = r.startDate;
      calc.startTime = r.startTime;
      calc.endDate = r.endDate;
      calc.endTime = r.endTime;
      return calc;
    });
    setData(refreshed);
    notify('success', 'Draft refreshed with latest rates/staff settings.');
  };

  const handleSaveToDrive = async () => {
    if (data.length === 0) return;
    if (!systemIds) {
        notify('error', 'System connection lost. Please refresh.');
        return;
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const defaultName = `Payroll_Run_${dateStr}`;

    let filename = await prompt({
      title: 'Save Payroll Run',
      message: 'Enter a name for this payroll file:',
      initialValue: defaultName,
      confirmLabel: 'Save',
      cancelLabel: 'Cancel'
    });
    if (filename === null) return; 

    filename = filename.trim();
    if (filename === "") {
      notify('error', 'Filename cannot be empty.');
      return;
    }
    if (!filename.toLowerCase().endsWith('.json')) {
      filename += '.json';
    }

    try {
      setIsSaving(true);
      await saveJsonFile(filename, { meta: { date: dateStr, stats }, rows: data }, systemIds.currentYearId);
      notify('success', `Successfully saved to Drive as: ${filename}`);
    } catch (err) {
      console.error(err);
      notify('error', getErrorMessage(err, 'Failed to save to Drive.'));
    } finally {
      setIsSaving(false);
    }
  };

  // --- CSV IMPORT ---
  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n');
      const newRows: PayrollRow[] = [];
      let headerIndex = -1;
      
      for (let i = 0; i < Math.min(lines.length, 20); i++) {
        if (lines[i].includes("Last Name") && lines[i].includes("Start Date")) {
          headerIndex = i;
          break;
        }
      }

      if (headerIndex === -1) {
        notify('error', "Could not find valid header row. Ensure CSV has 'Last Name', 'Start Date', etc.");
        return;
      }

      for (let i = headerIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const cleanCols = cols.map(c => c.replace(/^"|"$/g, '').trim());
        if (cleanCols.length < 10) continue;

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
        notify('success', `Successfully imported ${newRows.length} rows.`);
      } else {
        notify('error', 'No valid rows found. Please check your CSV format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* --- TOP STATS BAR (Interactive) --- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Gross Pay */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <DollarSign size={14} /> Gross Pay
          </span>
          <span className="text-2xl font-bold text-gray-900 mt-1">${stats.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>

        {/* Total Hours */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Clock size={14} /> Total Hours
          </span>
          <span className="text-2xl font-bold text-gray-900 mt-1">{stats.totalHours.toFixed(2)}</span>
        </div>

        {/* Standby Qty (Clickable) */}
        <button 
          type="button"
          onClick={() => setFilterMode(filterMode === 'standby' ? 'all' : 'standby')}
          aria-pressed={filterMode === 'standby'}
          className={`p-4 rounded-xl shadow-sm border cursor-pointer transition-all hover:shadow-md active:scale-95 flex flex-col text-left
            ${filterMode === 'standby' ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-100' : 'bg-white border-gray-200 hover:bg-blue-50/50'}`}
        >
          <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${filterMode === 'standby' ? 'text-blue-700' : 'text-gray-400'}`}>
            <Hash size={14} /> Standby Qty
          </span>
          <span className={`text-2xl font-bold mt-1 ${filterMode === 'standby' ? 'text-blue-800' : 'text-blue-600'}`}>{stats.standbyQty.toFixed(0)}</span>
          {filterMode === 'standby' && <div className="text-[10px] text-blue-600 font-medium mt-1">Filtering Active</div>}
        </button>

        {/* Flags/Errors (Clickable) */}
        <button 
          type="button"
          onClick={() => setFilterMode(filterMode === 'flagged' ? 'all' : 'flagged')}
          aria-pressed={filterMode === 'flagged'}
          className={`p-4 rounded-xl shadow-sm border cursor-pointer transition-all hover:shadow-md active:scale-95 flex flex-col text-left
            ${filterMode === 'flagged' ? 'bg-red-50 border-red-400 ring-2 ring-red-100' : 'bg-white border-gray-200 hover:bg-red-50/50'}
            ${stats.flagged > 0 ? 'border-gray-200' : 'opacity-70'}`}
        >
          <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${filterMode === 'flagged' || stats.flagged > 0 ? 'text-red-600' : 'text-gray-400'}`}>
            <AlertTriangle size={14} /> Flags / Errors
          </span>
          <span className={`text-2xl font-bold mt-1 ${filterMode === 'flagged' || stats.flagged > 0 ? 'text-red-700' : 'text-gray-900'}`}>{stats.flagged}</span>
          {filterMode === 'flagged' && <div className="text-[10px] text-red-600 font-medium mt-1">Filtering Active</div>}
        </button>
      </div>

      {/* --- CONTROLS --- */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200 sticky top-0 z-10">
        
        {/* View Toggles */}
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button 
            onClick={() => setViewMode('summary')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'summary' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Summary View
          </button>
          <button 
            onClick={() => setViewMode('detail')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'detail' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Detailed Log
          </button>
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center gap-3">
           <div className="relative">
             <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
             <select 
               className={`pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer font-medium
                 ${filterMode !== 'all' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-gray-50 border-gray-200'}`}
               value={filterMode}
               onChange={(e) => setFilterMode(e.target.value as FilterMode)}
             >
               <option value="all">Show All Items</option>
               <option value="flagged">⚠️ Errors & Flags Only</option>
               <option value="standby">🕰️ Standby/On-Call Only</option>
             </select>
           </div>

           <div className="h-6 w-px bg-gray-300 mx-1"></div>

           <label className="btn-icon" title="Import CSV" aria-label="Import CSV">
             <FileUp size={18} />
             <input type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
           </label>
           
           <button onClick={handleRefreshDraft} className="btn-icon" title="Refresh Rates" aria-label="Refresh Rates">
             <RefreshCw size={18} />
           </button>
           
           <button onClick={handleSaveToDrive} disabled={isSaving} className={`btn-icon ${isSaving ? 'opacity-50' : ''}`} title="Save to Drive" aria-label="Save to Drive">
             {isSaving ? <span className="animate-spin text-xs">⏳</span> : <UploadCloud size={18} />}
           </button>

           <button onClick={() => setShowPrintWizard(true)} className="btn-primary flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-black font-medium shadow-md transition-all ml-2">
             <Printer size={18} /> <span className="hidden sm:inline">Finalize</span>
           </button>
        </div>
      </div>

      {/* --- CONTENT AREA --- */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden min-h-[500px]">
        
        {/* VIEW: SUMMARY */}
        {viewMode === 'summary' && (
          <div className="divide-y divide-gray-100">
             {groupedData.map((emp) => {
               const isEmpOpen = !collapsedEmp.has(emp.name);
               
               return (
                 <div key={emp.name} className="bg-white">
                   {/* Employee Header */}
                   <div 
                     className="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                     onClick={() => toggleEmp(emp.name)}
                   >
                     <div className="flex items-center gap-3">
                       <div className={`p-1 rounded-full transition-transform ${isEmpOpen ? 'rotate-90 bg-blue-100 text-blue-600' : 'text-gray-400'}`}>
                         <ChevronRight size={18} />
                       </div>
                       <div>
                         <h3 className="font-bold text-gray-800 text-lg">{emp.name}</h3>
                         <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{emp.payLevel}</span>
                       </div>
                     </div>
                     <div className="text-right">
                       <div className="font-bold text-gray-900">${emp.totalPay.toFixed(2)}</div>
                       <div className="text-xs text-gray-500">{emp.totalHours.toFixed(2)} hrs</div>
                     </div>
                   </div>

                   {/* Employee Detail (Codes) */}
                   {isEmpOpen && (
                     <div className="bg-gray-50 border-t border-gray-100">
                       {Object.entries(emp.codes).map(([code, stats]) => {
                         const codeId = `${emp.name}-${code}`;
                         const isCodeExpanded = expandedCode.has(codeId);
                         
                         const def = rates.pay_codes.definitions.find(d => d.label === code);
                         const baseColor = def ? def.color : '#e2e8f0';
                         const headerBg = `${baseColor}25`;
                         const isFlatRate = def?.type === 'flat';

                         return (
                           <div key={code} className="border-b border-gray-100 last:border-0">
                             {/* Code Header (Clickable) */}
                             <div 
                               className="flex items-center justify-between py-3 px-4 pl-12 cursor-pointer transition-colors border-l-4"
                               style={{ backgroundColor: headerBg, borderLeftColor: baseColor }}
                               onClick={() => toggleCode(codeId)}
                             >
                               <div className="flex items-center gap-2">
                                  <div className={`transition-transform ${isCodeExpanded ? 'rotate-90 text-gray-700' : 'text-gray-500'}`}>
                                    <ChevronRight size={14} />
                                  </div>
                                  <span className="font-bold text-gray-800">{code}</span>
                                  <span className="text-xs text-gray-600 opacity-70 ml-2">
                                    {isFlatRate 
                                      ? `(${stats.totalHours.toFixed(2)} qty)` 
                                      : `(${stats.totalHours.toFixed(2)} hrs)`}
                                  </span>
                               </div>

                               <div className="text-right flex gap-6 text-sm">
                                  <span className="w-24 text-gray-800 font-medium text-right">
                                    {isFlatRate 
                                      ? `${stats.rows.length} Qty` 
                                      : `${stats.totalHours.toFixed(2)} hrs`}
                                  </span>
                                  <span className="w-24 font-mono font-bold text-gray-900">${stats.totalPay.toFixed(2)}</span>
                               </div>
                             </div>

                             {/* Drill Down (Actual Lines) */}
                             {isCodeExpanded && (
                               <div className="bg-white pl-16 pr-4 py-2 shadow-inner">
                                 <table className="w-full text-xs text-left">
                                   <thead>
                                     <tr className="text-gray-400 border-b border-gray-100">
                                       <th className="py-2 font-normal w-24">Date</th>
                                       <th className="py-2 font-normal w-32">Time</th>
                                       <th className="py-2 font-normal text-right">Hrs/Qty</th>
                                       <th className="py-2 font-normal text-right">Rate</th>
                                       <th className="py-2 font-normal text-right">Total</th>
                                       <th className="py-2 font-normal text-right">Action</th>
                                     </tr>
                                   </thead>
                                   <tbody>
                                     {stats.rows.map(row => (
                                       <tr key={row.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                                         <td className="py-2 text-gray-600">{row.startDate || '-'}</td>
                                         <td className="py-2 text-gray-600 text-[10px]">
                                            {row.startTime ? `${row.startTime} - ${row.endTime}` : '-'}
                                         </td>
                                         <td className="py-2 text-right">{row.hours}</td>
                                         <td className="py-2 text-right text-gray-500">{row.manual_rate_override ? `*${row.manual_rate_override}` : row.rate}</td>
                                         <td className="py-2 text-right font-medium">${getEffectiveTotal(row).toFixed(2)}</td>
                                         <td className="py-2 text-right">
                                           <button onClick={() => setEditingRow(row)} className="text-blue-600 hover:underline">Edit</button>
                                         </td>
                                       </tr>
                                     ))}
                                   </tbody>
                                 </table>
                               </div>
                             )}
                           </div>
                         );
                       })}
                     </div>
                   )}
                 </div>
               );
             })}
          </div>
        )}

        {/* VIEW: DETAIL (Flat Table) */}
        {viewMode === 'detail' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider border-b border-gray-200">
                  <th className="p-4 font-semibold">Employee</th>
                  <th className="p-4 font-semibold">Pay Code</th>
                  <th className="p-4 font-semibold">Date</th>
                  <th className="p-4 font-semibold">Time</th>
                  <th className="p-4 font-semibold text-right">Hrs/Qty</th>
                  <th className="p-4 font-semibold text-right">Rate</th>
                  <th className="p-4 font-semibold text-right">Total</th>
                  <th className="p-4 font-semibold text-center">Flags</th>
                  <th className="p-4 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr><td colSpan={9} className="p-8 text-center text-gray-400">No data found matching your filters.</td></tr>
                ) : (
                  pagedData.map((row) => {
                    const baseColor = getRowColor(row.code, rates);
                    const rowBg = `${baseColor}20`; // Low opacity hex
                    const effectiveTotal = getEffectiveTotal(row);

                    return (
                      <tr 
                        key={row.id} 
                        style={{ backgroundColor: rowBg }}
                        className="hover:brightness-95 transition-all group border-b border-white"
                      >
                        <td className="p-3">
                          <div className="font-bold text-gray-800 text-sm">{row.name}</div>
                          <div className="text-xs text-gray-500">{row.payLevel}</div>
                        </td>
                        <td className="p-3">
                          <span className="font-medium text-gray-700 text-sm">{row.code}</span>
                          {row.manual_note && <div className="text-[10px] text-blue-600 mt-0.5">{row.manual_note}</div>}
                        </td>
                        <td className="p-3 text-sm text-gray-700">
                          {row.startDate || <span className="text-gray-300">-</span>}
                        </td>
                        <td className="p-3 text-xs text-gray-600 font-mono">
                          {row.startTime ? `${row.startTime} - ${row.endTime}` : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="p-3 text-right font-mono text-sm">{row.hours.toFixed(2)}</td>
                        <td className="p-3 text-right font-mono text-xs text-gray-500">
                          {row.manual_rate_override ? (
                            <span className="bg-yellow-100 text-yellow-800 px-1 rounded font-bold" title="Manual Override">${row.manual_rate_override.toFixed(2)}</span>
                          ) : (
                            row.rate !== null ? `$${row.rate.toFixed(2)}` : '-'
                          )}
                        </td>
                        <td className="p-3 text-right font-bold text-gray-800 font-mono text-sm">
                          ${effectiveTotal.toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                           {row.alert && (
                             <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${row.alertLevel === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                               <AlertTriangle size={10} /> {row.alert}
                             </div>
                           )}
                        </td>
                        <td className="p-3 text-center">
                           <button onClick={() => setEditingRow(row)} className="p-1.5 hover:bg-white rounded text-gray-500 hover:text-blue-600 transition-colors">
                             <Edit2 size={16} />
                           </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            {filteredData.length > pageSize && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-sm bg-gray-50">
                <span className="text-gray-500">
                  Page {currentPage} of {totalPages} • {filteredData.length} rows
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {editingRow && (
        <RowModal 
          row={editingRow} 
          onClose={() => setEditingRow(null)} 
          onSave={handleUpdateRow} 
          onDelete={handleDeleteRow}
          rates={rates}
          employees={employees} // Updated to pass employees
        />
      )}

      {showPrintWizard && (
        <PrintWizard 
          data={data}
          onClose={() => setShowPrintWizard(false)}
          rates={rates}
        />
      )}

    </div>
  );
}

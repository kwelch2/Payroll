import { useEffect, useMemo, useRef, useState } from 'react';
import { PayrollRow, MasterRates, Employee } from '../types';
import { 
  X, Printer, CheckSquare, Square, Filter, 
  ArrowUpDown, Search, ChevronDown, ChevronUp,
  LayoutList, Users
} from 'lucide-react';

interface PrintWizardProps {
  data: PayrollRow[];
  onClose: () => void;
  rates: MasterRates;
  employees: Employee[]; 
}

type ReportLayout = 'summary' | 'detail';
type SelectionMode = 'all' | 'custom';
type SortField = 'name' | 'payLevel' | 'status' | 'code' | 'date' | 'total';

export default function PrintWizard({ data, onClose, rates, employees }: PrintWizardProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  
  // --- CONFIGURATION STATE ---
  const [layout, setLayout] = useState<ReportLayout>('summary');
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('all');
  
  // --- FILTER STATE ---
  const [search, setSearch] = useState("");
  const [selectedLevels, setSelectedLevels] = useState<Set<string>>(new Set());
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [selectedStatus, setSelectedStatus] = useState<string>('all'); 
  
  // --- SORT STATE ---
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // --- SELECTION STATE ---
  const [customSelectedIds, setCustomSelectedIds] = useState<Set<string>>(new Set());

  // --- UI TOGGLES ---
  const [showLevelFilter, setShowLevelFilter] = useState(false);
  const [showCodeFilter, setShowCodeFilter] = useState(false);
  const [renderAll, setRenderAll] = useState(false);
  
  const previewLimit = 200;

  // --- 1. DERIVED LOOKUPS ---
  const empStatusMap = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach(e => {
        map.set(e.personal.full_name, e.classifications.employment_type || 'PRN');
    });
    return map;
  }, [employees]);

  // --- 2. DATA PROCESSING ---
  const processedData = useMemo(() => {
    let result = [...data];

    // A. Apply Filters
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(r => r.name.toLowerCase().includes(lower));
    }

    if (selectedStatus !== 'all') {
      result = result.filter(r => {
        const status = r.employmentType || empStatusMap.get(r.name) || 'PRN';
        return status === selectedStatus;
      });
    }

    if (selectedLevels.size > 0) {
      result = result.filter(r => selectedLevels.has(r.payLevel));
    }

    if (selectedCodes.size > 0) {
      result = result.filter(r => selectedCodes.has(r.code));
    }

    // B. Apply Sorting
    result.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortField) {
        case 'name': valA = a.name; valB = b.name; break;
        case 'payLevel': 
           const rA = rates.pay_levels[a.payLevel]?.rank ?? 99;
           const rB = rates.pay_levels[b.payLevel]?.rank ?? 99;
           if (rA !== rB) { valA = rA; valB = rB; } else { valA = a.payLevel; valB = b.payLevel; }
           break;
        case 'status': 
           valA = a.employmentType || empStatusMap.get(a.name) || 'PRN';
           valB = b.employmentType || empStatusMap.get(b.name) || 'PRN';
           break;
        case 'code': valA = a.code; valB = b.code; break;
        case 'date': valA = a.startDate || ''; valB = b.startDate || ''; break;
        case 'total':
           valA = a.manual_rate_override ? (a.manual_rate_override * (rates.pay_codes.definitions.find(d=>d.label===a.code)?.type==='flat'?1:a.hours)) : (a.total || 0);
           valB = b.manual_rate_override ? (b.manual_rate_override * (rates.pay_codes.definitions.find(d=>d.label===b.code)?.type==='flat'?1:b.hours)) : (b.total || 0);
           break;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, search, selectedStatus, selectedLevels, selectedCodes, sortField, sortAsc, rates, empStatusMap]);

  // --- 3. FINAL SET FOR PRINTING ---
  const finalPrintData = useMemo(() => {
    if (selectionMode === 'all') return processedData;
    return processedData.filter(r => customSelectedIds.has(r.id));
  }, [processedData, selectionMode, customSelectedIds]);

  // --- 4. AGGREGATION FOR SUMMARY ---
  const summaryGroups = useMemo(() => {
    const groups = new Map<string, {
      name: string,
      payLevel: string,
      status: string,
      codes: Map<string, { label: string, hours: number, total: number, color: string }>,
      grandTotal: number,
      totalHours: number
    }>();

    finalPrintData.forEach(row => {
      if (!groups.has(row.name)) {
        groups.set(row.name, { 
          name: row.name, 
          payLevel: row.payLevel, 
          status: row.employmentType || empStatusMap.get(row.name) || 'PRN',
          codes: new Map(), 
          grandTotal: 0, 
          totalHours: 0 
        });
      }
      
      const emp = groups.get(row.name)!;
      
      let pay = row.total || 0;
      if (row.manual_rate_override !== undefined && row.manual_rate_override !== null) {
         const def = rates.pay_codes.definitions.find(d => d.label === row.code);
         const isFlat = def?.type === 'flat';
         pay = row.manual_rate_override * (isFlat ? 1 : row.hours);
      }

      emp.grandTotal += pay;
      emp.totalHours += row.hours;

      if (!emp.codes.has(row.code)) {
        emp.codes.set(row.code, { 
            label: row.code, 
            hours: 0, 
            total: 0,
            color: rates.pay_codes.definitions.find(d => d.label === row.code)?.color || '#e2e8f0'
        });
      }
      const codeStats = emp.codes.get(row.code)!;
      codeStats.hours += row.hours;
      codeStats.total += pay;
    });

    return Array.from(groups.values());
  }, [finalPrintData, rates, empStatusMap]);

  // --- UI HELPERS ---
  const handlePrint = () => {
    setRenderAll(true);
    setTimeout(() => window.print(), 300);
  };

  const getCodeColor = (code: string) => rates.pay_codes.definitions.find(d => d.label === code)?.color || '#e2e8f0';

  const MultiSelectFilter = ({ title, options, selectedSet, setFunction, isOpen, toggleOpen }: any) => {
    const toggleItem = (val: string) => {
      const newSet = new Set(selectedSet);
      if (newSet.has(val)) newSet.delete(val); else newSet.add(val);
      setFunction(newSet);
    };
    return (
      <div className="border border-gray-300 rounded-lg bg-white overflow-hidden shadow-sm">
        <button onClick={toggleOpen} className="w-full flex justify-between items-center p-2.5 text-xs font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors">
          <span>{title} {selectedSet.size > 0 && <span className="text-blue-600">({selectedSet.size})</span>}</span>
          {isOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
        </button>
        {isOpen && (
          <div className="max-h-40 overflow-y-auto p-2 space-y-1 bg-white border-t border-gray-100">
            <button onClick={() => setFunction(new Set())} className={`w-full text-left px-2 py-1.5 text-[10px] rounded hover:bg-gray-50 transition-colors ${selectedSet.size === 0 ? 'font-bold text-blue-600 bg-blue-50' : 'text-gray-500'}`}>All {title}s</button>
            {options.map((opt: string) => (
              <button key={opt} onClick={() => toggleItem(opt)} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded text-xs text-left transition-colors">
                {selectedSet.has(opt) ? <CheckSquare size={14} className="text-blue-600"/> : <Square size={14} className="text-gray-300"/>}
                <span className={selectedSet.has(opt) ? 'text-gray-900 font-medium' : 'text-gray-600'}>{opt}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // --- KEYBOARD & FOCUS ---
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;
    modal.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    };
    modal.addEventListener('keydown', handleKeyDown);
    return () => modal.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => { setRenderAll(false); }, [search, selectedStatus, selectedLevels, selectedCodes, sortField, sortAsc]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div ref={modalRef} tabIndex={-1} className="bg-white w-full max-w-7xl h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-700 ring-1 ring-white/10">
        
        {/* HEADER */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-slate-900 text-white no-print shrink-0">
           <div className="flex items-center gap-3">
             <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-900/50"><Printer size={20} className="text-white" /></div>
             <div>
               <h2 className="text-lg font-bold tracking-tight">Print & Finalize</h2>
               <p className="text-xs text-slate-400">Review, filter, and select data for final report</p>
             </div>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-300 hover:text-white"><X size={24}/></button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
           
           {/* SIDEBAR CONTROLS */}
           <div className="w-full md:w-80 bg-slate-50 border-r border-gray-200 flex flex-col gap-5 p-5 no-print overflow-y-auto shrink-0">
              
              <div className="space-y-2">
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><LayoutList size={10}/> Report Layout</label>
                 <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                    <button onClick={() => setLayout('summary')} className={`py-2 text-xs font-bold rounded flex items-center justify-center gap-1 transition-all ${layout === 'summary' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>Summary</button>
                    <button onClick={() => setLayout('detail')} className={`py-2 text-xs font-bold rounded flex items-center justify-center gap-1 transition-all ${layout === 'detail' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>Detailed</button>
                 </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Users size={10}/> Include Rows</label>
                 <div className="grid grid-cols-1 gap-2">
                    <button onClick={() => setSelectionMode('all')} className={`text-left px-3 py-2 rounded-lg border text-xs font-medium transition-all ${selectionMode === 'all' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'bg-white border-gray-200 text-gray-600'}`}>Use All Filtered Rows ({processedData.length})</button>
                    <button onClick={() => setSelectionMode('custom')} className={`text-left px-3 py-2 rounded-lg border text-xs font-medium transition-all ${selectionMode === 'custom' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'bg-white border-gray-200 text-gray-600'}`}>Custom Selection Only ({customSelectedIds.size})</button>
                 </div>
              </div>

              <hr className="border-gray-200" />

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider"><Filter size={12} /> Filters</div>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
                  <input className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Search Name..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-bold text-gray-500 uppercase">Employment Status</label>
                   <select className="w-full text-sm border border-gray-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                      <option value="all">All Employees</option>
                      <option value="Full Time">Full Time</option>
                      <option value="PRN">PRN</option>
                   </select>
                </div>
                <MultiSelectFilter title="Pay Level" options={Array.from(new Set([...Object.keys(rates.pay_levels), 'Hourly Only'])).sort()} selectedSet={selectedLevels} setFunction={setSelectedLevels} isOpen={showLevelFilter} toggleOpen={() => { setShowLevelFilter(!showLevelFilter); setShowCodeFilter(false); }} />
                <MultiSelectFilter title="Pay Code" options={rates.pay_codes.definitions.map(d => d.label).sort()} selectedSet={selectedCodes} setFunction={setSelectedCodes} isOpen={showCodeFilter} toggleOpen={() => { setShowCodeFilter(!showCodeFilter); setShowLevelFilter(false); }} />
              </div>

              <div className="space-y-2 pt-4 border-t border-gray-200">
                 <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider"><ArrowUpDown size={12} /> Sorting</div>
                 <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                       <select className="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white" value={sortField} onChange={(e) => setSortField(e.target.value as SortField)}>
                         <option value="name">Name</option>
                         <option value="payLevel">Rank</option>
                         <option value="status">Status</option>
                         <option value="code">Pay Code</option>
                         <option value="date">Date</option>
                         <option value="total">Total Pay</option>
                       </select>
                    </div>
                    <button onClick={() => setSortAsc(!sortAsc)} className="col-span-1 border border-gray-300 rounded-lg bg-white flex items-center justify-center hover:bg-gray-50">
                       {sortAsc ? <span className="text-[10px] font-bold">ASC</span> : <span className="text-[10px] font-bold">DESC</span>}
                    </button>
                 </div>
              </div>

              {/* SELECTION LIST FOR CUSTOM MODE */}
              {selectionMode === 'custom' && (
                <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-lg shadow-inner overflow-hidden min-h-[200px]">
                   <div className="p-2 bg-gray-100 border-b border-gray-200 flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-500">Available Rows</span>
                      <div className="space-x-2">
                        <button onClick={() => { const newIds = new Set(customSelectedIds); processedData.forEach(r => newIds.add(r.id)); setCustomSelectedIds(newIds); }} className="text-[10px] text-blue-600 font-bold hover:underline">Select All</button>
                        <button onClick={() => setCustomSelectedIds(new Set())} className="text-[10px] text-red-500 font-bold hover:underline">Clear</button>
                      </div>
                   </div>
                   <div className="flex-1 overflow-y-auto p-2 space-y-1">
                      {processedData.length === 0 ? <div className="p-4 text-center text-xs text-gray-400">No rows match filters.</div> : processedData.map(row => (
                          <button key={row.id} onClick={() => { const newSet = new Set(customSelectedIds); if (newSet.has(row.id)) newSet.delete(row.id); else newSet.add(row.id); setCustomSelectedIds(newSet); }} className={`w-full text-left p-2 rounded flex items-center gap-2 text-xs transition-colors ${customSelectedIds.has(row.id) ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`}>
                             {customSelectedIds.has(row.id) ? <CheckSquare size={14}/> : <Square size={14} className="text-gray-300"/>}
                             <div className="truncate flex-1"><span className="font-bold">{row.name}</span> <span className="text-gray-400">|</span> {row.code}</div>
                          </button>
                      ))}
                   </div>
                </div>
              )}

              <div className="mt-auto pt-4">
                <button onClick={handlePrint} className="w-full btn-primary bg-slate-900 text-white py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-black transform active:scale-95 transition-all">
                  <Printer size={18} /> Print Report
                </button>
              </div>
           </div>

           {/* PREVIEW AREA */}
           <div className="flex-1 bg-gray-100 overflow-y-auto p-4 md:p-8 relative">
              <div id="print-area" className="max-w-[1000px] mx-auto min-h-[1000px] bg-white p-8 md:p-12 shadow-sm border border-gray-200 print:shadow-none print:border-none print:p-0 print:w-full">
                 <div className="flex justify-between items-start border-b-4 border-slate-900 pb-6 mb-8">
                    <div className="flex items-center gap-5">
                       <div className="w-16 h-16 bg-red-700 text-white rounded-lg flex items-center justify-center text-3xl font-black print:border print:border-red-700">G</div>
                       <div>
                          <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">Gem County Payroll</h1>
                          <div className="flex flex-col text-xs font-medium text-slate-500 mt-1">
                             <span>Run Date: {new Date().toLocaleDateString()}</span>
                             <span>Report: {layout === 'summary' ? 'Payroll Summary' : 'Detailed Audit Log'}</span>
                          </div>
                       </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                       <div className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Items Included</div>
                       <div className="text-2xl font-black text-slate-900">{finalPrintData.length}</div>
                       <div className="text-[10px] text-slate-400 mt-1">{selectionMode === 'custom' ? 'Custom Selection' : 'Filtered List'}</div>
                    </div>
                 </div>

                 <div className="print-content space-y-8">
                    
                    {/* Summary View */}
                    {layout === 'summary' && (
                      <div className="space-y-6">
                        {summaryGroups.map((emp) => (
                          <div key={emp.name} className="break-inside-avoid border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gray-50 p-3 flex justify-between items-center border-b border-gray-200">
                               <div>
                                 <span className="font-bold text-gray-900 text-sm">{emp.name}</span>
                                 <span className="mx-2 text-gray-300">|</span>
                                 <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{emp.payLevel}</span>
                                 <span className="mx-2 text-gray-300">|</span>
                                 <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-bold">{emp.status}</span>
                               </div>
                               <div className="text-right">
                                 <span className="font-mono font-bold text-sm text-gray-900">${emp.grandTotal.toFixed(2)}</span>
                               </div>
                            </div>
                            <table className="w-full text-xs">
                               <tbody>
                                 {Array.from(emp.codes.values()).map((code) => (
                                   <tr key={code.label} className="border-b border-gray-50 last:border-0" style={{ backgroundColor: `${code.color}10` }}>
                                     <td className="pl-4 py-1.5 w-1/2 flex items-center gap-2 font-medium text-gray-700">
                                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: code.color }}></div>
                                        {code.label}
                                     </td>
                                     <td className="py-1.5 text-right w-1/4 text-gray-600">{code.hours.toFixed(2)} {code.label.toLowerCase().includes('flat') ? 'qty' : 'hrs'}</td>
                                     <td className="pr-4 py-1.5 text-right w-1/4 font-mono font-medium">${code.total.toFixed(2)}</td>
                                   </tr>
                                 ))}
                                 <tr className="bg-white">
                                    <td className="pl-4 py-2 font-bold text-gray-400 uppercase text-[10px]">Total</td>
                                    <td className="py-2 text-right font-bold text-gray-700">{emp.totalHours.toFixed(2)} hrs</td>
                                    <td className="pr-4 py-2 text-right font-bold text-gray-900">${emp.grandTotal.toFixed(2)}</td>
                                 </tr>
                               </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Detailed View */}
                    {layout === 'detail' && (
                      <div>
                        <table className="w-full text-left border-collapse text-[10px] md:text-xs">
                           <thead>
                             <tr className="border-b-2 border-slate-900 bg-gray-50 text-slate-500 uppercase tracking-wider font-bold">
                               <th className="py-2 px-2">Employee</th>
                               <th className="py-2 px-2">Status</th>
                               <th className="py-2 px-2">Pay Code</th>
                               <th className="py-2 px-2">Date</th>
                               <th className="py-2 px-2 text-right">Hrs/Qty</th>
                               <th className="py-2 px-2 text-right">Rate</th>
                               <th className="py-2 px-2 text-right">Total</th>
                             </tr>
                           </thead>
                           <tbody>
                             {(renderAll ? finalPrintData : finalPrintData.slice(0, previewLimit)).map((row, i) => {
                               const pay = row.manual_rate_override !== undefined && row.manual_rate_override !== null
                                 ? row.manual_rate_override * (rates.pay_codes.definitions.find(d => d.label === row.code)?.type === 'flat' ? 1 : row.hours)
                                 : (row.total || 0);
                               const color = getCodeColor(row.code);
                               const status = row.employmentType || empStatusMap.get(row.name) || 'PRN';

                               return (
                                 <tr key={i} className="border-b border-gray-100 break-inside-avoid" style={{ backgroundColor: `${color}15` }}>
                                   <td className="py-1.5 px-2 font-medium text-gray-900">
                                      {row.name}
                                      <div className="text-[9px] text-gray-400 font-normal">{row.payLevel}</div>
                                   </td>
                                   <td className="py-1.5 px-2">
                                      <span className="text-[9px] font-bold text-gray-500 bg-white border border-gray-200 px-1.5 py-0.5 rounded">{status}</span>
                                   </td>
                                   <td className="py-1.5 px-2 font-medium text-gray-700">{row.code}</td>
                                   <td className="py-1.5 px-2 text-gray-500">{row.startDate || '-'}</td>
                                   <td className="py-1.5 px-2 text-right font-mono text-gray-600">{row.hours.toFixed(2)}</td>
                                   <td className="py-1.5 px-2 text-right font-mono text-gray-400">{row.manual_rate_override ? `*${row.manual_rate_override}` : (row.rate ?? '-')}</td>
                                   <td className="py-1.5 px-2 text-right font-mono font-bold text-gray-900">${pay.toFixed(2)}</td>
                                 </tr>
                               )
                             })}
                           </tbody>
                        </table>
                        
                        {finalPrintData.length > previewLimit && !renderAll && (
                          <div className="mt-4 text-center no-print">
                             <div className="text-xs text-amber-600 mb-2 font-bold">Preview Limited to {previewLimit} Rows</div>
                             <button onClick={() => setRenderAll(true)} className="text-xs font-bold bg-amber-50 text-amber-700 px-3 py-2 rounded border border-amber-200 hover:bg-amber-100">
                               Render All {finalPrintData.length} Rows for Printing
                             </button>
                          </div>
                        )}
                      </div>
                    )}
                 </div>

                 {/* Report Footer */}
                 <div className="mt-12 pt-6 border-t-2 border-slate-900 grid grid-cols-2 gap-8 text-xs text-gray-500">
                    <div>
                       <div className="flex justify-between font-bold text-slate-900 mb-2 text-sm uppercase">
                          <span>Grand Total</span>
                          <span>${finalPrintData.reduce((acc, r) => acc + (r.total || 0), 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                       </div>
                       <p>Authorized Signature: __________________________________</p>
                    </div>
                    <div className="text-right">
                       <p>Generated by Gem Payroll System</p>
                       <p className="mt-1">Date: {new Date().toLocaleString()}</p>
                    </div>
                 </div>

              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
import React, { useState, useMemo } from 'react';
import { PayrollRow, MasterRates } from '../types';
import { 
  X, Printer, CheckSquare, Square, Filter, 
  ArrowUpDown, Search, ChevronDown, ChevronUp
} from 'lucide-react';

interface PrintWizardProps {
  data: PayrollRow[];
  onClose: () => void;
  rates: MasterRates;
}

type ViewMode = 'summary' | 'detail' | 'custom';
type SortField = 'name' | 'payLevel' | 'date';

export default function PrintWizard({ data, onClose, rates }: PrintWizardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  
  // --- FILTERS & SORTING STATE ---
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>('payLevel');
  const [sortAsc, setSortAsc] = useState(true);
  
  // Multi-Select States
  const [selectedLevels, setSelectedLevels] = useState<Set<string>>(new Set());
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  
  // UI Toggles for Filters
  const [showLevelFilter, setShowLevelFilter] = useState(false);
  const [showCodeFilter, setShowCodeFilter] = useState(false);

  // Custom Selection Set
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(data.map(d => d.id)));

  const handlePrint = () => window.print();

  // --- HELPER: Get Color ---
  const getCodeColor = (code: string) => {
    const def = rates.pay_codes.definitions.find(d => d.label === code || d.code === code);
    return def?.color || '#e2e8f0'; // Default gray
  };

  // --- DATA PROCESSING ENGINE ---
  const processedData = useMemo(() => {
    let result = [...data];

    // 1. Search Text
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(r => r.name.toLowerCase().includes(lower));
    }

    // 2. Filter by Level (Multi-select)
    if (selectedLevels.size > 0) {
      result = result.filter(r => selectedLevels.has(r.payLevel));
    }

    // 3. Filter by Pay Code (Multi-select)
    if (selectedCodes.size > 0) {
      result = result.filter(r => selectedCodes.has(r.code));
    }
    
    // 4. Custom Selection Filter (Only applies in Custom Mode)
    if (viewMode === 'custom') {
      result = result.filter(r => selectedIds.has(r.id));
    }

    // 5. Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      if (sortField === 'payLevel') {
        const rankA = rates.pay_levels[a.payLevel]?.rank || 99;
        const rankB = rates.pay_levels[b.payLevel]?.rank || 99;
        cmp = rankA - rankB || a.payLevel.localeCompare(b.payLevel);
        if (cmp === 0) cmp = a.name.localeCompare(b.name);
      }
      if (sortField === 'date') {
        const dateA = a.startDate || '';
        const dateB = b.startDate || '';
        cmp = dateA.localeCompare(dateB);
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [data, search, selectedLevels, selectedCodes, sortField, sortAsc, viewMode, selectedIds, rates]);

  // --- AGGREGATION FOR SUMMARY VIEW ---
  const summaryData = useMemo(() => {
    const groups = new Map<string, {
      name: string,
      payLevel: string,
      codes: Map<string, { label: string, hours: number, total: number, color: string }>,
      grandTotal: number,
      totalHours: number
    }>();

    processedData.forEach(row => {
      if (!groups.has(row.name)) {
        groups.set(row.name, { 
          name: row.name, 
          payLevel: row.payLevel, 
          codes: new Map(), 
          grandTotal: 0, 
          totalHours: 0 
        });
      }
      
      const emp = groups.get(row.name)!;
      
      let pay = row.total || 0;
      // Handle overrides
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
            color: getCodeColor(row.code) 
        });
      }
      const codeStats = emp.codes.get(row.code)!;
      codeStats.hours += row.hours;
      codeStats.total += pay;
    });

    return Array.from(groups.values());
  }, [processedData, rates]);

  // --- RENDERERS ---

  const MultiSelectFilter = ({ 
    title, 
    options, 
    selectedSet, 
    setFunction, 
    isOpen, 
    toggleOpen 
  }: any) => {
    const toggleItem = (val: string) => {
      const newSet = new Set(selectedSet);
      if (newSet.has(val)) newSet.delete(val);
      else newSet.add(val);
      setFunction(newSet);
    };

    return (
      <div className="border border-gray-300 rounded-lg bg-white overflow-hidden">
        <button 
          onClick={toggleOpen}
          className="w-full flex justify-between items-center p-2 text-xs font-bold text-gray-700 bg-gray-50 hover:bg-gray-100"
        >
          <span>{title} {selectedSet.size > 0 && <span className="text-blue-600">({selectedSet.size})</span>}</span>
          {isOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
        </button>
        
        {isOpen && (
          <div className="max-h-40 overflow-y-auto p-2 space-y-1 bg-white">
            <button 
               onClick={() => setFunction(new Set())}
               className={`w-full text-left px-2 py-1 text-[10px] rounded hover:bg-gray-50 ${selectedSet.size === 0 ? 'font-bold text-blue-600 bg-blue-50' : 'text-gray-500'}`}
            >
              All {title}s
            </button>
            {options.map((opt: string) => (
              <button 
                key={opt}
                onClick={() => toggleItem(opt)}
                className="w-full flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded text-xs text-left"
              >
                {selectedSet.has(opt) ? <CheckSquare size={14} className="text-blue-600"/> : <Square size={14} className="text-gray-300"/>}
                <span className={selectedSet.has(opt) ? 'text-gray-900 font-medium' : 'text-gray-600'}>{opt}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const SummaryView = () => (
    <div className="space-y-6">
      <div className="text-center border-b-2 border-black pb-2 mb-4">
        <h3 className="font-bold text-xl uppercase tracking-widest">Payroll Summary Report</h3>
        <p className="text-xs text-gray-500">Grouped by Employee • {processedData.length} records found</p>
      </div>

      <div className="space-y-4">
        {summaryData.map((emp) => (
          <div key={emp.name} className="break-inside-avoid border border-gray-300 rounded-sm overflow-hidden">
            {/* Employee Header */}
            <div className="bg-gray-100 p-2 flex justify-between items-center border-b border-gray-300">
               <div>
                 <span className="font-bold text-gray-900 text-sm">{emp.name}</span>
                 <span className="ml-2 text-[10px] text-gray-500 uppercase tracking-wider">{emp.payLevel}</span>
               </div>
               <div className="text-right">
                 <span className="font-mono font-bold text-sm">${emp.grandTotal.toFixed(2)}</span>
               </div>
            </div>
            
            {/* Pay Code Breakdown */}
            <table className="w-full text-xs">
               <tbody>
                 {Array.from(emp.codes.values()).map((code) => (
                   <tr 
                     key={code.label} 
                     className="border-b border-gray-100 last:border-0 print-color-exact"
                     style={{ backgroundColor: `${code.color}20` }} 
                   >
                     <td className="pl-4 py-1 text-gray-900 font-medium w-1/2 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: code.color }}></div>
                        {code.label}
                     </td>
                     <td className="py-1 text-right w-1/4">{code.hours.toFixed(2)} {code.label.toLowerCase().includes('flat') ? 'qty' : 'hrs'}</td>
                     <td className="pr-2 py-1 text-right w-1/4 font-medium text-gray-800">${code.total.toFixed(2)}</td>
                   </tr>
                 ))}
                 <tr className="bg-white font-bold">
                    <td className="pl-4 py-1 text-gray-900">Total</td>
                    <td className="py-1 text-right">{emp.totalHours.toFixed(2)} hrs</td>
                    <td className="pr-2 py-1 text-right">${emp.grandTotal.toFixed(2)}</td>
                 </tr>
               </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="mt-8 border-t-2 border-black pt-4 flex justify-between items-center text-sm font-bold">
         <span>Grand Total (All Employees)</span>
         <span className="text-xl">${summaryData.reduce((acc, e) => acc + e.grandTotal, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
      </div>
    </div>
  );

  const DetailView = () => (
    <div>
      <div className="text-center border-b-2 border-black pb-2 mb-4">
        <h3 className="font-bold text-xl uppercase tracking-widest">Detailed Audit Log</h3>
        <p className="text-xs text-gray-500">Line-by-line breakdown • Sorted by {sortField}</p>
      </div>

      <table className="w-full text-left border-collapse text-[10px] md:text-xs">
         <thead>
           <tr className="border-b-2 border-black bg-gray-50">
             <th className="py-1 px-1">Employee</th>
             <th className="py-1 px-1">Pay Code</th>
             <th className="py-1 px-1">Date</th>
             <th className="py-1 px-1">Time</th>
             <th className="py-1 px-1 text-right">Hrs/Qty</th>
             <th className="py-1 px-1 text-right">Rate</th>
             <th className="py-1 px-1 text-right">Total</th>
           </tr>
         </thead>
         <tbody>
           {processedData.map((row, i) => {
             const pay = row.manual_rate_override !== undefined && row.manual_rate_override !== null
               ? row.manual_rate_override * (rates.pay_codes.definitions.find(d => d.label === row.code)?.type === 'flat' ? 1 : row.hours)
               : (row.total || 0);
             
             const color = getCodeColor(row.code);

             return (
               <tr 
                 key={i} 
                 className="border-b border-gray-200 break-inside-avoid print-color-exact"
                 style={{ backgroundColor: `${color}25` }} 
               >
                 <td className="py-1 px-1 font-medium whitespace-nowrap">
                    {row.name}
                    <div className="text-[9px] text-gray-500 opacity-70">{row.payLevel}</div>
                 </td>
                 <td className="py-1 px-1 font-medium">
                    <span style={{ color: '#000' }}>{row.code}</span>
                 </td>
                 <td className="py-1 px-1 whitespace-nowrap">{row.startDate || '-'}</td>
                 <td className="py-1 px-1 whitespace-nowrap">{row.startTime ? `${row.startTime}-${row.endTime}` : '-'}</td>
                 <td className="py-1 px-1 text-right">{row.hours.toFixed(2)}</td>
                 <td className="py-1 px-1 text-right">{row.manual_rate_override ? `*${row.manual_rate_override}` : (row.rate ?? '-')}</td>
                 <td className="py-1 px-1 text-right font-bold">${pay.toFixed(2)}</td>
               </tr>
             )
           })}
         </tbody>
         <tfoot>
           <tr className="bg-gray-100 font-bold border-t-2 border-black text-sm">
              <td colSpan={4} className="py-2 px-1 text-right">Report Totals:</td>
              <td className="py-2 px-1 text-right">{processedData.reduce((acc, r) => acc + r.hours, 0).toFixed(2)}</td>
              <td></td>
              <td className="py-2 px-1 text-right">${processedData.reduce((acc, r) => {
                 const p = r.manual_rate_override !== undefined && r.manual_rate_override !== null
                   ? r.manual_rate_override * (rates.pay_codes.definitions.find(d => d.label === r.code)?.type === 'flat' ? 1 : r.hours)
                   : (r.total || 0);
                 return acc + p;
              }, 0).toFixed(2)}</td>
           </tr>
         </tfoot>
      </table>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-7xl h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-700">
        
        {/* TOP BAR - No Print */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-slate-900 text-white no-print shrink-0">
           <div className="flex items-center gap-3">
             <div className="bg-blue-600 p-2 rounded-lg"><Printer size={20} className="text-white" /></div>
             <div>
               <h2 className="text-lg font-bold">Print & Finalize</h2>
               <p className="text-xs text-slate-400">Configure report layout and sorting before printing</p>
             </div>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24}/></button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
           
           {/* SIDEBAR CONTROLS - No Print */}
           <div className="w-full md:w-80 bg-slate-50 border-r border-gray-200 flex flex-col gap-6 p-5 no-print overflow-y-auto">
              
              {/* 1. View Mode */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Report Layout</label>
                <div className="grid grid-cols-1 gap-2">
                   <button 
                     onClick={() => setViewMode('summary')}
                     className={`flex items-center gap-3 p-3 rounded-lg border text-sm font-medium transition-all ${viewMode === 'summary' ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'}`}
                   >
                     Summary by Employee
                   </button>
                   <button 
                     onClick={() => setViewMode('detail')}
                     className={`flex items-center gap-3 p-3 rounded-lg border text-sm font-medium transition-all ${viewMode === 'detail' ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'}`}
                   >
                     Full Detailed Audit
                   </button>
                   <button 
                     onClick={() => setViewMode('custom')}
                     className={`flex items-center gap-3 p-3 rounded-lg border text-sm font-medium transition-all ${viewMode === 'custom' ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'}`}
                   >
                     Custom Selection
                   </button>
                </div>
              </div>

              <hr className="border-gray-200" />

              {/* 2. Filters & Sorting */}
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <Filter size={14} /> Report Options
                </label>
                
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
                  <input 
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Search names..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>

                {/* Sort */}
                <div className="grid grid-cols-2 gap-2">
                   <div>
                     <label className="block text-[10px] text-gray-500 mb-1">Sort By</label>
                     <select 
                       className="w-full text-sm border border-gray-300 rounded-lg p-2 bg-white"
                       value={sortField}
                       onChange={(e) => setSortField(e.target.value as SortField)}
                     >
                       <option value="payLevel">Pay Level</option>
                       <option value="name">Name</option>
                       <option value="date">Date</option>
                     </select>
                   </div>
                   <div>
                     <label className="block text-[10px] text-gray-500 mb-1">Direction</label>
                     <button 
                       onClick={() => setSortAsc(!sortAsc)}
                       className="w-full text-sm border border-gray-300 rounded-lg p-2 bg-white flex items-center justify-between hover:bg-gray-50"
                     >
                       {sortAsc ? 'Asc' : 'Desc'}
                       <ArrowUpDown size={14} className="text-gray-400" />
                     </button>
                   </div>
                </div>

                {/* Multi-Select Level Filter - WITH USER-PAY-LEVEL */}
                <MultiSelectFilter 
                   title="Pay Level" 
                   // FIX: Added 'User-Pay-Level' and 'Hourly Only' explicitly
                   options={Array.from(new Set([...Object.keys(rates.pay_levels), 'User-Pay-Level', 'Hourly Only'])).sort()} 
                   selectedSet={selectedLevels}
                   setFunction={setSelectedLevels}
                   isOpen={showLevelFilter}
                   toggleOpen={() => { setShowLevelFilter(!showLevelFilter); setShowCodeFilter(false); }}
                />

                {/* Multi-Select Code Filter */}
                <MultiSelectFilter 
                   title="Pay Code" 
                   options={rates.pay_codes.definitions.map(d => d.label)} 
                   selectedSet={selectedCodes}
                   setFunction={setSelectedCodes}
                   isOpen={showCodeFilter}
                   toggleOpen={() => { setShowCodeFilter(!showCodeFilter); setShowLevelFilter(false); }}
                />
              </div>

              {/* 3. Custom Selector (Only visible in Custom Mode) */}
              {viewMode === 'custom' && (
                <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-lg shadow-inner overflow-hidden min-h-[200px]">
                   <div className="p-2 bg-gray-100 border-b border-gray-200 flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-500">Rows Matching Filter</span>
                      <div className="space-x-2">
                        <button onClick={() => {
                           const newIds = new Set(selectedIds);
                           processedData.forEach(r => newIds.add(r.id));
                           setSelectedIds(newIds);
                        }} className="text-[10px] text-blue-600 font-bold hover:underline">Select All</button>
                        <button onClick={() => setSelectedIds(new Set())} className="text-[10px] text-red-500 font-bold hover:underline">Clear</button>
                      </div>
                   </div>
                   <div className="flex-1 overflow-y-auto p-2 space-y-1">
                      {processedData.length === 0 ? (
                        <div className="p-4 text-center text-xs text-gray-400">No rows match your filters.</div>
                      ) : (
                        processedData.map(row => (
                          <button 
                            key={row.id}
                            onClick={() => {
                              const newSet = new Set(selectedIds);
                              if (newSet.has(row.id)) newSet.delete(row.id);
                              else newSet.add(row.id);
                              setSelectedIds(newSet);
                            }}
                            className={`w-full text-left p-2 rounded flex items-center gap-2 text-xs transition-colors ${selectedIds.has(row.id) ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`}
                          >
                             {selectedIds.has(row.id) ? <CheckSquare size={14}/> : <Square size={14} className="text-gray-300"/>}
                             <div className="truncate flex-1">
                               <span className="font-bold">{row.name}</span> <span className="text-gray-400">|</span> {row.code}
                             </div>
                          </button>
                        ))
                      )}
                   </div>
                </div>
              )}

              <div className="mt-auto">
                <button onClick={handlePrint} className="w-full btn-primary bg-slate-900 text-white py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-black transform active:scale-95 transition-all">
                  <Printer size={20} /> Print Final Report
                </button>
              </div>
           </div>

           {/* PREVIEW AREA */}
           <div className="flex-1 bg-white overflow-y-auto p-8 relative">
              <div id="print-area" className="max-w-[1100px] mx-auto min-h-[1000px] bg-white print:p-0 print:w-full">
                 
                 {/* Print Header */}
                 <div className="flex justify-between items-start border-b-4 border-slate-900 pb-4 mb-6">
                    <div className="flex items-center gap-4">
                       <div className="w-14 h-14 bg-red-700 text-white rounded-lg flex items-center justify-center text-2xl font-bold print:border print:border-red-700">G</div>
                       <div>
                          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Gem County Payroll</h1>
                          <div className="flex gap-4 text-xs font-medium text-slate-500 mt-1">
                             <span>Run Date: {new Date().toLocaleDateString()}</span>
                             <span>•</span>
                             <span>Status: Final Draft</span>
                          </div>
                       </div>
                    </div>
                    <div className="text-right">
                       <div className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Report Type</div>
                       <div className="bg-slate-100 px-3 py-1 rounded text-sm font-bold text-slate-700 border border-slate-200">
                         {viewMode === 'summary' ? 'Payroll Summary' : 'Detailed Audit Log'}
                       </div>
                    </div>
                 </div>

                 {/* Signatures Area */}
                 <div className="mb-8 grid grid-cols-2 gap-12 bg-slate-50 p-4 rounded-lg border border-slate-100 print:bg-white print:border-none print:p-0">
                    <div>
                       <div className="h-8 border-b border-slate-400 mb-1"></div>
                       <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400">
                          <span>Prepared By</span>
                          <span>Date</span>
                       </div>
                    </div>
                    <div>
                       <div className="h-8 border-b border-slate-400 mb-1"></div>
                       <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400">
                          <span>Authorized Signature</span>
                          <span>Date</span>
                       </div>
                    </div>
                 </div>

                 {/* Content */}
                 <div className="print-content">
                    {viewMode === 'summary' && <SummaryView />}
                    {(viewMode === 'detail' || viewMode === 'custom') && <DetailView />}
                 </div>

                 {/* Print Footer */}
                 <div className="mt-8 pt-8 border-t border-gray-100 text-center text-[10px] text-gray-400">
                    Generated by Gem Payroll System • Confidential Personnel Record
                 </div>
              </div>
           </div>
        </div>
      </div>
      
      {/* Force Print Colors */}
      <style>{`
        @media print {
          .print-color-exact {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}
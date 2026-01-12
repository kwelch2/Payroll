import { useEffect, useMemo, useState } from 'react';
import { PayrollRow, Employee, MasterRates } from '../types';
import { calculatePayRow, getRowColor } from '../services/payrollService';
import { 
  Edit2, Printer, RefreshCw, FileUp, 
  AlertTriangle, UploadCloud, ChevronRight, 
  Clock, DollarSign, Hash, ArrowUpDown, ArrowUp, ArrowDown,
  Search, ListFilter, BookOpenCheck 
} from 'lucide-react';
import RowModal from './RowModal';
import PrintWizard from './PrintWizard';
import { useFeedback } from './FeedbackProvider';

interface EditorProps {
  data: PayrollRow[];
  setData: (data: PayrollRow[]) => void;
  employees: Employee[];
  rates: MasterRates;
  onPostLeave: () => void;
  onSave: () => void;
}

type ViewMode = 'summary' | 'detail';
type FilterMode = 'all' | 'flagged' | 'standby';
type EmploymentFilter = 'all' | 'Full Time' | 'PRN';
type SortKey = keyof PayrollRow | 'flags';
type SortDirection = 'asc' | 'desc';

export default function Editor({ data, setData, employees, rates, onSave, onPostLeave }: EditorProps) {
  // ... rest of the code is correct, the key was adding onPostLeave above ...
  // [No other changes needed here unless you want the full file reprinted]
  
  // Just ensuring the button part is here:
  // ...
  const [editingRow, setEditingRow] = useState<PayrollRow | null>(null);
  const [showPrintWizard, setShowPrintWizard] = useState(false);
  const { notify, confirm } = useFeedback();
  
  // --- VIEW STATE ---
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;

  // --- FILTER STATES ---
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<EmploymentFilter>("all"); 
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterCode, setFilterCode] = useState("all");
  const [filterFlags, setFilterFlags] = useState<FilterMode>("all");

  // --- SORT STATES ---
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  // --- ACCORDION STATE ---
  const [collapsedEmp, setCollapsedEmp] = useState<Set<string>>(new Set());
  const [expandedCode, setExpandedCode] = useState<Set<string>>(new Set());

  // --- DERIVED LISTS ---
  const uniquePayCodes = useMemo(() => Array.from(new Set(data.map(r => r.code))).sort(), [data]);
  const uniquePayLevels = useMemo(() => Array.from(new Set(data.map(r => r.payLevel))).sort(), [data]);

  // --- HELPERS ---
  const getEffectiveTotal = (row: PayrollRow) => {
    if (row.manual_rate_override !== undefined && row.manual_rate_override !== null) {
       const def = rates.pay_codes.definitions.find(d => d.label === row.code);
       const isFlat = def?.type === 'flat';
       return row.manual_rate_override * (isFlat ? 1 : row.hours);
    }
    return row.total || 0;
  };

  // --- FILTERING & SORTING ENGINE ---
  const filteredData = useMemo(() => {
    let result = data.filter(row => {
      // Search
      if (searchQuery && !row.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      
      // Status
      if (filterStatus !== 'all') {
         if (filterStatus === 'PRN') {
            if (row.employmentType && row.employmentType !== 'PRN') return false;
         } else {
            if (row.employmentType !== filterStatus) return false;
         }
      }

      // Level & Code
      if (filterLevel !== 'all' && row.payLevel !== filterLevel) return false;
      if (filterCode !== 'all' && row.code !== filterCode) return false;

      // Flags
      if (filterFlags === 'flagged' && !row.alert) return false;
      if (filterFlags === 'standby') {
         const lower = row.code.toLowerCase();
         if (!lower.includes('standby') && !lower.includes('on call')) return false;
      }

      return true;
    });

    // Sorting
    return result.sort((a, b) => {
        let valA: any = a[sortKey as keyof PayrollRow];
        let valB: any = b[sortKey as keyof PayrollRow];

        if (sortKey === 'total') {
            valA = getEffectiveTotal(a);
            valB = getEffectiveTotal(b);
        }
        if (sortKey === 'flags') {
            valA = a.alert || '';
            valB = b.alert || '';
        }

        if (valA === null || valA === undefined) valA = '';
        if (valB === null || valB === undefined) valB = '';

        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });
  }, [data, searchQuery, filterStatus, filterLevel, filterCode, filterFlags, sortKey, sortDir, rates]);

  // --- STATS ---
  const stats = useMemo(() => {
    return filteredData.reduce((acc, row) => {
      const total = getEffectiveTotal(row);
      const isStandby = row.code.toLowerCase().includes('standby') || row.code.toLowerCase().includes('on call');
      
      return {
        grandTotal: acc.grandTotal + total,
        totalHours: acc.totalHours + row.hours,
        standbyQty: acc.standbyQty + (isStandby ? row.hours : 0),
        flagged: acc.flagged + (row.alert ? 1 : 0)
      };
    }, { grandTotal: 0, totalHours: 0, standbyQty: 0, flagged: 0 });
  }, [filteredData, rates]);

  // Reset pagination
  useEffect(() => { setCurrentPage(1); }, [filteredData.length]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const pagedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // Grouping
  const groupedData = useMemo(() => {
    const groups: Record<string, any> = {};
    filteredData.forEach(row => {
      if (!groups[row.name]) {
        groups[row.name] = { 
          name: row.name, 
          payLevel: row.payLevel, 
          totalPay: 0, totalHours: 0, codes: {} 
        };
      }
      const emp = groups[row.name];
      const pay = getEffectiveTotal(row);
      emp.totalPay += pay;
      emp.totalHours += row.hours;

      if (!emp.codes[row.code]) emp.codes[row.code] = { totalPay: 0, totalHours: 0, rows: [] };
      emp.codes[row.code].totalPay += pay;
      emp.codes[row.code].totalHours += row.hours;
      emp.codes[row.code].rows.push(row);
    });
    return Object.values(groups);
  }, [filteredData, rates]);

  // --- ACTIONS ---
  const handleSort = (key: SortKey) => {
      if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
      else { setSortKey(key); setSortDir('asc'); }
  };

  const handleRefresh = () => {
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
    notify('success', 'Recalculated all rates based on current settings.');
  };

  const handleUpdateRow = (updated: PayrollRow) => {
    setData(data.map(r => r.id === updated.id ? updated : r));
    setEditingRow(null);
  };

  const handleDeleteRow = async (id: string) => {
    if (await confirm({ title: 'Delete Line', message: 'Delete this line item?', confirmLabel: 'Delete' })) {
      setData(data.filter(r => r.id !== id));
      setEditingRow(null);
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
      for (let i = 0; i < Math.min(lines.length, 20); i++) {
        if (lines[i].includes("Last Name") && lines[i].includes("Start Date")) { headerIndex = i; break; }
      }
      if (headerIndex === -1) { notify('error', "Invalid CSV Header."); return; }

      for (let i = headerIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
        if (cols.length < 10) continue;
        const payCode = cols[9];
        const hours = parseFloat(cols[10]);
        if (payCode && !isNaN(hours)) {
           const row = calculatePayRow(`${cols[0]}, ${cols[1]}`, payCode, hours, employees, rates);
           row.startDate = cols[5]; row.startTime = cols[6]; row.endDate = cols[7]; row.endTime = cols[8];
           newRows.push(row);
        }
      }
      if (newRows.length > 0) { setData(newRows); notify('success', `Imported ${newRows.length} rows.`); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
      if (sortKey !== col) return <ArrowUpDown size={12} className="opacity-20 ml-1 inline" />;
      return sortDir === 'asc' ? <ArrowUp size={12} className="ml-1 text-blue-600 inline" /> : <ArrowDown size={12} className="ml-1 text-blue-600 inline" />;
  };

  return (
    <div className="space-y-4 pb-20">
      
      {/* 1. TOP STATS BAR */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <span className="text-xs font-bold text-gray-400 uppercase flex gap-2"><DollarSign size={14} /> Gross Pay</span>
          <span className="text-2xl font-bold text-gray-900 mt-1">${stats.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <span className="text-xs font-bold text-gray-400 uppercase flex gap-2"><Clock size={14} /> Total Hours</span>
          <span className="text-2xl font-bold text-gray-900 mt-1">{stats.totalHours.toFixed(2)}</span>
        </div>
        <button type="button" onClick={() => setFilterFlags(filterFlags === 'standby' ? 'all' : 'standby')} className={`p-4 rounded-xl shadow-sm border text-left ${filterFlags === 'standby' ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-100' : 'bg-white border-gray-200'}`}>
          <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${filterFlags === 'standby' ? 'text-blue-700' : 'text-gray-400'}`}><Hash size={14} /> Standby Qty</span>
          <span className={`text-2xl font-bold mt-1 ${filterFlags === 'standby' ? 'text-blue-800' : 'text-blue-600'}`}>{stats.standbyQty.toFixed(0)}</span>
        </button>
        <button type="button" onClick={() => setFilterFlags(filterFlags === 'flagged' ? 'all' : 'flagged')} className={`p-4 rounded-xl shadow-sm border text-left ${filterFlags === 'flagged' ? 'bg-red-50 border-red-400 ring-2 ring-red-100' : 'bg-white border-gray-200'}`}>
          <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${filterFlags === 'flagged' || stats.flagged > 0 ? 'text-red-600' : 'text-gray-400'}`}><AlertTriangle size={14} /> Flags / Errors</span>
          <span className={`text-2xl font-bold mt-1 ${filterFlags === 'flagged' || stats.flagged > 0 ? 'text-red-700' : 'text-gray-900'}`}>{stats.flagged}</span>
        </button>
      </div>

      {/* 2. ADVANCED TOOLBAR */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-4 sticky top-0 z-20">
        
        {/* Quick Picks: View & Search */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
           <div className="flex bg-gray-100 p-1 rounded-lg shrink-0">
              <button onClick={() => setViewMode('summary')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'summary' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Summary</button>
              <button onClick={() => setViewMode('detail')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'detail' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Detail</button>
              <button onClick={onPostLeave} className="btn-icon text-amber-600 hover:bg-amber-50" title="Post Leave to Bank">
                <BookOpenCheck size={18} />
              </button>
           </div>

           <div className="relative flex-1 w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Search Employee Name..." 
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
           </div>

           <div className="flex gap-2 shrink-0">
              <label className="btn-icon" title="Import CSV">
                <FileUp size={18} />
                <input type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
              </label>
              <button onClick={handleRefresh} className="btn-icon" title="Recalculate All"><RefreshCw size={18} /></button>
              <button onClick={onSave} className="btn-icon" title="Save to Drive"><UploadCloud size={18} /></button>
              <button onClick={() => setShowPrintWizard(true)} className="btn-primary flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold shadow-md"><Printer size={16} /> Finalize</button>
           </div>
        </div>

        {/* Bottom Row: Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
           <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase"><ListFilter size={14}/> Filters:</div>
           
           <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value as EmploymentFilter)}>
              <option value="all">Status: All</option>
              <option value="Full Time">Full Time</option>
              <option value="PRN">PRN</option>
           </select>

           <select className="filter-select" value={filterLevel} onChange={e => setFilterLevel(e.target.value)}>
              <option value="all">Rank: All</option>
              {uniquePayLevels.map(l => <option key={l} value={l}>{l}</option>)}
           </select>

           <select className="filter-select" value={filterCode} onChange={e => setFilterCode(e.target.value)}>
              <option value="all">Code: All</option>
              {uniquePayCodes.map(c => <option key={c} value={c}>{c}</option>)}
           </select>

           <select className="filter-select" value={filterFlags} onChange={e => setFilterFlags(e.target.value as FilterMode)}>
              <option value="all">Flags: Any</option>
              <option value="flagged">⚠️ Errors Only</option>
              <option value="standby">🕰️ Standby Only</option>
           </select>

           <div className="h-6 w-px bg-gray-300 mx-2"></div>

           <select className="filter-select bg-gray-50 border-dashed" value={sortKey} onChange={e => { setSortKey(e.target.value as SortKey); setSortDir('asc'); }}>
              <option value="name">Sort: Name</option>
              <option value="payLevel">Sort: Rank</option>
              <option value="employmentType">Sort: Status</option>
              <option value="hours">Sort: Hours</option>
              <option value="total">Sort: Total Pay</option>
           </select>
        </div>
      </div>

      {/* 3. DATA GRID */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden min-h-[500px]">
        
        {/* SUMMARY VIEW */}
        {viewMode === 'summary' && (
          <div className="divide-y divide-gray-100">
             {groupedData.map((emp) => {
               const isOpen = !collapsedEmp.has(emp.name);
               return (
                 <div key={emp.name} className="bg-white group">
                   <div className="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => {
                      const newSet = new Set(collapsedEmp);
                      if (newSet.has(emp.name)) newSet.delete(emp.name); else newSet.add(emp.name);
                      setCollapsedEmp(newSet);
                   }}>
                     <div className="flex items-center gap-3">
                       <div className={`p-1 rounded-full transition-transform ${isOpen ? 'rotate-90 bg-blue-100 text-blue-600' : 'text-gray-400'}`}><ChevronRight size={18} /></div>
                       <div>
                         <h3 className="font-bold text-gray-800 text-lg">{emp.name}</h3>
                         <div className="text-xs text-gray-500">{emp.payLevel}</div>
                       </div>
                     </div>
                     <div className="text-right">
                       <div className="font-bold text-gray-900">${emp.totalPay.toFixed(2)}</div>
                       <div className="text-xs text-gray-500">{emp.totalHours.toFixed(2)} hrs</div>
                     </div>
                   </div>

                   {isOpen && (
                     <div className="bg-gray-50 border-t border-gray-100">
                       {Object.entries(emp.codes).map(([code, stats]: [string, any]) => {
                         const codeId = `${emp.name}-${code}`;
                         const isExpanded = expandedCode.has(codeId);
                         const def = rates.pay_codes.definitions.find(d => d.label === code);
                         const baseColor = def ? def.color : '#e2e8f0';
                         
                         return (
                           <div key={code} className="border-b border-gray-100 last:border-0">
                             <div className="flex items-center justify-between py-3 px-4 pl-12 cursor-pointer transition-colors border-l-4" 
                                  style={{ backgroundColor: `${baseColor}25`, borderLeftColor: baseColor }} 
                                  onClick={() => {
                                    const newSet = new Set(expandedCode);
                                    if (newSet.has(codeId)) newSet.delete(codeId); else newSet.add(codeId);
                                    setExpandedCode(newSet);
                                  }}>
                               <div className="flex items-center gap-2">
                                  <div className={`transition-transform ${isExpanded ? 'rotate-90 text-gray-700' : 'text-gray-500'}`}><ChevronRight size={14} /></div>
                                  <span className="font-bold text-gray-800">{code}</span>
                                  <span className="text-xs text-gray-600 opacity-70 ml-2">
                                    {def?.type === 'flat' ? `(${stats.rows.length} qty)` : `(${stats.totalHours.toFixed(2)} hrs)`}
                                  </span>
                               </div>
                               <div className="text-right"><span className="font-mono font-bold text-gray-900">${stats.totalPay.toFixed(2)}</span></div>
                             </div>

                             {isExpanded && (
                               <div className="bg-white pl-16 pr-4 py-2 shadow-inner">
                                 <table className="w-full text-xs text-left">
                                   <thead>
                                     <tr className="text-gray-400 border-b border-gray-100">
                                       <th className="py-2 w-24">Date</th><th className="py-2 w-32">Time</th><th className="py-2 text-right">Hrs/Qty</th>
                                       <th className="py-2 text-right">Rate</th><th className="py-2 text-right">Total</th>
                                       <th className="py-2 text-center w-20">Flags</th><th className="py-2 text-right">Action</th>
                                     </tr>
                                   </thead>
                                   <tbody>
                                     {stats.rows.map((row: PayrollRow) => (
                                       <tr key={row.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                                         <td className="py-2 text-gray-600">{row.startDate || '-'}</td>
                                         <td className="py-2 text-gray-600 text-[10px]">{row.startTime ? `${row.startTime} - ${row.endTime}` : '-'}</td>
                                         <td className="py-2 text-right">{row.hours}</td>
                                         <td className="py-2 text-right text-gray-500">{row.manual_rate_override ? `*${row.manual_rate_override}` : row.rate}</td>
                                         <td className="py-2 text-right font-medium">${getEffectiveTotal(row).toFixed(2)}</td>
                                         <td className="py-2 text-center">
                                            {row.alert && <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${row.alertLevel === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>! {row.alert}</div>}
                                         </td>
                                         <td className="py-2 text-right"><button onClick={() => setEditingRow(row)} className="text-blue-600 hover:underline">Edit</button></td>
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

        {/* DETAIL VIEW */}
        {viewMode === 'detail' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider border-b border-gray-200">
                  <th className="p-4 font-semibold cursor-pointer hover:bg-gray-100" onClick={() => handleSort('name')}>Employee <SortIcon col="name"/></th>
                  <th className="p-4 font-semibold cursor-pointer hover:bg-gray-100" onClick={() => handleSort('code')}>Pay Code <SortIcon col="code"/></th>
                  <th className="p-4 font-semibold cursor-pointer hover:bg-gray-100" onClick={() => handleSort('startDate')}>Date <SortIcon col="startDate"/></th>
                  <th className="p-4 font-semibold">Time</th>
                  <th className="p-4 font-semibold text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('hours')}>Hrs/Qty <SortIcon col="hours"/></th>
                  <th className="p-4 font-semibold text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('rate')}>Rate <SortIcon col="rate"/></th>
                  <th className="p-4 font-semibold text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('total')}>Total <SortIcon col="total"/></th>
                  <th className="p-4 font-semibold text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSort('flags')}>Flags <SortIcon col="flags"/></th>
                  <th className="p-4 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr><td colSpan={9} className="p-12 text-center text-gray-400">No rows match your filters.</td></tr>
                ) : (
                  pagedData.map((row) => {
                    const baseColor = getRowColor(row.code, rates);
                    return (
                      <tr key={row.id} style={{ backgroundColor: `${baseColor}15` }} className="hover:brightness-95 transition-all border-b border-white">
                        <td className="p-3">
                          <div className="font-bold text-gray-800 text-sm">{row.name}</div>
                          <div className="text-xs text-gray-500">{row.payLevel} <span className="opacity-60">({row.employmentType || 'PRN'})</span></div>
                        </td>
                        <td className="p-3"><span className="font-medium text-gray-700 text-sm">{row.code}</span>{row.manual_note && <div className="text-[10px] text-blue-600">📝 {row.manual_note}</div>}</td>
                        <td className="p-3 text-sm text-gray-700">{row.startDate || '-'}</td>
                        <td className="p-3 text-xs text-gray-600 font-mono">{row.startTime ? `${row.startTime}-${row.endTime}` : '-'}</td>
                        <td className="p-3 text-right font-mono text-sm">{row.hours.toFixed(2)}</td>
                        <td className="p-3 text-right font-mono text-xs text-gray-500">{row.manual_rate_override ? <span className="bg-yellow-100 text-yellow-800 px-1 rounded font-bold">${row.manual_rate_override}</span> : (row.rate !== null ? `$${row.rate.toFixed(2)}` : '-')}</td>
                        <td className="p-3 text-right font-bold text-gray-800 font-mono text-sm">${getEffectiveTotal(row).toFixed(2)}</td>
                        <td className="p-3 text-center">
                           {row.alert && <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${row.alertLevel === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}><AlertTriangle size={10} /> {row.alert}</div>}
                        </td>
                        <td className="p-3 text-center">
                           <button onClick={() => setEditingRow(row)} className="p-1.5 hover:bg-white rounded text-gray-500 hover:text-blue-600 transition-colors"><Edit2 size={16} /></button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            
            {/* PAGINATION */}
            {filteredData.length > pageSize && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-sm bg-gray-50">
                <span className="text-gray-500">Page {currentPage} of {totalPages} • {filteredData.length} items</span>
                <div className="flex items-center gap-2">
                  <button className="btn-secondary" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</button>
                  <button className="btn-secondary" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</button>
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
          employees={employees} 
        />
      )}

      {showPrintWizard && <PrintWizard data={filteredData} onClose={() => setShowPrintWizard(false)} rates={rates} employees={employees} />}

      <style>{`
        .filter-select {
           padding: 0.35rem 2rem 0.35rem 0.75rem;
           border: 1px solid #e5e7eb;
           border-radius: 0.5rem;
           font-size: 0.875rem;
           font-weight: 500;
           color: #374151;
           outline: none;
           background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
           background-position: right 0.5rem center;
           background-repeat: no-repeat;
           background-size: 1.5em 1.5em;
           appearance: none;
           cursor: pointer;
        }
        .filter-select:focus { border-color: #3b82f6; ring: 2px solid #93c5fd; }
      `}</style>
    </div>
  );
}
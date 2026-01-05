import React, { useState, useMemo } from 'react';
import { PayrollRow, Employee, MasterRates } from '../types';
import { calculatePayRow, getRowColor } from '../services/payrollService';
import { saveJsonFile, ensureSystemFolders } from '../services/driveService';
import { Edit2, Trash2, Printer, Save, RefreshCw, Plus, FileUp, AlertTriangle, CloudUpload } from 'lucide-react';
import RowModal from './RowModal';
import PrintWizard from './PrintWizard';

interface EditorProps {
  data: PayrollRow[];
  setData: (data: PayrollRow[]) => void;
  employees: Employee[];
  rates: MasterRates;
}

export default function Editor({ data, setData, employees, rates }: EditorProps) {
  const [editingRow, setEditingRow] = useState<PayrollRow | null>(null);
  const [showPrintWizard, setShowPrintWizard] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Stats
  const stats = useMemo(() => {
    return data.reduce((acc, row) => {
      const total = row.manual_rate_override !== undefined && row.manual_rate_override !== null
        ? (row.manual_rate_override * (rates.pay_codes.definitions.find(d => d.label === row.code)?.type === 'flat' ? 1 : row.hours))
        : (row.total || 0);
      return {
        grandTotal: acc.grandTotal + total,
        totalHours: acc.totalHours + row.hours,
        flagged: acc.flagged + (row.alert ? 1 : 0)
      };
    }, { grandTotal: 0, totalHours: 0, flagged: 0 });
  }, [data, rates]);

  // Updated Parser for the specific "Payroll Report" format
  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n');
      const newRows: PayrollRow[] = [];
      
      // Find the header row index (starts with "Last Name")
      let headerIndex = -1;
      for (let i = 0; i < Math.min(lines.length, 10); i++) {
        if (lines[i].includes("Last Name") && lines[i].includes("First Name")) {
          headerIndex = i;
          break;
        }
      }

      if (headerIndex === -1) {
        alert("Could not find header row ('Last Name', 'First Name'). Check CSV format.");
        return;
      }

      // Process data rows
      for (let i = headerIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Rudimentary CSV split handling quotes: "Value","Value 2"
        // This regex splits by comma ONLY if it's not inside quotes
        // If that fails, fallback to simple split if strict format
        const cols = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');

        // Clean quotes from results
        const cleanCols = cols.map(c => c.replace(/^"|"$/g, '').trim());

        // We need at least 11 columns for the specific format provided
        // Index 0: Last Name
        // Index 1: First Name
        // Index 9: Pay Code
        // Index 10: Time Calc
        
        if (cleanCols.length < 10) continue;

        const lastName = cleanCols[0];
        const firstName = cleanCols[1];
        const payCode = cleanCols[9];
        const hours = parseFloat(cleanCols[10]);

        // Validate we have a Pay Code and Hours > 0
        if (payCode && !isNaN(hours) && hours > 0) {
           const fullName = `${lastName}, ${firstName}`;
           newRows.push(calculatePayRow(fullName, payCode, hours, employees, rates));
        }
      }
      
      if (newRows.length > 0) {
        setData(newRows);
        alert(`Successfully imported ${newRows.length} rows.`);
      } else {
        alert("No valid data rows found. Check column order.");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset
  };

  const handleUpdateRow = (updated: PayrollRow) => {
    setData(data.map(r => r.id === updated.id ? updated : r));
    setEditingRow(null);
  };

  const handleDeleteRow = (id: string) => {
    if(confirm('Are you sure you want to delete this line?')) {
      setData(data.filter(r => r.id !== id));
      setEditingRow(null);
    }
  };

  const handleRefreshDraft = () => {
    const refreshed = data.map(r => {
      const calc = calculatePayRow(r.name, r.code, r.hours, employees, rates);
      // Preserve overrides
      calc.manual_rate_override = r.manual_rate_override;
      calc.manual_note = r.manual_note;
      calc.id = r.id; // Keep ID
      return calc;
    });
    setData(refreshed);
    alert('Draft refreshed with latest rates/staff settings.');
  };

  const handleSaveToDrive = async () => {
    if (data.length === 0) return;
    try {
      setIsSaving(true);
      const folders = await ensureSystemFolders(); // This ensures we get the current IDs
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Payroll_Run_${dateStr}.json`;
      
      await saveJsonFile(filename, { meta: { date: dateStr, stats }, rows: data }, folders.yearFolderId);
      alert(`Saved to Drive: ${folders.yearFolderId}/${filename}`);
    } catch (err) {
      console.error(err);
      alert("Failed to save to Drive. Ensure you are connected in the Dashboard.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div>
           <h2 className="text-2xl font-bold text-gray-800">Current Payroll</h2>
           <p className="text-sm text-gray-500">
             {data.length} line items • Total: <span className="font-semibold text-green-700">${stats.grandTotal.toFixed(2)}</span>
           </p>
        </div>
        <div className="flex flex-wrap gap-2">
           <label className="btn-secondary flex items-center gap-2 cursor-pointer bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 text-gray-700 font-medium shadow-sm transition-all">
             <FileUp size={18} /> Import CSV
             <input type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
           </label>
           <button onClick={handleRefreshDraft} className="btn-secondary flex items-center gap-2 bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 text-gray-700 font-medium shadow-sm transition-all">
             <RefreshCw size={18} /> Refresh
           </button>
           
           <button onClick={handleSaveToDrive} disabled={isSaving} className="btn-secondary flex items-center gap-2 bg-white border border-green-200 text-green-700 px-4 py-2 rounded-lg hover:bg-green-50 font-medium shadow-sm transition-all">
             {isSaving ? <span className="animate-spin">⏳</span> : <CloudUpload size={18} />}
             Save Run
           </button>

           <button onClick={() => setShowPrintWizard(true)} className="btn-primary flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium shadow-sm transition-all">
             <Printer size={18} /> Finalize & Print
           </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm border-b border-gray-200">
                <th className="p-4 font-semibold">Employee / Pay Level</th>
                <th className="p-4 font-semibold">Pay Code</th>
                <th className="p-4 font-semibold text-right">Hours/Qty</th>
                <th className="p-4 font-semibold text-right">Rate</th>
                <th className="p-4 font-semibold text-right">Total</th>
                <th className="p-4 font-semibold text-center">Flags</th>
                <th className="p-4 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">No payroll data loaded. Import a CSV to start.</td>
                </tr>
              ) : (
                data.map((row) => {
                  const baseColor = getRowColor(row.code, rates);
                  const rowBg = `${baseColor}33`; // 20% opacity (hex alpha)
                  const borderColor = `${baseColor}88`; // darker border

                  const effectiveTotal = row.manual_rate_override !== undefined && row.manual_rate_override !== null
                     ? row.manual_rate_override * (rates.pay_codes.definitions.find(d => d.label === row.code)?.type === 'flat' ? 1 : row.hours)
                     : (row.total || 0);

                  return (
                    <tr 
                      key={row.id} 
                      style={{ backgroundColor: rowBg, borderLeft: `4px solid ${borderColor}` }}
                      className="hover:brightness-95 transition-all cursor-pointer group"
                      onClick={() => setEditingRow(row)}
                    >
                      <td className="p-3 border-b border-white/50">
                        <div className="font-bold text-gray-800">{row.name}</div>
                        <div className="text-xs text-gray-600 opacity-75">{row.payLevel}</div>
                        {row.manual_note && <div className="text-xs text-blue-600 italic mt-1">📝 {row.manual_note}</div>}
                      </td>
                      <td className="p-3 border-b border-white/50">
                        <span className="font-medium text-gray-800">{row.code}</span>
                      </td>
                      <td className="p-3 border-b border-white/50 text-right font-mono">{row.hours.toFixed(2)}</td>
                      <td className="p-3 border-b border-white/50 text-right font-mono text-gray-600">
                        {row.manual_rate_override ? (
                          <span className="bg-yellow-100 text-yellow-800 px-1 rounded font-bold">${row.manual_rate_override.toFixed(2)}</span>
                        ) : (
                          row.rate !== null ? `$${row.rate.toFixed(2)}` : '—'
                        )}
                      </td>
                      <td className="p-3 border-b border-white/50 text-right font-bold text-gray-800 font-mono">
                        ${effectiveTotal.toFixed(2)}
                      </td>
                      <td className="p-3 border-b border-white/50 text-center">
                         {row.alert && (
                           <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${row.alertLevel === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                             <AlertTriangle size={12} /> {row.alert}
                           </div>
                         )}
                      </td>
                      <td className="p-3 border-b border-white/50 text-center">
                         <button className="p-2 text-gray-500 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                           <Edit2 size={16} />
                         </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingRow && (
        <RowModal 
          row={editingRow} 
          onClose={() => setEditingRow(null)} 
          onSave={handleUpdateRow} 
          onDelete={handleDeleteRow}
          rates={rates}
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
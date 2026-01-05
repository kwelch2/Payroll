import React, { useState } from 'react';
import { PayrollRow, MasterRates } from '../types';
import { X, Trash2 } from 'lucide-react';

interface RowModalProps {
  row: PayrollRow;
  onClose: () => void;
  onSave: (row: PayrollRow) => void;
  onDelete: (id: string) => void;
  rates: MasterRates;
}

export default function RowModal({ row, onClose, onSave, onDelete, rates }: RowModalProps) {
  const [form, setForm] = useState<PayrollRow>({ ...row });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transform transition-all ring-1 ring-gray-900/5 flex flex-col max-h-[90vh]">
        {/* Header with Chic Gradient */}
        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white p-5 flex justify-between items-center shadow-md shrink-0">
          <div>
            <h3 className="font-bold text-lg tracking-tight">Edit Line Item</h3>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{row.id.slice(0, 8)}</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-300 hover:text-white"
          >
            <X size={20}/>
          </button>
        </div>
        
        <div className="p-6 space-y-5 bg-white overflow-y-auto">
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
            <label className="label">Employee</label>
            <div className="font-bold text-lg text-gray-800">{row.name}</div>
            <div className="text-xs text-gray-500 mt-1">{row.payLevel}</div>
          </div>
          
          <div>
            <label className="label">Pay Code</label>
            <div className="relative">
              <select 
                className="input-field appearance-none bg-white" 
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              >
                {rates.pay_codes.definitions.map(def => (
                  <option key={def.code} value={def.label}>{def.label}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Hours / Qty</label>
              <input 
                type="number" step="0.01" 
                className="input-field font-mono"
                value={form.hours}
                onChange={(e) => setForm({ ...form, hours: parseFloat(e.target.value) })}
              />
            </div>
            <div>
              <label className="label text-blue-600 flex items-center gap-1">
                Rate Override
                <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded">OPTIONAL</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-400 text-sm">$</span>
                <input 
                  type="number" step="0.01" 
                  className="input-field border-blue-200 bg-blue-50/50 pl-6 font-mono focus:bg-white transition-colors"
                  placeholder="Auto"
                  value={form.manual_rate_override || ''}
                  onChange={(e) => setForm({ ...form, manual_rate_override: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="label">Note / Audit Reason</label>
            <textarea 
              className="input-field min-h-[80px] resize-none" 
              placeholder="Why was this changed?"
              value={form.manual_note || ''}
              onChange={(e) => setForm({ ...form, manual_note: e.target.value })}
            />
          </div>
        </div>

        <div className="p-4 bg-gray-50 flex justify-between items-center border-t border-gray-100 shrink-0">
           <button onClick={() => onDelete(row.id)} className="text-red-600 hover:bg-red-50 hover:text-red-700 px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors text-sm">
             <Trash2 size={16} /> Delete Line
           </button>
           <div className="flex gap-3">
             <button onClick={onClose} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg text-sm transition-colors">Cancel</button>
             <button onClick={() => onSave(form)} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transform active:scale-95 transition-all text-sm">
               Save Changes
             </button>
           </div>
        </div>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { PayrollRow, MasterRates } from '../types';
import { X, Save, Trash2 } from 'lucide-react';

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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transform transition-all ring-1 ring-gray-900/5">
        <div className="bg-gray-900 text-white p-4 flex justify-between items-center">
          <h3 className="font-bold text-lg">Edit Line Item</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X size={20}/></button>
        </div>
        
        <div className="p-6 space-y-4 bg-white">
          <div>
            <label className="label">Employee</label>
            <div className="font-bold text-lg text-gray-800">{row.name}</div>
          </div>
          
          <div>
            <label className="label">Pay Code</label>
            <select 
              className="input-field" 
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            >
              {rates.pay_codes.definitions.map(def => (
                <option key={def.code} value={def.label}>{def.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Hours / Qty</label>
              <input 
                type="number" step="0.01" 
                className="input-field"
                value={form.hours}
                onChange={(e) => setForm({ ...form, hours: parseFloat(e.target.value) })}
              />
            </div>
            <div>
              <label className="label text-blue-600">Rate Override</label>
              <input 
                type="number" step="0.01" 
                className="input-field border-blue-200 bg-blue-50"
                placeholder="Auto"
                value={form.manual_rate_override || ''}
                onChange={(e) => setForm({ ...form, manual_rate_override: e.target.value ? parseFloat(e.target.value) : null })}
              />
            </div>
          </div>

          <div>
            <label className="label">Note / Audit Reason</label>
            <textarea 
              className="input-field h-20" 
              placeholder="Why was this changed?"
              value={form.manual_note || ''}
              onChange={(e) => setForm({ ...form, manual_note: e.target.value })}
            />
          </div>
        </div>

        <div className="p-4 bg-gray-50 flex justify-between items-center border-t border-gray-100">
           <button onClick={() => onDelete(row.id)} className="text-red-500 hover:bg-red-50 px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors">
             <Trash2 size={18} /> Delete
           </button>
           <div className="flex gap-2">
             <button onClick={onClose} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg">Cancel</button>
             <button onClick={() => onSave(form)} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transform active:scale-95 transition-all">
               Save
             </button>
           </div>
        </div>
      </div>
    </div>
  );
}
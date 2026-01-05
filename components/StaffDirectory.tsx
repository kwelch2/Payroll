import React, { useState } from 'react';
import { Employee, AppConfig, MasterRates } from '../types';
import { Plus, Search, Edit } from 'lucide-react';

interface StaffProps {
  employees: Employee[];
  setEmployees: (e: Employee[]) => void;
  config: AppConfig;
  rates: MasterRates;
}

export default function StaffDirectory({ employees, setEmployees, config, rates }: StaffProps) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtered = employees.filter(e => 
    e.personal.full_name.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_id.includes(search)
  );

  const handleSave = (emp: Employee) => {
    setEmployees(employees.map(e => e.id === emp.id ? emp : e));
    setEditingId(null);
  };

  const activeEmp = editingId ? employees.find(e => e.id === editingId) : null;

  return (
    <div className="flex h-full">
      {/* List Panel */}
      <div className="w-1/3 border-r border-gray-200 flex flex-col bg-gray-50">
        <div className="p-4 border-b border-gray-200 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={16} />
            <input 
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Search staff..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="w-full btn-primary bg-gray-800 text-white py-2 rounded-lg font-medium text-sm flex justify-center items-center gap-2">
            <Plus size={16} /> Add New Staff
          </button>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-2">
          {filtered.map(emp => (
            <div 
              key={emp.id}
              onClick={() => setEditingId(emp.id)}
              className={`p-3 rounded-lg cursor-pointer transition-all border ${editingId === emp.id ? 'bg-white border-blue-500 shadow-md' : 'bg-white border-transparent hover:border-gray-300'}`}
            >
              <div className="flex justify-between items-start">
                <div>
                   <div className="font-bold text-gray-800">{emp.personal.full_name}</div>
                   <div className="text-xs text-gray-500">{emp.classifications.pay_level}</div>
                </div>
                <div className={`text-xs px-2 py-1 rounded-full ${emp.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {emp.status}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Panel */}
      <div className="flex-1 bg-white p-6 overflow-auto">
        {activeEmp ? (
          <StaffEditorForm 
            employee={activeEmp} 
            config={config} 
            rates={rates}
            onSave={handleSave} 
            onCancel={() => setEditingId(null)} 
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <Edit size={48} className="mb-4 opacity-20" />
            <p>Select an employee to edit details</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface StaffEditorFormProps {
  employee: Employee;
  config: AppConfig;
  rates: MasterRates;
  onSave: (emp: Employee) => void;
  onCancel: () => void;
}

function StaffEditorForm({ employee, config, rates, onSave, onCancel }: StaffEditorFormProps) {
  const [form, setForm] = useState<Employee>({ ...employee });

  const handleChange = (section: 'personal' | 'classifications', field: string, value: any) => {
    setForm(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value }
    }));
  };

  const handleRootChange = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
         <h2 className="text-xl font-bold">Edit Profile</h2>
         <div className="space-x-2">
           <button onClick={onCancel} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
           <button onClick={() => onSave(form)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm">Save Changes</button>
         </div>
      </div>

      {/* Personal Info */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-gray-400 uppercase">Personal</h3>
        <div className="grid grid-cols-2 gap-4">
           <div>
             <label className="block text-sm font-medium text-gray-700">First Name</label>
             <input className="input-field" value={form.personal.first_name} onChange={e => handleChange('personal', 'first_name', e.target.value)} />
           </div>
           <div>
             <label className="block text-sm font-medium text-gray-700">Last Name</label>
             <input className="input-field" value={form.personal.last_name} onChange={e => handleChange('personal', 'last_name', e.target.value)} />
           </div>
        </div>
      </section>

      {/* Classification */}
      <section className="space-y-4 pt-4 border-t">
        <h3 className="text-sm font-bold text-gray-400 uppercase">Classification</h3>
        <div className="grid grid-cols-2 gap-4">
           <div>
             <label className="block text-sm font-medium text-gray-700">Pay Level</label>
             <select 
               className="input-field" 
               value={form.classifications.pay_level} 
               onChange={e => handleChange('classifications', 'pay_level', e.target.value)}
             >
               <option value="Hourly Only">Hourly Only</option>
               <option value="User-Pay-Level">User-Pay-Level</option>
               {Object.keys(rates.pay_levels).map(l => <option key={l} value={l}>{l}</option>)}
             </select>
           </div>
           <div>
             <label className="block text-sm font-medium text-gray-700">Officer Rank</label>
             <select className="input-field" value={form.classifications.officer_rank} onChange={e => handleChange('classifications', 'officer_rank', e.target.value)}>
               <option value="">(None)</option>
               {config.ranks.map((r: string) => <option key={r} value={r}>{r}</option>)}
             </select>
           </div>
        </div>
      </section>

      {/* PTO / Leave Bank */}
      <section className="space-y-4 pt-4 border-t bg-blue-50 p-4 rounded-lg">
        <h3 className="text-sm font-bold text-blue-800 uppercase">Leave Bank (PTO)</h3>
        <div className="grid grid-cols-2 gap-4">
           <div>
             <label className="block text-sm font-medium text-blue-900">PTO Group</label>
             <select 
                className="input-field border-blue-200"
                value={form.leave_bank?.group || ''}
                onChange={e => setForm(p => ({ ...p, leave_bank: { ...p.leave_bank, group: e.target.value } as any }))}
             >
               <option value="">(None)</option>
               {Object.keys(rates.pto_rules || {}).map(g => <option key={g} value={g}>{g}</option>)}
             </select>
           </div>
           <div>
             <label className="block text-sm font-medium text-blue-900">Current Balance (Hrs)</label>
             <input 
               type="number" 
               className="input-field border-blue-200" 
               value={form.leave_bank?.current_balance || 0}
               onChange={e => setForm(p => ({ ...p, leave_bank: { ...p.leave_bank, current_balance: parseFloat(e.target.value) } as any }))}
             />
           </div>
        </div>
      </section>
    </div>
  );
}
import { useState } from 'react';
import { Search, UserPlus, Edit2, Save, Trash2 } from 'lucide-react';
import { Employee } from '../types';

interface StaffDirectoryProps {
  employees: Employee[];
  setEmployees: (employees: Employee[]) => void;
}

export default function StaffDirectory({ employees, setEmployees }: StaffDirectoryProps) {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // --- CRUD OPERATIONS ---

  const handleAdd = () => {
    const newEmp: Employee = {
      id: `EMP-${Date.now()}`,
      personal: { first_name: "New", last_name: "Employee", full_name: "New Employee" },
      classifications: { pay_level: "FF-1", rank: "Firefighter" },
      status: "active",
      payroll_config: { use_user_pay_scale: false, custom_rates: {} }
    };
    setEmployees([newEmp, ...employees]);
    setEditingId(newEmp.id);
  };

  const handleSave = (id: string, field: string, value: any) => {
    setEmployees(employees.map(e => {
      if (e.id !== id) return e;

      // Deep update logic helper
      const updated = { ...e };
      if (field === 'first_name') {
        updated.personal.first_name = value;
        updated.personal.full_name = `${value} ${updated.personal.last_name}`;
      } else if (field === 'last_name') {
        updated.personal.last_name = value;
        updated.personal.full_name = `${updated.personal.first_name} ${value}`;
      } else if (field === 'rank') {
        updated.classifications.rank = value;
      } else if (field === 'pay_level') {
        updated.classifications.pay_level = value;
      }
      return updated;
    }));
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this employee?")) {
      setEmployees(employees.filter(e => e.id !== id));
    }
  };

  // --- RENDER ---

  const filtered = employees.filter(e => 
    e.personal.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="p-4 border-b border-gray-100 flex justify-between items-center">
         <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
              placeholder="Search personnel..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
         </div>
         <button onClick={handleAdd} className="btn-primary flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-bold">
            <UserPlus size={16} /> Add Employee
         </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4">
        <table className="w-full text-left border-collapse">
           <thead>
              <tr className="text-xs font-bold text-gray-400 uppercase border-b border-gray-200">
                 <th className="pb-3 pl-2">Name</th>
                 <th className="pb-3">Rank</th>
                 <th className="pb-3">Pay Level</th>
                 <th className="pb-3 text-right">Actions</th>
              </tr>
           </thead>
           <tbody>
              {filtered.map(emp => (
                 <tr key={emp.id} className="group border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    {/* Name Field */}
                    <td className="py-3 pl-2">
                       {editingId === emp.id ? (
                          <div className="flex gap-1">
                             <input 
                               className="border p-1 rounded w-24 text-sm" 
                               value={emp.personal.first_name} 
                               onChange={e => handleSave(emp.id, 'first_name', e.target.value)}
                             />
                             <input 
                               className="border p-1 rounded w-24 text-sm" 
                               value={emp.personal.last_name} 
                               onChange={e => handleSave(emp.id, 'last_name', e.target.value)}
                             />
                          </div>
                       ) : (
                          <span className="font-medium text-gray-800">{emp.personal.full_name}</span>
                       )}
                    </td>

                    {/* Rank Field */}
                    <td className="py-3">
                       {editingId === emp.id ? (
                          <input 
                             className="border p-1 rounded w-32 text-sm" 
                             value={emp.classifications.rank} 
                             onChange={e => handleSave(emp.id, 'rank', e.target.value)}
                          />
                       ) : (
                          <span className="text-sm text-gray-600">{emp.classifications.rank}</span>
                       )}
                    </td>

                    {/* Pay Level Field */}
                    <td className="py-3">
                       {editingId === emp.id ? (
                          <input 
                             className="border p-1 rounded w-20 text-sm" 
                             value={emp.classifications.pay_level} 
                             onChange={e => handleSave(emp.id, 'pay_level', e.target.value)}
                          />
                       ) : (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-bold">{emp.classifications.pay_level}</span>
                       )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 text-right">
                       <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setEditingId(editingId === emp.id ? null : emp.id)}
                            className={`p-1 rounded ${editingId === emp.id ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-600'}`}
                          >
                             {editingId === emp.id ? <Save size={14} /> : <Edit2 size={14} />}
                          </button>
                          <button 
                            onClick={() => handleDelete(emp.id)}
                            className="p-1 rounded bg-red-50 text-red-500 hover:bg-red-100"
                          >
                             <Trash2 size={14} />
                          </button>
                       </div>
                    </td>
                 </tr>
              ))}
           </tbody>
        </table>
      </div>
    </div>
  );
}
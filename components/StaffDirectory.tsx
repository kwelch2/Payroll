import { useState } from 'react';
import { Search, UserPlus, Edit2, Trash2, X, User } from 'lucide-react'; // Removed 'Save'
import { Employee } from '../types';

interface StaffDirectoryProps {
  employees: Employee[];
  setEmployees: (employees: Employee[]) => void;
}

export default function StaffDirectory({ employees, setEmployees }: StaffDirectoryProps) {
  const [search, setSearch] = useState("");
  // Removed old editingId state
  
  // New State for Full Edit Modal
  const [fullEditEmp, setFullEditEmp] = useState<Employee | null>(null);

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
    setFullEditEmp(newEmp); 
  };

  const handleSaveFull = (updated: Employee) => {
    updated.personal.full_name = `${updated.personal.first_name} ${updated.personal.last_name}`;
    setEmployees(employees.map(e => e.id === updated.id ? updated : e));
    setFullEditEmp(null);
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
      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
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
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
             <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase">
                <tr>
                   <th className="p-4">Name</th>
                   <th className="p-4">Rank / Status</th>
                   <th className="p-4">Level / Cert</th>
                   <th className="p-4 text-right">Actions</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-gray-100">
                {filtered.map(emp => (
                   <tr key={emp.id} className="hover:bg-blue-50/50 transition-colors group">
                      <td className="p-4">
                         <div className="font-bold text-gray-900">{emp.personal.full_name}</div>
                         <div className="text-xs text-gray-400">{emp.contact?.email || 'No email'}</div>
                      </td>
                      <td className="p-4">
                         <div className="text-sm font-medium text-gray-700">{emp.classifications.rank}</div>
                         <div className="text-xs text-gray-500 capitalize">{emp.classifications.fire_status || 'Active'}</div>
                      </td>
                      <td className="p-4">
                         <div className="flex flex-col gap-1">
                           <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-bold w-fit">{emp.classifications.pay_level}</span>
                           {emp.classifications.ems_cert && <span className="text-xs text-blue-600 font-medium">{emp.classifications.ems_cert}</span>}
                         </div>
                      </td>
                      <td className="p-4 text-right">
                         <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => setFullEditEmp(emp)}
                              className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
                            >
                               <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => handleDelete(emp.id)}
                              className="p-2 rounded-lg bg-white border border-gray-200 text-red-500 hover:bg-red-50 hover:border-red-200 transition-all shadow-sm"
                            >
                               <Trash2 size={16} />
                            </button>
                         </div>
                      </td>
                   </tr>
                ))}
             </tbody>
          </table>
        </div>
      </div>

      {/* FULL EDIT MODAL */}
      {fullEditEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <User size={20} className="text-blue-600" /> 
                Edit Employee Details
              </h3>
              <button onClick={() => setFullEditEmp(null)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Personal Section */}
              <section>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Personal Information</h4>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-xs font-medium text-gray-700 mb-1">First Name</label>
                     <input className="input-field w-full border rounded p-2" value={fullEditEmp.personal.first_name} 
                       onChange={e => setFullEditEmp({...fullEditEmp, personal: {...fullEditEmp.personal, first_name: e.target.value}})} />
                   </div>
                   <div>
                     <label className="block text-xs font-medium text-gray-700 mb-1">Last Name</label>
                     <input className="input-field w-full border rounded p-2" value={fullEditEmp.personal.last_name} 
                       onChange={e => setFullEditEmp({...fullEditEmp, personal: {...fullEditEmp.personal, last_name: e.target.value}})} />
                   </div>
                   <div>
                     <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                     <input className="input-field w-full border rounded p-2" value={fullEditEmp.contact?.email || ''} 
                       onChange={e => setFullEditEmp({...fullEditEmp, contact: {...(fullEditEmp.contact || { phone: '', carrier: '' }), email: e.target.value}})} />
                   </div>
                   <div>
                     <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                     <input className="input-field w-full border rounded p-2" value={fullEditEmp.contact?.phone || ''} 
                       onChange={e => setFullEditEmp({...fullEditEmp, contact: {...(fullEditEmp.contact || { email: '', carrier: '' }), phone: e.target.value}})} />
                   </div>
                </div>
              </section>

              <hr className="border-gray-100" />

              {/* Classification Section */}
              <section>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Department Classification</h4>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-xs font-medium text-gray-700 mb-1">Pay Level (e.g. FF-1)</label>
                     <input className="input-field w-full border rounded p-2" value={fullEditEmp.classifications.pay_level} 
                       onChange={e => setFullEditEmp({...fullEditEmp, classifications: {...fullEditEmp.classifications, pay_level: e.target.value}})} />
                   </div>
                   <div>
                     <label className="block text-xs font-medium text-gray-700 mb-1">Rank Title</label>
                     <input className="input-field w-full border rounded p-2" value={fullEditEmp.classifications.rank} 
                       onChange={e => setFullEditEmp({...fullEditEmp, classifications: {...fullEditEmp.classifications, rank: e.target.value}})} />
                   </div>
                   <div>
                     <label className="block text-xs font-medium text-gray-700 mb-1">EMS Certification</label>
                     <select className="input-field w-full border rounded p-2 bg-white" value={fullEditEmp.classifications.ems_cert || ''} 
                       onChange={e => setFullEditEmp({...fullEditEmp, classifications: {...fullEditEmp.classifications, ems_cert: e.target.value}})}>
                        <option value="">None</option>
                        <option value="EMR">EMR</option>
                        <option value="EMT">EMT</option>
                        <option value="AEMT">AEMT</option>
                        <option value="Paramedic">Paramedic</option>
                     </select>
                   </div>
                   <div>
                     <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                     <select className="input-field w-full border rounded p-2 bg-white" value={fullEditEmp.classifications.fire_status || 'active'} 
                       onChange={e => setFullEditEmp({...fullEditEmp, classifications: {...fullEditEmp.classifications, fire_status: e.target.value}})}>
                        <option value="active">Active</option>
                        <option value="probationary">Probationary</option>
                        <option value="reserve">Reserve</option>
                        <option value="inactive">Inactive</option>
                     </select>
                   </div>
                   <div>
                     <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                     <input type="date" className="input-field w-full border rounded p-2" value={fullEditEmp.classifications.start_date_fire || ''} 
                       onChange={e => setFullEditEmp({...fullEditEmp, classifications: {...fullEditEmp.classifications, start_date_fire: e.target.value}})} />
                   </div>
                </div>
              </section>

            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
               <button onClick={() => setFullEditEmp(null)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg">Cancel</button>
               <button onClick={() => handleSaveFull(fullEditEmp)} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
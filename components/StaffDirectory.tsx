import { useState } from 'react';
import { Search, UserPlus, Edit2, Trash2, X, User, MapPin, Calendar, Briefcase, DollarSign } from 'lucide-react';
import { Employee, MasterRates } from '../types';

interface StaffDirectoryProps {
  employees: Employee[];
  setEmployees: (employees: Employee[]) => void;
  rates: MasterRates;
}

export default function StaffDirectory({ employees, setEmployees, rates }: StaffDirectoryProps) {
  const [search, setSearch] = useState("");
  const [fullEditEmp, setFullEditEmp] = useState<Employee | null>(null);

  // --- CRUD OPERATIONS ---
  const handleAdd = () => {
    const newEmp: Employee = {
      id: `EMP-${Date.now()}`,
      employee_id: "",
      personal: { first_name: "New", last_name: "Employee", full_name: "New Employee" },
      classifications: { pay_level: Object.keys(rates.pay_levels)[0] || "FF-1", rank: "Firefighter" },
      status: "Active",
      payroll_config: { use_user_pay_scale: false, custom_rates: {} },
      address: { line1: "", line2: "", city: "", state: "", zip: "" },
      contact: { phone: "", email: "", carrier: "" }
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

  const filtered = employees.filter(e => 
    e.personal.full_name.toLowerCase().includes(search.toLowerCase())
  );

  // Helper to safely update nested state
  const updateEmp = (section: keyof Employee, field: string, value: any) => {
    if (!fullEditEmp) return;
    setFullEditEmp({
      ...fullEditEmp,
      [section]: {
        ...(fullEditEmp[section] as any),
        [field]: value
      }
    });
  };

  // Helper for Classification specifically
  const updateClass = (field: string, value: any) => updateEmp('classifications', field, value);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
         <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64" 
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
                   <th className="p-4">Name / ID</th>
                   <th className="p-4">Rank / Status</th>
                   <th className="p-4">Pay Level</th>
                   <th className="p-4 text-right">Actions</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-gray-100">
                {filtered.map(emp => (
                   <tr key={emp.id} className="hover:bg-blue-50/50 transition-colors group">
                      <td className="p-4">
                         <div className="font-bold text-gray-900">{emp.personal.full_name}</div>
                         <div className="text-xs text-gray-400 font-mono">ID: {emp.employee_id || '---'}</div>
                      </td>
                      <td className="p-4">
                         <div className="text-sm font-medium text-gray-700">{emp.classifications.rank}</div>
                         <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${emp.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                           {emp.status}
                         </span>
                      </td>
                      <td className="p-4">
                         <div className="flex flex-col gap-1 items-start">
                           <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded text-xs font-bold">
                             {emp.payroll_config?.use_user_pay_scale ? 'Custom Scale' : emp.classifications.pay_level}
                           </span>
                           {emp.classifications.ems_cert && <span className="text-xs text-gray-500">{emp.classifications.ems_cert}</span>}
                         </div>
                      </td>
                      <td className="p-4 text-right">
                         <div className="flex justify-end gap-2">
                            <button onClick={() => setFullEditEmp(emp)} className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm">
                               <Edit2 size={16} />
                            </button>
                            <button onClick={() => handleDelete(emp.id)} className="p-2 rounded-lg bg-white border border-gray-200 text-red-500 hover:bg-red-50 hover:border-red-200 transition-all shadow-sm">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-gray-200">
            {/* Header */}
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                 <div className="bg-blue-600 p-2 rounded-lg text-white"><User size={20} /></div>
                 <div>
                    <h3 className="text-lg font-bold text-gray-800">Edit Employee Profile</h3>
                    <p className="text-xs text-gray-500">Update personnel records and payroll settings</p>
                 </div>
              </div>
              <button onClick={() => setFullEditEmp(null)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-2 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              
              {/* 1. Identity & Contact */}
              <section>
                <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
                  <User size={16} className="text-blue-500" /> Identity & Contact
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                   <div className="col-span-1">
                     <label className="label">Employee ID</label>
                     <input className="input" value={fullEditEmp.employee_id || ''} 
                       onChange={e => setFullEditEmp({...fullEditEmp, employee_id: e.target.value})} />
                   </div>
                   <div className="col-span-1">
                     <label className="label">Status</label>
                     <select className="input" value={fullEditEmp.status} onChange={e => setFullEditEmp({...fullEditEmp, status: e.target.value})}>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Leave">On Leave</option>
                     </select>
                   </div>
                   <div className="col-span-2"></div> {/* Spacer */}

                   <div className="col-span-2">
                     <label className="label">First Name</label>
                     <input className="input" value={fullEditEmp.personal.first_name} onChange={e => updateEmp('personal', 'first_name', e.target.value)} />
                   </div>
                   <div className="col-span-2">
                     <label className="label">Last Name</label>
                     <input className="input" value={fullEditEmp.personal.last_name} onChange={e => updateEmp('personal', 'last_name', e.target.value)} />
                   </div>

                   <div className="col-span-2">
                     <label className="label">Email</label>
                     <input className="input" value={fullEditEmp.contact?.email || ''} onChange={e => updateEmp('contact', 'email', e.target.value)} />
                   </div>
                   <div className="col-span-1">
                     <label className="label">Phone</label>
                     <input className="input" value={fullEditEmp.contact?.phone || ''} onChange={e => updateEmp('contact', 'phone', e.target.value)} />
                   </div>
                   <div className="col-span-1">
                     <label className="label">Mobile Carrier</label>
                     <input className="input" value={fullEditEmp.contact?.carrier || ''} onChange={e => updateEmp('contact', 'carrier', e.target.value)} />
                   </div>
                </div>
              </section>

              {/* 2. Address */}
              <section>
                <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
                  <MapPin size={16} className="text-blue-500" /> Address
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                   <div className="col-span-6">
                     <label className="label">Street Address</label>
                     <input className="input" value={fullEditEmp.address?.line1 || ''} onChange={e => updateEmp('address', 'line1', e.target.value)} />
                   </div>
                   <div className="col-span-3">
                     <label className="label">City</label>
                     <input className="input" value={fullEditEmp.address?.city || ''} onChange={e => updateEmp('address', 'city', e.target.value)} />
                   </div>
                   <div className="col-span-2">
                     <label className="label">State</label>
                     <input className="input" value={fullEditEmp.address?.state || ''} onChange={e => updateEmp('address', 'state', e.target.value)} />
                   </div>
                   <div className="col-span-1">
                     <label className="label">Zip</label>
                     <input className="input" value={fullEditEmp.address?.zip || ''} onChange={e => updateEmp('address', 'zip', e.target.value)} />
                   </div>
                </div>
              </section>

              {/* 3. Classification & Dates */}
              <section>
                <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">
                  <Briefcase size={16} className="text-blue-500" /> Classification
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                   <div className="col-span-2">
                     <label className="label">Rank</label>
                     <input className="input" value={fullEditEmp.classifications.rank} onChange={e => updateClass('rank', e.target.value)} />
                   </div>
                   <div className="col-span-2">
                     <label className="label">Officer Rank</label>
                     <input className="input" value={fullEditEmp.classifications.officer_rank || ''} onChange={e => updateClass('officer_rank', e.target.value)} />
                   </div>
                   <div className="col-span-2">
                     <label className="label">Fire Status</label>
                     <input className="input" value={fullEditEmp.classifications.fire_status || ''} onChange={e => updateClass('fire_status', e.target.value)} />
                   </div>
                   <div className="col-span-2">
                     <label className="label">EMS Cert</label>
                     <select className="input" value={fullEditEmp.classifications.ems_cert || ''} onChange={e => updateClass('ems_cert', e.target.value)}>
                        <option value="">None</option>
                        <option value="EMR">EMR</option>
                        <option value="EMT">EMT</option>
                        <option value="AEMT">AEMT</option>
                        <option value="Paramedic">Paramedic</option>
                     </select>
                   </div>
                   
                   {/* DATES */}
                   <div className="col-span-2">
                     <label className="label flex items-center gap-1"><Calendar size={12}/> Fire Start Date</label>
                     <input type="date" className="input" value={fullEditEmp.classifications.start_date_fire || ''} onChange={e => updateClass('start_date_fire', e.target.value)} />
                   </div>
                   <div className="col-span-2">
                     <label className="label flex items-center gap-1"><Calendar size={12}/> EMS Start Date</label>
                     <input type="date" className="input" value={fullEditEmp.classifications.start_date_ems || ''} onChange={e => updateClass('start_date_ems', e.target.value)} />
                   </div>
                </div>
              </section>

              {/* 4. Payroll Configuration */}
              <section className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <h4 className="flex items-center gap-2 text-sm font-bold text-blue-900 border-b border-blue-200 pb-2 mb-4">
                  <DollarSign size={16} className="text-blue-600" /> Payroll Configuration
                </h4>
                
                <div className="flex items-center gap-3 mb-6">
                   <input 
                     type="checkbox" 
                     id="useUserScale"
                     className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                     checked={fullEditEmp.payroll_config?.use_user_pay_scale || false}
                     onChange={e => setFullEditEmp({
                       ...fullEditEmp, 
                       payroll_config: { ...fullEditEmp.payroll_config, use_user_pay_scale: e.target.checked }
                     })}
                   />
                   <label htmlFor="useUserScale" className="font-bold text-gray-800">Use Individual Pay Scale (Override Matrix)</label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className={fullEditEmp.payroll_config?.use_user_pay_scale ? 'opacity-50 pointer-events-none' : ''}>
                     <label className="label">Matrix Pay Level</label>
                     <select 
                       className="input" 
                       value={fullEditEmp.classifications.pay_level} 
                       onChange={e => updateClass('pay_level', e.target.value)}
                     >
                        {Object.keys(rates.pay_levels).map(lvl => (
                          <option key={lvl} value={lvl}>{lvl}</option>
                        ))}
                     </select>
                     <p className="text-[10px] text-gray-500 mt-1">Selects rate column from Master Matrix.</p>
                   </div>

                   {fullEditEmp.payroll_config?.use_user_pay_scale && (
                     <div className="col-span-2 mt-2">
                        <div className="p-3 bg-yellow-50 text-yellow-800 text-sm rounded border border-yellow-200">
                           <strong>Custom Rates Active:</strong> This employee will use custom rates defined in their profile instead of the global matrix. 
                           <br/><span className="text-xs">(Custom rate editor coming in v2)</span>
                        </div>
                     </div>
                   )}
                </div>
              </section>

            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
               <button onClick={() => setFullEditEmp(null)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-white hover:shadow-sm rounded-lg border border-transparent hover:border-gray-200 transition-all">Cancel</button>
               <button onClick={() => handleSaveFull(fullEditEmp)} className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transform active:scale-95 transition-all">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .label { @apply block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5; }
        .input { @apply w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all; }
      `}</style>
    </div>
  );
}
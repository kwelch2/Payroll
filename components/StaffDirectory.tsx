import React, { useState } from 'react';
import { Search, UserPlus, Edit2, Trash2, X, User, MapPin, Calendar, Briefcase, DollarSign } from 'lucide-react';
import { Employee, MasterRates, AppConfig } from '../types';
import { useFeedback } from './FeedbackProvider';

interface StaffDirectoryProps {
  employees: Employee[];
  setEmployees: (employees: Employee[]) => void;
  rates: MasterRates;
  config: AppConfig;
}

export default function StaffDirectory({ employees, setEmployees, rates, config }: StaffDirectoryProps) {
  const [search, setSearch] = useState("");
  const [fullEditEmp, setFullEditEmp] = useState<Employee | null>(null);
  const { confirm } = useFeedback();

  // --- ACTIONS ---
  const handleAdd = () => {
    const newEmp: Employee = {
      id: `EMP-${Date.now()}`,
      employee_id: "",
      personal: { first_name: "New", last_name: "Employee", full_name: "New Employee" },
      classifications: { 
        pay_level: Object.keys(rates.pay_levels)[0] || "Hourly Only", 
        rank: config.ranks[0] || "Firefighter",
        fire_status: config.fire_statuses[0] || "Active",
        ems_cert: "",
        start_date_fire: "",
        start_date_ems: ""
      },
      status: "Active",
      payroll_config: { use_user_pay_scale: false, custom_rates: {} },
      address: { line1: "", line2: "", city: "", state: "", zip: "" },
      contact: { phone: "", email: "", carrier: "" }
    };
    setEmployees([newEmp, ...employees]);
    setFullEditEmp(newEmp); 
  };

  const handleSaveFull = (updated: Employee) => {
    updated.personal.full_name = `${updated.personal.last_name}, ${updated.personal.first_name}`;
    setEmployees(employees.map(e => e.id === updated.id ? updated : e));
    setFullEditEmp(null);
  };

  const handleDelete = async (id: string) => {
    const approved = await confirm({
      title: 'Delete Employee',
      message: 'Delete this employee?',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel'
    });
    if (approved) {
      setEmployees(employees.filter(e => e.id !== id));
    }
  };

  const filtered = employees.filter(e => 
    e.personal.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (e.employee_id && e.employee_id.includes(search))
  );

  // Helper to safely update state
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

  const updateClass = (field: string, value: any) => updateEmp('classifications', field, value);

  // Helper for Custom Rates
  const updateCustomRate = (code: string, value: string) => {
    if (!fullEditEmp) return;
    const num = parseFloat(value);
    const newRates = { ...fullEditEmp.payroll_config.custom_rates };
    
    if (isNaN(num) || value === '') {
        delete newRates[code];
    } else {
        newRates[code] = num;
    }

    setFullEditEmp({
        ...fullEditEmp,
        payroll_config: {
            ...fullEditEmp.payroll_config,
            custom_rates: newRates
        }
    });
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Toolbar */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 sticky top-0 z-10">
         <div className="relative">
            <label htmlFor="staff-search" className="sr-only">Search personnel</label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              id="staff-search"
              className="pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64 shadow-sm" 
              placeholder="Search personnel..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
         </div>
         <button onClick={handleAdd} className="btn-primary flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-bold shadow-sm">
            <UserPlus size={16} /> Add Employee
         </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-100">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
             <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase border-b border-gray-200">
                <tr>
                   <th className="p-4">Name / ID</th>
                   <th className="p-4">Rank / Status</th>
                   <th className="p-4">Pay Level</th>
                   <th className="p-4 text-right">Actions</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-gray-100">
                {filtered.map(emp => (
                   <tr key={emp.id} className="hover:bg-blue-50 transition-colors group">
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
                           <span className={`px-2 py-0.5 border rounded text-xs font-bold ${emp.payroll_config?.use_user_pay_scale ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                             {emp.payroll_config?.use_user_pay_scale ? 'Custom Rates' : emp.classifications.pay_level}
                           </span>
                           {emp.classifications.ems_cert && <span className="text-xs text-gray-500">{emp.classifications.ems_cert}</span>}
                         </div>
                      </td>
                      <td className="p-4 text-right">
                         <div className="flex justify-end gap-2">
                            <button onClick={() => setFullEditEmp(emp)} className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm" aria-label={`Edit ${emp.personal.full_name}`}>
                               <Edit2 size={16} />
                            </button>
                            <button onClick={() => handleDelete(emp.id)} className="p-2 rounded-lg bg-white border border-gray-200 text-red-500 hover:bg-red-50 hover:border-red-200 transition-all shadow-sm" aria-label={`Delete ${emp.personal.full_name}`}>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                 <div className="bg-blue-600 p-2 rounded-lg text-white shadow-sm"><User size={20} /></div>
                 <div>
                    <h3 className="text-lg font-bold text-gray-900">Edit Employee Profile</h3>
                    <p className="text-xs text-gray-500">Update personnel records and payroll settings</p>
                 </div>
              </div>
              <button onClick={() => setFullEditEmp(null)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-2 rounded-full transition-colors" aria-label="Close employee editor">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-white">
              
              {/* 1. Identity & Contact */}
              <section>
                <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4 uppercase tracking-wider">
                  Identity & Contact
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                   <div className="col-span-1">
                     <label className="label">Employee ID</label>
                     <input className="input-std" value={fullEditEmp.employee_id || ''} 
                       onChange={e => setFullEditEmp({...fullEditEmp, employee_id: e.target.value})} />
                   </div>
                   <div className="col-span-1">
                     <label className="label">Status</label>
                     <select className="input-std" value={fullEditEmp.status} onChange={e => setFullEditEmp({...fullEditEmp, status: e.target.value})}>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Leave">On Leave</option>
                     </select>
                   </div>
                   <div className="col-span-2 hidden md:block"></div>

                   <div className="col-span-2">
                     <label className="label">First Name</label>
                     <input className="input-std" value={fullEditEmp.personal.first_name} onChange={e => updateEmp('personal', 'first_name', e.target.value)} />
                   </div>
                   <div className="col-span-2">
                     <label className="label">Last Name</label>
                     <input className="input-std" value={fullEditEmp.personal.last_name} onChange={e => updateEmp('personal', 'last_name', e.target.value)} />
                   </div>

                   <div className="col-span-2">
                     <label className="label">Email</label>
                     <input className="input-std" value={fullEditEmp.contact?.email || ''} onChange={e => updateEmp('contact', 'email', e.target.value)} />
                   </div>
                   <div className="col-span-1">
                     <label className="label">Phone</label>
                     <input className="input-std" value={fullEditEmp.contact?.phone || ''} onChange={e => updateEmp('contact', 'phone', e.target.value)} />
                   </div>
                   <div className="col-span-1">
                     <label className="label">Mobile Carrier</label>
                     <select className="input-std" value={fullEditEmp.contact?.carrier || ''} onChange={e => updateEmp('contact', 'carrier', e.target.value)}>
                        <option value="">Select Carrier</option>
                        {(config.carriers || []).map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                   </div>
                </div>
              </section>

              {/* 2. Address */}
              <section>
                <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4 uppercase tracking-wider">
                  Address
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
                   <div className="col-span-6">
                     <label className="label">Street Address</label>
                     <input className="input-std" value={fullEditEmp.address?.line1 || ''} onChange={e => updateEmp('address', 'line1', e.target.value)} />
                   </div>
                   <div className="col-span-3">
                     <label className="label">City</label>
                     <input className="input-std" value={fullEditEmp.address?.city || ''} onChange={e => updateEmp('address', 'city', e.target.value)} />
                   </div>
                   <div className="col-span-2">
                     <label className="label">State</label>
                     <input className="input-std" value={fullEditEmp.address?.state || ''} onChange={e => updateEmp('address', 'state', e.target.value)} />
                   </div>
                   <div className="col-span-1">
                     <label className="label">Zip</label>
                     <input className="input-std" value={fullEditEmp.address?.zip || ''} onChange={e => updateEmp('address', 'zip', e.target.value)} />
                   </div>
                </div>
              </section>

              {/* 3. Classification & Dates */}
              <section>
                <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4 uppercase tracking-wider">
                  Classification
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                   <div className="col-span-2">
                     <label className="label">Rank</label>
                     <select className="input-std" value={fullEditEmp.classifications.rank} onChange={e => updateClass('rank', e.target.value)}>
                        <option value="">Select Rank</option>
                        {(config.ranks || []).map(r => <option key={r} value={r}>{r}</option>)}
                     </select>
                   </div>
                   <div className="col-span-2">
                     <label className="label">Fire Status</label>
                     <select className="input-std" value={fullEditEmp.classifications.fire_status || ''} onChange={e => updateClass('fire_status', e.target.value)}>
                        <option value="">Select Status</option>
                        {(config.fire_statuses || []).map(s => <option key={s} value={s}>{s}</option>)}
                     </select>
                   </div>
                   <div className="col-span-2">
                     <label className="label">EMS Cert</label>
                     <select className="input-std" value={fullEditEmp.classifications.ems_cert || ''} onChange={e => updateClass('ems_cert', e.target.value)}>
                        <option value="">None</option>
                        {(config.ems_cert_levels || []).map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                   </div>
                   
                   {/* DATES */}
                   <div className="col-span-1">
                     <label className="label">Fire Start Date</label>
                     <input type="date" className="input-std" value={fullEditEmp.classifications.start_date_fire || ''} onChange={e => updateClass('start_date_fire', e.target.value)} />
                   </div>
                   <div className="col-span-1">
                     <label className="label">EMS Start Date</label>
                     <input type="date" className="input-std" value={fullEditEmp.classifications.start_date_ems || ''} onChange={e => updateClass('start_date_ems', e.target.value)} />
                   </div>
                </div>
              </section>

              {/* 4. Payroll Configuration */}
              <section className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-inner">
                <div className="flex justify-between items-center border-b border-slate-200 pb-4 mb-4">
                   <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800 uppercase tracking-wider">
                     <DollarSign size={16} className="text-green-600" /> Payroll Configuration
                   </h4>
                   
                   <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-sm font-bold text-gray-700">Override Matrix (Individual Pay Scale)</span>
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                        checked={fullEditEmp.payroll_config?.use_user_pay_scale || false}
                        onChange={e => setFullEditEmp({
                          ...fullEditEmp, 
                          payroll_config: { ...fullEditEmp.payroll_config, use_user_pay_scale: e.target.checked }
                        })}
                      />
                   </label>
                </div>

                {/* Standard Pay Level Select (Hidden if Override is active) */}
                {!fullEditEmp.payroll_config?.use_user_pay_scale && (
                   <div className="max-w-md">
                     <label className="label">Matrix Pay Level</label>
                     <select 
                       className="input-std" 
                       value={fullEditEmp.classifications.pay_level} 
                       onChange={e => updateClass('pay_level', e.target.value)}
                     >
                        {Object.keys(rates.pay_levels).map(lvl => (
                          <option key={lvl} value={lvl}>{lvl}</option>
                        ))}
                     </select>
                     <p className="text-xs text-gray-500 mt-2">Rates are pulled automatically from the Master Rate Matrix based on this level.</p>
                   </div>
                )}

                {/* Custom Rates Grid (Visible ONLY if Override is active) */}
                {fullEditEmp.payroll_config?.use_user_pay_scale && (
                   <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="p-4 bg-yellow-50 text-yellow-800 text-sm rounded-lg border border-yellow-200 mb-4 flex items-start gap-2">
                         <div className="font-bold">⚠️ Custom Rates Active:</div>
                         <div>Enter specific dollar amounts below. Any field left empty will fall back to $0.00.</div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                         {rates.pay_codes.definitions.map(code => {
                            const val = fullEditEmp.payroll_config.custom_rates[code.code];
                            return (
                              <div key={code.code} className="bg-white p-2 rounded border border-gray-200 shadow-sm">
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 truncate" title={code.label}>{code.label}</label>
                                <div className="relative">
                                   <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                                   <input 
                                     type="number" 
                                     step="0.01"
                                     className="w-full pl-5 pr-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none font-mono text-right"
                                     placeholder="0.00"
                                     value={val !== undefined ? val : ''}
                                     onChange={e => updateCustomRate(code.code, e.target.value)}
                                   />
                                </div>
                              </div>
                            );
                         })}
                      </div>
                   </div>
                )}
              </section>

            </div>

            {/* Footer */}
            <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
               <button onClick={() => setFullEditEmp(null)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-white hover:shadow-sm rounded-lg border border-transparent hover:border-gray-200 transition-all">Cancel</button>
               <button onClick={() => handleSaveFull(fullEditEmp)} className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transform active:scale-95 transition-all">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Styles for proper visibility */}
      <style>{`
        .label { display: block; font-size: 0.75rem; font-weight: 700; color: #4b5563; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem; }
        .input-std { 
           width: 100%; 
           border: 1px solid #d1d5db; 
           background-color: white;
           border-radius: 0.5rem; 
           padding: 0.5rem 0.75rem; 
           font-size: 0.875rem; 
           color: #111827; 
           outline: none; 
           transition: all 0.2s;
           box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        }
        .input-std:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2); }
      `}</style>
    </div>
  );
}

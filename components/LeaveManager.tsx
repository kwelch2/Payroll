import { useState } from 'react';
import { Employee, LeaveTransaction } from '../types';
import { calculateMonthlyAccrual, checkAnniversaryCap } from '../services/leaveService';
import { PlayCircle, ShieldCheck, Briefcase, Calendar, TrendingUp } from 'lucide-react';
import { useFeedback } from './FeedbackProvider';

interface LeaveManagerProps {
  employees: Employee[];
  setEmployees: (employees: Employee[]) => void;
}

export default function LeaveManager({ employees, setEmployees }: LeaveManagerProps) {
  const { notify, confirm } = useFeedback();
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  
  // Adjustment Form State
  const [adjType, setAdjType] = useState<'Add' | 'Subtract'>('Add');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjNote, setAdjNote] = useState('');

  const ftStaff = employees.filter(e => e.classifications.employment_type === 'Full Time');
  const selectedEmp = employees.find(e => e.id === selectedEmpId);

  // --- 1. RUN MONTHLY ACCRUALS ---
  const handleRunMonthly = async () => {
    if (!await confirm({ title: 'Run Monthly Accruals?', message: 'This will add Vacation & Personal hours to all active Full Time staff based on tenure. Proceed?', confirmLabel: 'Run Accruals' })) return;

    const updatedStaff = employees.map(emp => {
      if (emp.classifications.employment_type !== 'Full Time' || emp.classifications.pto_status === 'Frozen') return emp;

      const { vacation, personal, tier } = calculateMonthlyAccrual(emp);
      
      // Init bank safely to avoid NaN
      const currentVac = emp.leave_bank?.vacation_balance || 0;
      const currentPers = emp.leave_bank?.personal_balance || 0;
      const history = emp.leave_bank?.history || [];
      
      const newBank = {
        vacation_balance: currentVac + vacation,
        personal_balance: currentPers + personal,
        last_accrual_date: new Date().toISOString().split('T')[0],
        history: [
          {
            id: `ACC-${Date.now()}-${Math.random()}`,
            date: new Date().toISOString().split('T')[0],
            type: 'accrual' as const,
            amount_vacation: vacation,
            amount_personal: personal,
            description: `Monthly Accrual (${tier})`,
            balance_after: (currentVac + vacation) + (currentPers + personal)
          },
          ...history
        ]
      };
      return { ...emp, leave_bank: newBank };
    });

    setEmployees(updatedStaff);
    notify('success', `Accruals processed for ${ftStaff.length} employees.`);
  };

  // --- 2. MANUAL ADJUSTMENT ---
  const handleManualAdjust = () => {
    if (!selectedEmp || !adjAmount) return;
    
    // Safely init values
    const currentVac = selectedEmp.leave_bank?.vacation_balance || 0;
    const currentPers = selectedEmp.leave_bank?.personal_balance || 0;
    const history = selectedEmp.leave_bank?.history || [];

    const amount = parseFloat(adjAmount);
    if (isNaN(amount)) return;

    const finalAmount = adjType === 'Add' ? amount : -amount;

    let newVac = currentVac;
    let newPers = currentPers;

    if (finalAmount > 0) {
        newVac += finalAmount; 
    } else {
        let remaining = Math.abs(finalAmount);
        if (newPers >= remaining) {
            newPers -= remaining;
        } else {
            remaining -= newPers;
            newPers = 0;
            newVac -= remaining;
        }
    }

    const tx: LeaveTransaction = {
        id: `ADJ-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        type: 'adjustment',
        amount_vacation: finalAmount > 0 ? finalAmount : (newVac - currentVac),
        amount_personal: finalAmount > 0 ? 0 : (newPers - currentPers),
        description: `Manual: ${adjNote}`,
        balance_after: newVac + newPers
    };

    const updatedEmp = {
        ...selectedEmp,
        leave_bank: {
            vacation_balance: newVac,
            personal_balance: newPers,
            history: [tx, ...history]
        }
    };

    setEmployees(employees.map(e => e.id === selectedEmp.id ? updatedEmp : e));
    setShowAdjustModal(false);
    setAdjAmount('');
    setAdjNote('');
    notify('success', 'Balance adjusted.');
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 p-6 flex justify-between items-center shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Leave Management</h2>
          <p className="text-sm text-gray-500">Track Vacation & Personal leave for Full-Time staff</p>
        </div>
        <button onClick={handleRunMonthly} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 shadow-md transition-all font-bold">
           <PlayCircle size={18} /> Run Monthly Accruals
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Left: Staff List */}
        <div className="w-5/12 overflow-y-auto p-4 border-r border-gray-200 bg-white">
           <div className="space-y-3">
             {ftStaff.map(emp => {
                 // Safe Math for Display
                 const vac = emp.leave_bank?.vacation_balance || 0;
                 const pers = emp.leave_bank?.personal_balance || 0;
                 const total = vac + pers;
                 const shift = emp.classifications.shift_schedule || '12-Hour';
                 
                 // Calc Stats
                 const stats = calculateMonthlyAccrual(emp);

                 return (
                   <div key={emp.id} onClick={() => setSelectedEmpId(emp.id)} className={`p-4 rounded-xl border cursor-pointer hover:shadow-md transition-all ${selectedEmpId === emp.id ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 bg-white'}`}>
                      <div className="flex justify-between items-start mb-3">
                         <div>
                           <h3 className="font-bold text-gray-900 text-lg">{emp.personal.full_name}</h3>
                           <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                              <span className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{shift} Shift</span>
                              <span>•</span>
                              <span className={stats.yearsOfService > 0 ? 'text-green-600 font-bold' : 'text-gray-400'}>
                                {stats.yearsOfService} Years Svc
                              </span>
                           </div>
                         </div>
                         <div className="text-right">
                            <span className="block text-2xl font-black text-blue-600">{total.toFixed(2)}</span>
                            <span className="text-[10px] uppercase font-bold text-gray-400">Current Balance</span>
                         </div>
                      </div>

                      {/* STATS BAR - ADDED THIS */}
                      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100">
                          <div className="text-center">
                             <div className="text-[10px] text-gray-400 font-bold uppercase flex items-center justify-center gap-1"><Briefcase size={10}/> Yearly Allow</div>
                             <div className="font-bold text-gray-700 text-xs">{stats.yearlyAllowance.toFixed(0)} hrs</div>
                          </div>
                          <div className="text-center border-l border-gray-100">
                             <div className="text-[10px] text-gray-400 font-bold uppercase flex items-center justify-center gap-1"><TrendingUp size={10}/> Monthly</div>
                             <div className="font-bold text-green-600 text-xs">+{stats.totalMonthly.toFixed(2)} hrs</div>
                          </div>
                          <div className="text-center border-l border-gray-100">
                             <div className="text-[10px] text-gray-400 font-bold uppercase flex items-center justify-center gap-1"><Calendar size={10}/> Start Date</div>
                             <div className="font-medium text-gray-600 text-xs">{emp.classifications.ft_start_date || 'N/A'}</div>
                          </div>
                      </div>
                   </div>
                 );
             })}
           </div>
        </div>

        {/* Right: The Auditor Page */}
        <div className="w-7/12 bg-gray-50 flex flex-col">
           {selectedEmp ? (
             <div className="flex-1 flex flex-col">
               <div className="p-6 border-b border-gray-200 bg-white flex justify-between items-center shadow-sm z-10">
                  <div>
                     <h3 className="text-lg font-bold text-gray-900">Audit Log: {selectedEmp.personal.full_name}</h3>
                     <p className="text-xs text-gray-500">Official record of Accruals and Usage</p>
                  </div>
                  <div className="flex gap-2">
                     <button onClick={() => {
                         const updated = checkAnniversaryCap(selectedEmp);
                         setEmployees(employees.map(e => e.id === selectedEmp.id ? updated : e));
                         notify('success', 'Cap check complete');
                     }} className="btn-secondary text-xs">Run Annual Cap Check</button>
                     <button onClick={() => setShowAdjustModal(true)} className="btn-primary bg-slate-800 text-white text-xs shadow-sm">Adjust Balance</button>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto p-6">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                      <table className="w-full text-left text-sm">
                         <thead className="bg-gray-100 text-xs uppercase font-bold text-gray-500 sticky top-0">
                            <tr>
                               <th className="p-4 border-b">Date</th>
                               <th className="p-4 border-b">Type</th>
                               <th className="p-4 border-b">Description</th>
                               <th className="p-4 border-b text-right">Change</th>
                               <th className="p-4 border-b text-right bg-gray-50">Running Bal</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-100">
                            {(selectedEmp.leave_bank?.history || []).map((tx: any) => {
                               const change = tx.amount_vacation + tx.amount_personal;
                               return (
                                   <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                                      <td className="p-4 text-gray-600 whitespace-nowrap">{tx.date}</td>
                                      <td className="p-4"><span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${tx.type === 'accrual' ? 'bg-green-100 text-green-700' : tx.type === 'usage' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{tx.type}</span></td>
                                      <td className="p-4 text-gray-900 font-medium">{tx.description}</td>
                                      <td className={`p-4 text-right font-mono font-bold ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                         {change > 0 ? '+' : ''}{change.toFixed(2)}
                                      </td>
                                      <td className="p-4 text-right font-mono font-bold text-gray-900 bg-gray-50 border-l border-gray-100">
                                         {tx.balance_after.toFixed(2)}
                                      </td>
                                   </tr>
                               );
                            })}
                            {(!selectedEmp.leave_bank?.history || selectedEmp.leave_bank.history.length === 0) && (
                                <tr><td colSpan={5} className="p-12 text-center text-gray-400">No transaction history found.</td></tr>
                            )}
                         </tbody>
                      </table>
                  </div>
               </div>
             </div>
           ) : (
             <div className="flex-1 flex items-center justify-center text-gray-400 flex-col">
                <ShieldCheck size={64} className="mb-6 opacity-20"/>
                <p className="font-medium text-lg">Select an employee</p>
                <p className="text-sm opacity-75">View official leave ledger and audit history</p>
             </div>
           )}
        </div>
      </div>

      {/* Manual Adjustment Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md animate-in fade-in zoom-in-95">
              <h3 className="text-lg font-bold mb-4 text-gray-900">Manual Balance Adjustment</h3>
              
              <div className="space-y-4">
                 <div>
                    <label className="label">Action</label>
                    <div className="flex gap-2">
                       <button onClick={() => setAdjType('Add')} className={`flex-1 py-2 rounded-lg border font-bold transition-all ${adjType === 'Add' ? 'bg-green-50 border-green-500 text-green-700 shadow-inner' : 'border-gray-200 hover:bg-gray-50'}`}>Add (+)</button>
                       <button onClick={() => setAdjType('Subtract')} className={`flex-1 py-2 rounded-lg border font-bold transition-all ${adjType === 'Subtract' ? 'bg-red-50 border-red-500 text-red-700 shadow-inner' : 'border-gray-200 hover:bg-gray-50'}`}>Subtract (-)</button>
                    </div>
                 </div>
                 <div>
                    <label className="label">Hours</label>
                    <input type="number" className="input-std font-mono text-lg" value={adjAmount} onChange={e => setAdjAmount(e.target.value)} placeholder="0.00" autoFocus />
                 </div>
                 <div>
                    <label className="label">Reason / Audit Note</label>
                    <input className="input-std" value={adjNote} onChange={e => setAdjNote(e.target.value)} placeholder="e.g. Initial Setup, Correction" />
                 </div>
              </div>

              <div className="flex justify-end gap-2 mt-8 border-t border-gray-100 pt-4">
                 <button onClick={() => setShowAdjustModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
                 <button onClick={handleManualAdjust} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-sm">Save Adjustment</button>
              </div>
           </div>
        </div>
      )}
      <style>{`.label { display: block; font-size: 0.75rem; font-weight: 700; color: #4b5563; text-transform: uppercase; margin-bottom: 0.25rem; } .input-std { width: 100%; border: 1px solid #d1d5db; border-radius: 0.5rem; padding: 0.5rem 0.75rem; outline: none; transition: all 0.2s; } .input-std:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }`}</style>
    </div>
  );
}
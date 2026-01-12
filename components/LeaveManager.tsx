import { useState } from 'react';
import { Employee, LeaveTransaction } from '../types';
import { calculateMonthlyAccrual, checkAnniversaryCap } from '../services/leaveService';
import { PlayCircle, ShieldCheck } from 'lucide-react';
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
      const bank = emp.leave_bank || { vacation_balance: 0, personal_balance: 0, history: [] };
      
      const newBank = {
        ...bank,
        vacation_balance: bank.vacation_balance + vacation,
        personal_balance: bank.personal_balance + personal,
        last_accrual_date: new Date().toISOString().split('T')[0],
        history: [
          {
            id: `ACC-${Date.now()}-${Math.random()}`,
            date: new Date().toISOString().split('T')[0],
            type: 'accrual',
            amount_vacation: vacation,
            amount_personal: personal,
            description: `Monthly Accrual (${tier})`,
            balance_after: (bank.vacation_balance + vacation) + (bank.personal_balance + personal)
          },
          ...bank.history
        ]
      };
      return { ...emp, leave_bank: newBank as any };
    });

    setEmployees(updatedStaff);
    notify('success', `Accruals processed for ${ftStaff.length} employees.`);
  };

  // --- 2. MANUAL ADJUSTMENT (For Mid-Year Start) ---
  const handleManualAdjust = () => {
    if (!selectedEmp || !adjAmount) return;
    
    const bank = selectedEmp.leave_bank || { vacation_balance: 0, personal_balance: 0, history: [] };
    const amount = parseFloat(adjAmount);
    const finalAmount = adjType === 'Add' ? amount : -amount;

    let newVac = bank.vacation_balance;
    let newPers = bank.personal_balance;

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
        amount_vacation: finalAmount > 0 ? finalAmount : (newVac - bank.vacation_balance),
        amount_personal: finalAmount > 0 ? 0 : (newPers - bank.personal_balance),
        description: `Manual: ${adjNote}`,
        balance_after: newVac + newPers
    };

    const updatedEmp = {
        ...selectedEmp,
        leave_bank: {
            vacation_balance: newVac,
            personal_balance: newPers,
            history: [tx, ...bank.history]
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
        <div className="w-1/3 overflow-y-auto p-4 border-r border-gray-200 bg-white">
           {ftStaff.map(emp => {
               const bank = emp.leave_bank || { vacation_balance: 0, personal_balance: 0 };
               const total = bank.vacation_balance + bank.personal_balance;
               return (
                 <div key={emp.id} onClick={() => setSelectedEmpId(emp.id)} className={`p-4 mb-3 rounded-xl border cursor-pointer hover:shadow-md transition-all ${selectedEmpId === emp.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                    <div className="flex justify-between items-center">
                       <div>
                         <h3 className="font-bold text-gray-900">{emp.personal.full_name}</h3>
                         <span className="text-xs text-gray-500">{emp.classifications.shift_schedule || '12-Hour'} Shift</span>
                       </div>
                       <div className="text-right">
                          <span className="block text-xl font-bold text-blue-600">{total.toFixed(2)}</span>
                          <span className="text-[10px] uppercase font-bold text-gray-400">Total Hours</span>
                       </div>
                    </div>
                 </div>
               );
           })}
        </div>

        {/* Right: The Auditor Page */}
        <div className="w-2/3 bg-gray-50 flex flex-col">
           {selectedEmp ? (
             <div className="flex-1 flex flex-col">
               <div className="p-6 border-b border-gray-200 bg-white flex justify-between items-center">
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
                     <button onClick={() => setShowAdjustModal(true)} className="btn-primary bg-slate-800 text-white text-xs">Adjust Balance</button>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto p-6">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                      <table className="w-full text-left text-sm">
                         <thead className="bg-gray-100 text-xs uppercase font-bold text-gray-500">
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
                                   <tr key={tx.id} className="hover:bg-gray-50">
                                      <td className="p-4 text-gray-600 whitespace-nowrap">{tx.date}</td>
                                      <td className="p-4"><span className="px-2 py-1 rounded text-[10px] font-bold bg-gray-100 text-gray-600 uppercase">{tx.type}</span></td>
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
                         </tbody>
                      </table>
                  </div>
               </div>
             </div>
           ) : (
             <div className="flex-1 flex items-center justify-center text-gray-400 flex-col">
                <ShieldCheck size={48} className="mb-4 opacity-20"/>
                <p>Select an employee to view their official leave ledger</p>
             </div>
           )}
        </div>
      </div>

      {/* Manual Adjustment Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
              <h3 className="text-lg font-bold mb-4">Manual Balance Adjustment</h3>
              
              <div className="space-y-4">
                 <div>
                    <label className="label">Action</label>
                    <div className="flex gap-2">
                       <button onClick={() => setAdjType('Add')} className={`flex-1 py-2 rounded border font-bold ${adjType === 'Add' ? 'bg-green-50 border-green-500 text-green-700' : 'border-gray-200'}`}>Add (+)</button>
                       <button onClick={() => setAdjType('Subtract')} className={`flex-1 py-2 rounded border font-bold ${adjType === 'Subtract' ? 'bg-red-50 border-red-500 text-red-700' : 'border-gray-200'}`}>Subtract (-)</button>
                    </div>
                 </div>
                 <div>
                    <label className="label">Hours</label>
                    <input type="number" className="input-std" value={adjAmount} onChange={e => setAdjAmount(e.target.value)} placeholder="0.00" autoFocus />
                 </div>
                 <div>
                    <label className="label">Reason / Audit Note</label>
                    <input className="input-std" value={adjNote} onChange={e => setAdjNote(e.target.value)} placeholder="e.g. Initial Setup, Correction" />
                 </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                 <button onClick={() => setShowAdjustModal(false)} className="btn-secondary">Cancel</button>
                 <button onClick={handleManualAdjust} className="btn-primary bg-blue-600 text-white">Save Adjustment</button>
              </div>
           </div>
        </div>
      )}
      <style>{`.label { display: block; font-size: 0.75rem; font-weight: 700; color: #4b5563; text-transform: uppercase; margin-bottom: 0.25rem; } .input-std { width: 100%; border: 1px solid #d1d5db; border-radius: 0.5rem; padding: 0.5rem; outline: none; }`}</style>
    </div>
  );
}
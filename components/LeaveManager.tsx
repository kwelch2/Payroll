import React, { useState } from 'react';
import { Employee } from '../types';
import { calculateMonthlyAccrual, checkAnniversaryCap, processLeaveUsage } from '../services/leaveService';
import { Calendar, Clock, AlertTriangle, History, PlayCircle, X } from 'lucide-react';
import { useFeedback } from './FeedbackProvider';

interface LeaveManagerProps {
  employees: Employee[];
  setEmployees: (employees: Employee[]) => void;
}

export default function LeaveManager({ employees, setEmployees }: LeaveManagerProps) {
  const { notify, confirm } = useFeedback();
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);

  // Filter only Full Time staff
  const ftStaff = employees.filter(e => e.classifications.employment_type === 'Full Time');

  const selectedEmp = employees.find(e => e.id === selectedEmpId);

  // --- BULK ACTION: Run Monthly Accruals ---
  const handleRunMonthly = async () => {
    if (!await confirm({ title: 'Run Monthly Accruals?', message: 'This will add Vacation & Personal hours to all active Full Time staff based on their tenure. Continue?', confirmLabel: 'Run Accruals' })) return;

    const updatedStaff = employees.map(emp => {
      if (emp.classifications.employment_type !== 'Full Time' || emp.classifications.pto_status === 'Frozen') return emp;

      const { vacation, personal, tier } = calculateMonthlyAccrual(emp);
      
      // Init bank if missing
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

  // --- SINGLE ACTION: Run Audit/Cap Check ---
  const handleRunAudit = (emp: Employee) => {
    const updated = checkAnniversaryCap(emp);
    setEmployees(employees.map(e => e.id === emp.id ? updated : e));
    notify('success', 'Anniversary Cap check complete.');
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      
      {/* Header */}
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
        
        {/* Staff List */}
        <div className="w-1/2 overflow-y-auto p-6 border-r border-gray-200">
           <div className="space-y-4">
             {ftStaff.map(emp => {
               const bank = emp.leave_bank || { vacation_balance: 0, personal_balance: 0 };
               const total = bank.vacation_balance + bank.personal_balance;
               const shift = emp.classifications.shift_schedule || '12-Hour';
               
               return (
                 <div key={emp.id} onClick={() => setSelectedEmpId(emp.id)} className={`bg-white p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md ${selectedEmpId === emp.id ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200'}`}>
                    <div className="flex justify-between items-start mb-3">
                       <div>
                         <h3 className="font-bold text-gray-900">{emp.personal.full_name}</h3>
                         <div className="text-xs text-gray-500 mt-0.5 flex gap-2">
                            <span>{shift}</span>
                            <span>•</span>
                            <span>Start: {emp.classifications.ft_start_date || 'N/A'}</span>
                         </div>
                       </div>
                       <div className="text-right">
                          <span className="block text-2xl font-bold text-blue-600">{total.toFixed(2)}</span>
                          <span className="text-[10px] uppercase font-bold text-gray-400">Total Hours</span>
                       </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                       <div className="bg-gray-50 p-2 rounded border border-gray-100">
                          <span className="block text-gray-400 font-bold uppercase text-[9px]">Vacation</span>
                          <span className="font-mono font-medium">{bank.vacation_balance.toFixed(2)}</span>
                       </div>
                       <div className="bg-gray-50 p-2 rounded border border-gray-100">
                          <span className="block text-gray-400 font-bold uppercase text-[9px]">Personal</span>
                          <span className="font-mono font-medium">{bank.personal_balance.toFixed(2)}</span>
                       </div>
                    </div>
                 </div>
               );
             })}
           </div>
        </div>

        {/* Detailed View / Audit Log */}
        <div className="w-1/2 bg-white flex flex-col">
           {selectedEmp ? (
             <>
               <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                  <div className="flex justify-between items-center">
                     <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                        <History size={18} className="text-blue-500"/> Audit Log: {selectedEmp.personal.last_name}
                     </h3>
                     <button onClick={() => handleRunAudit(selectedEmp)} className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded border border-amber-200 hover:bg-amber-100 transition-colors">
                        Run Cap Audit
                     </button>
                  </div>
               </div>
               <div className="flex-1 overflow-y-auto p-0">
                  <table className="w-full text-left text-sm">
                     <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-bold sticky top-0">
                        <tr>
                           <th className="p-4 border-b">Date</th>
                           <th className="p-4 border-b">Action</th>
                           <th className="p-4 border-b text-right">Amount</th>
                           <th className="p-4 border-b text-right">Balance</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100">
                        {(selectedEmp.leave_bank?.history || []).map((tx: any) => (
                           <tr key={tx.id} className="hover:bg-gray-50">
                              <td className="p-4 text-gray-600">{tx.date}</td>
                              <td className="p-4">
                                 <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-1 ${tx.type === 'accrual' ? 'bg-green-100 text-green-700' : tx.type === 'usage' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {tx.type}
                                 </span>
                                 <div className="text-xs text-gray-900">{tx.description}</div>
                              </td>
                              <td className="p-4 text-right font-mono">
                                 <div className={tx.amount_vacation > 0 ? 'text-green-600' : 'text-gray-400'}>
                                    {tx.amount_vacation > 0 ? '+' : ''}{tx.amount_vacation.toFixed(2)} V
                                 </div>
                                 <div className={tx.amount_personal > 0 ? 'text-green-600' : 'text-gray-400'}>
                                    {tx.amount_personal > 0 ? '+' : ''}{tx.amount_personal.toFixed(2)} P
                                 </div>
                              </td>
                              <td className="p-4 text-right font-bold text-gray-900 font-mono">
                                 {tx.balance_after.toFixed(2)}
                              </td>
                           </tr>
                        ))}
                        {(!selectedEmp.leave_bank?.history || selectedEmp.leave_bank.history.length === 0) && (
                           <tr><td colSpan={4} className="p-8 text-center text-gray-400">No history available.</td></tr>
                        )}
                     </tbody>
                  </table>
               </div>
             </>
           ) : (
             <div className="flex-1 flex items-center justify-center text-gray-300 flex-col gap-2">
                <Calendar size={48} />
                <span className="font-medium">Select an employee to view details</span>
             </div>
           )}
        </div>

      </div>
    </div>
  );
}
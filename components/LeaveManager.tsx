import { useState } from 'react';
import { Employee, LeaveTransaction, LeavePolicyConfig, DEFAULT_POLICY } from '../types';
import { calculateMonthlyAccrual, checkAnniversaryCap, formatShiftLabel } from '../services/leaveService';
import { PlayCircle, ShieldCheck, Briefcase, Calendar, TrendingUp, LayoutGrid, List, Trash2, BookOpen, Settings, Save, X, Cloud } from 'lucide-react';
import { useFeedback } from './FeedbackProvider';

interface LeaveManagerProps {
  employees: Employee[];
  setEmployees: (employees: Employee[]) => void;
  onSave: () => void; // <--- ADDED DEFINITION
}

export default function LeaveManager({ employees, setEmployees, onSave }: LeaveManagerProps) {
  const { notify, confirm } = useFeedback();
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'master' | 'policy'>('list');
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  
  // --- EDITABLE POLICY STATE ---
  const [policy, setPolicy] = useState<LeavePolicyConfig>(() => {
      const saved = localStorage.getItem('leave_policy_config');
      return saved ? JSON.parse(saved) : DEFAULT_POLICY;
  });
  const [isEditingPolicy, setIsEditingPolicy] = useState(false);

  // Adjustment Form State
  const [adjType, setAdjType] = useState<'Add' | 'Subtract'>('Add');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjNote, setAdjNote] = useState('');

  const ftStaff = employees.filter(e => e.classifications.employment_type === 'Full Time');
  const selectedEmp = employees.find(e => e.id === selectedEmpId);

  // --- ACTIONS ---

  const handleSavePolicy = () => {
      localStorage.setItem('leave_policy_config', JSON.stringify(policy));
      setIsEditingPolicy(false);
      notify('success', 'Policy updated successfully.');
  };

  const handleRunMonthly = async () => {
    const currentMonth = new Date().toISOString().slice(0, 7); 
    const alreadyRunCount = ftStaff.filter(e => e.leave_bank?.last_accrual_date?.startsWith(currentMonth)).length;
    
    let message = 'This will add Vacation & Personal hours to all active Full Time staff.';
    if (alreadyRunCount > 0) {
        message = `WARNING: ${alreadyRunCount} employees have ALREADY received accruals this month. \n\nThey will be SKIPPED to prevent duplicates. Continue for remaining staff?`;
    }

    if (!await confirm({ title: 'Run Monthly Accruals?', message, confirmLabel: 'Run Accruals' })) return;

    let processedCount = 0;
    let skippedCount = 0;

    const updatedStaff = employees.map(emp => {
      if (emp.classifications.employment_type !== 'Full Time' || emp.classifications.pto_status === 'Frozen') return emp;

      if (emp.leave_bank?.last_accrual_date?.startsWith(currentMonth)) {
          skippedCount++;
          return emp;
      }

      const { vacation, personal, tier } = calculateMonthlyAccrual(emp, policy);
      
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
      
      processedCount++;
      return { ...emp, leave_bank: newBank };
    });

    setEmployees(updatedStaff);
    notify('success', `Accruals: ${processedCount} Processed, ${skippedCount} Skipped.`);
  };

  const handleManualAdjust = () => {
    if (!selectedEmp || !adjAmount) return;
    
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

  const handleDeleteTransaction = async (txId: string) => {
    if (!selectedEmp || !selectedEmp.leave_bank) return;

    const txIndex = selectedEmp.leave_bank.history.findIndex(t => t.id === txId);
    if (txIndex === -1) return;
    const tx = selectedEmp.leave_bank.history[txIndex];

    const approved = await confirm({
      title: 'Delete Entry?',
      message: 'This will remove the record and revert the balance change. Are you sure?',
      confirmLabel: 'Delete Record',
      cancelLabel: 'Cancel'
    });
    
    if (!approved) return;

    const newVac = selectedEmp.leave_bank.vacation_balance - tx.amount_vacation;
    const newPers = selectedEmp.leave_bank.personal_balance - tx.amount_personal;
    
    const newHistory = [...selectedEmp.leave_bank.history];
    newHistory.splice(txIndex, 1);

    const updatedEmp: Employee = {
      ...selectedEmp,
      leave_bank: {
        ...selectedEmp.leave_bank,
        vacation_balance: newVac,
        personal_balance: newPers,
        history: newHistory
      }
    };

    setEmployees(employees.map(e => e.id === selectedEmp.id ? updatedEmp : e));
    notify('success', 'Entry deleted and balance reverted.');
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6 flex justify-between items-center shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Leave Management</h2>
          <p className="text-sm text-gray-500">Track Vacation & Personal leave for Full-Time staff</p>
        </div>
        <div className="flex gap-3">
            <div className="bg-gray-100 p-1 rounded-lg flex text-sm font-medium">
                <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded-md flex items-center gap-2 ${viewMode === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
                    <List size={16}/> List
                </button>
                <button onClick={() => setViewMode('master')} className={`px-3 py-1.5 rounded-md flex items-center gap-2 ${viewMode === 'master' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
                    <LayoutGrid size={16}/> Master
                </button>
                <button onClick={() => setViewMode('policy')} className={`px-3 py-1.5 rounded-md flex items-center gap-2 ${viewMode === 'policy' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
                    <BookOpen size={16}/> Policy
                </button>
            </div>
            {/* SAVE BUTTON ADDED HERE */}
            <button onClick={onSave} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 shadow-md transition-all font-bold">
               <Cloud size={18} /> Save Changes
            </button>
            <button onClick={handleRunMonthly} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 shadow-md transition-all font-bold">
               <PlayCircle size={18} /> Run Monthly
            </button>
        </div>
      </div>

      {/* VIEW: SPLIT LIST */}
      {viewMode === 'list' && (
      <div className="flex-1 overflow-hidden flex">
        {/* Left: Staff List */}
        <div className="w-5/12 overflow-y-auto p-4 border-r border-gray-200 bg-white">
           <div className="space-y-3">
             {ftStaff.map(emp => {
                 const vac = emp.leave_bank?.vacation_balance || 0;
                 const pers = emp.leave_bank?.personal_balance || 0;
                 const total = vac + pers;
                 const rawShift = (emp.classifications as any).shift_schedule ?? (emp.classifications as any).shift_Schedule;
                 const shift = rawShift ? formatShiftLabel(rawShift) : 'Unknown';
                 const stats = calculateMonthlyAccrual(emp, policy);

                 return (
                   <div key={emp.id} onClick={() => setSelectedEmpId(emp.id)} className={`p-4 rounded-xl border cursor-pointer hover:shadow-md transition-all ${selectedEmpId === emp.id ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 bg-white'}`}>
                      <div className="flex justify-between items-start mb-3">
                         <div>
                           <h3 className="font-bold text-gray-900 text-lg">{emp.personal.full_name}</h3>
                           <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                              <span className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{shift}</span>
                              <span>•</span>
                              <span className={stats.yearsOfService > 0 ? 'text-green-600 font-bold' : 'text-amber-600 font-bold'}>
                                {stats.yearsOfService.toFixed(1)} Years Svc
                              </span>
                           </div>
                         </div>
                         <div className="text-right">
                            <span className="block text-2xl font-black text-blue-600">{total.toFixed(2)}</span>
                            <span className="text-[10px] uppercase font-bold text-gray-400">Current Balance</span>
                         </div>
                      </div>

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
                             <div className="font-medium text-gray-600 text-xs">{emp.classifications.ft_start_date || 'Missing'}</div>
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
                         const updated = checkAnniversaryCap(selectedEmp, policy);
                         setEmployees(employees.map(e => e.id === selectedEmp.id ? updated : e));
                         notify('success', 'Cap check complete');
                     }} className="btn-secondary text-xs">Run Anniversary Cap</button>
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
                               <th className="p-4 border-b text-right">Vac</th>
                               <th className="p-4 border-b text-right">Sick</th>
                               <th className="p-4 border-b text-right bg-gray-50">Total</th>
                               <th className="p-4 border-b w-8 bg-gray-50"></th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-100">
                            {(selectedEmp.leave_bank?.history || []).map((tx: any) => {
                               const change = tx.amount_vacation + tx.amount_personal;
                               return (
                                   <tr key={tx.id} className="hover:bg-gray-50 transition-colors group">
                                      <td className="p-4 text-gray-600 whitespace-nowrap">{tx.date}</td>
                                      <td className="p-4"><span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${tx.type === 'accrual' ? 'bg-green-100 text-green-700' : tx.type === 'usage' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{tx.type}</span></td>
                                      <td className="p-4 text-gray-900 font-medium">{tx.description}</td>
                                      <td className={`p-4 text-right font-mono ${tx.amount_vacation > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                         {tx.amount_vacation.toFixed(1)}
                                      </td>
                                      <td className={`p-4 text-right font-mono ${tx.amount_personal > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                         {tx.amount_personal.toFixed(1)}
                                      </td>
                                      <td className="p-4 text-right font-mono font-bold text-gray-900 bg-gray-50 border-l border-gray-100">
                                         {tx.balance_after.toFixed(1)}
                                      </td>
                                      <td className="p-2 text-center bg-gray-50">
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(tx.id); }}
                                            className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
                                            title="Delete Entry"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                      </td>
                                   </tr>
                               );
                            })}
                            {(!selectedEmp.leave_bank?.history || selectedEmp.leave_bank.history.length === 0) && (
                                <tr><td colSpan={7} className="p-12 text-center text-gray-400">No transaction history found.</td></tr>
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
      )}

      {/* VIEW: MASTER SHEET */}
      {viewMode === 'master' && (
        <div className="flex-1 overflow-auto p-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-900 text-white text-xs uppercase font-bold sticky top-0 z-10">
                        <tr>
                            <th className="p-4">Employee</th>
                            <th className="p-4">Shift Type</th>
                            <th className="p-4">FT Start Date</th>
                            <th className="p-4 text-center">Yrs Service</th>
                            <th className="p-4 text-right">Mthly Accrual</th>
                            <th className="p-4 text-right">Yearly Total</th>
                            <th className="p-4 text-right bg-slate-800">Current Balance</th>
                            <th className="p-4">Last Run</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {ftStaff.map(emp => {
                            const stats = calculateMonthlyAccrual(emp, policy);
                            const vac = emp.leave_bank?.vacation_balance || 0;
                            const pers = emp.leave_bank?.personal_balance || 0;
                            const total = vac + pers;
                            return (
                                <tr key={emp.id} className="hover:bg-blue-50 transition-colors cursor-pointer" onClick={() => { setSelectedEmpId(emp.id); setViewMode('list'); }}>
                                    <td className="p-4 font-bold text-gray-900">{emp.personal.full_name}</td>
                                    <td className="p-4 text-gray-600">{(emp.classifications as any).shift_schedule || (emp.classifications as any).shift_Schedule ? formatShiftLabel((emp.classifications as any).shift_schedule ?? (emp.classifications as any).shift_Schedule) : 'Unknown'}</td>
                                    <td className="p-4 text-gray-600 font-mono">{emp.classifications.ft_start_date || '---'}</td>
                                    <td className="p-4 text-center font-bold text-blue-600">{stats.yearsOfService.toFixed(1)}</td>
                                    <td className="p-4 text-right text-green-700 font-mono">+{stats.totalMonthly.toFixed(2)}</td>
                                    <td className="p-4 text-right text-gray-500 font-mono">{stats.yearlyAllowance.toFixed(0)}</td>
                                    <td className="p-4 text-right font-bold text-slate-900 bg-slate-50 border-l border-slate-200 text-lg">{total.toFixed(2)}</td>
                                    <td className="p-4 text-xs text-gray-400">{emp.leave_bank?.last_accrual_date || 'Never'}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {/* VIEW: POLICY (EDITABLE) */}
      {viewMode === 'policy' && (
          <div className="flex-1 overflow-auto p-8 max-w-5xl mx-auto w-full">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-900">Leave Policy Configuration</h2>
                {!isEditingPolicy ? (
                    <button onClick={() => setIsEditingPolicy(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700"><Settings size={18}/> Edit Policy</button>
                ) : (
                    <div className="flex gap-2">
                        <button onClick={() => setIsEditingPolicy(false)} className="flex items-center gap-2 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-300"><X size={18}/> Cancel</button>
                        <button onClick={handleSavePolicy} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700"><Save size={18}/> Save Changes</button>
                    </div>
                )}
            </div>

            <div className="space-y-8">
                {/* CAPS SECTION */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><ShieldCheck className="text-blue-600"/> Anniversary Carry-Over Caps</h3>
                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <label className="label">10-Hour Shift Cap (Hours)</label>
                            <input 
                                disabled={!isEditingPolicy} 
                                type="number" 
                                className={`input-std text-2xl font-black ${isEditingPolicy ? 'bg-white' : 'bg-gray-100'}`}
                                value={policy.caps.shift_10}
                                onChange={e => setPolicy({...policy, caps: {...policy.caps, shift_10: parseInt(e.target.value)||0}})}
                            />
                            <p className="text-xs text-gray-500 mt-1">Usually 50 Hrs (5 Days)</p>
                        </div>
                        <div>
                            <label className="label">12-Hour Shift Cap (Hours)</label>
                            <input 
                                disabled={!isEditingPolicy} 
                                type="number" 
                                className={`input-std text-2xl font-black ${isEditingPolicy ? 'bg-white' : 'bg-gray-100'}`}
                                value={policy.caps.shift_12}
                                onChange={e => setPolicy({...policy, caps: {...policy.caps, shift_12: parseInt(e.target.value)||0}})}
                            />
                            <p className="text-xs text-gray-500 mt-1">Usually 60 Hrs (5 Days)</p>
                        </div>
                    </div>
                </div>

                {/* TIERS SECTION */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                        <h3 className="font-bold flex items-center gap-2"><TrendingUp/> Accrual Tiers (Based on Years of Service)</h3>
                        <p className="text-xs opacity-75">Amounts are in DAYS per Year</p>
                    </div>
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-500">
                            <tr>
                                <th className="p-4">Start Year</th>
                                <th className="p-4 w-40 text-center">Vacation Days</th>
                                <th className="p-4 w-40 text-center">Sick/Pers Days</th>
                                <th className="p-4 text-right">10-Hr Value</th>
                                <th className="p-4 text-right">12-Hr Value</th>
                                {isEditingPolicy && <th className="p-4 w-10"></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {policy.tiers.sort((a,b) => a.years - b.years).map((tier, idx) => (
                                <tr key={idx} className="hover:bg-blue-50">
                                    <td className="p-4 font-bold">
                                        {isEditingPolicy ? (
                                            <input type="number" className="w-16 border rounded p-1" value={tier.years} onChange={e => {
                                                const newTiers = [...policy.tiers];
                                                newTiers[idx].years = parseInt(e.target.value);
                                                setPolicy({...policy, tiers: newTiers});
                                            }}/>
                                        ) : `${tier.years}+ Years`}
                                    </td>
                                    <td className="p-4 text-center">
                                        {isEditingPolicy ? (
                                            <input type="number" className="w-20 border rounded p-1 text-center" value={tier.vacation_days} onChange={e => {
                                                const newTiers = [...policy.tiers];
                                                newTiers[idx].vacation_days = parseFloat(e.target.value);
                                                setPolicy({...policy, tiers: newTiers});
                                            }}/>
                                        ) : tier.vacation_days}
                                    </td>
                                    <td className="p-4 text-center">
                                        {isEditingPolicy ? (
                                            <input type="number" className="w-20 border rounded p-1 text-center" value={tier.personal_days} onChange={e => {
                                                const newTiers = [...policy.tiers];
                                                newTiers[idx].personal_days = parseFloat(e.target.value);
                                                setPolicy({...policy, tiers: newTiers});
                                            }}/>
                                        ) : tier.personal_days}
                                    </td>
                                    <td className="p-4 text-right font-mono text-gray-500">
                                        {(tier.vacation_days * 10) + (tier.personal_days * 10)} hrs
                                    </td>
                                    <td className="p-4 text-right font-mono text-gray-500">
                                        {(tier.vacation_days * 12) + (tier.personal_days * 12)} hrs
                                    </td>
                                    {isEditingPolicy && (
                                        <td className="p-4 text-center">
                                            <button onClick={() => {
                                                const newTiers = policy.tiers.filter((_, i) => i !== idx);
                                                setPolicy({...policy, tiers: newTiers});
                                            }} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={16}/></button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {isEditingPolicy && (
                        <div className="p-4 bg-gray-50 border-t border-gray-200">
                            <button onClick={() => setPolicy({...policy, tiers: [...policy.tiers, {years: 99, vacation_days: 0, personal_days: 0}]})} className="text-sm font-bold text-blue-600 hover:underline">+ Add New Tier</button>
                        </div>
                    )}
                </div>
            </div>
          </div>
      )}

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
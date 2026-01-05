import React, { useState } from 'react';
import { PayrollRow, MasterRates } from '../types';
import { X, Printer, CheckSquare, Square } from 'lucide-react';

interface PrintWizardProps {
  data: PayrollRow[];
  onClose: () => void;
  rates: MasterRates;
}

type ViewMode = 'summary' | 'detail' | 'hourly_only' | 'custom';

export default function PrintWizard({ data, onClose, rates }: PrintWizardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [customSelection, setCustomSelection] = useState<Set<string>>(new Set(data.map(d => d.id)));

  const handlePrint = () => {
    window.print();
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(customSelection);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setCustomSelection(newSet);
  };

  const filteredData = data.filter(r => {
    if (viewMode === 'hourly_only') {
      // Logic for Hourly/User-Pay group
      return r.payLevel.toLowerCase() === 'hourly only' || r.payLevel.toLowerCase() === 'user-pay-level';
    }
    if (viewMode === 'custom') {
      return customSelection.has(r.id);
    }
    return true; // summary and detail show all
  });

  // Calculate totals for summary view based on filtered data
  const summary = Object.values(filteredData.reduce((acc, row) => {
    if (!acc[row.name]) acc[row.name] = { name: row.name, payLevel: row.payLevel, totalHours: 0, totalPay: 0, items: [] };
    acc[row.name].totalHours += row.hours;
    const pay = row.manual_rate_override !== undefined && row.manual_rate_override !== null
       ? row.manual_rate_override * (rates.pay_codes.definitions.find(d => d.label === row.code)?.type === 'flat' ? 1 : row.hours)
       : (row.total || 0);
    acc[row.name].totalPay += pay;
    acc[row.name].items.push(row);
    return acc;
  }, {} as Record<string, any>));

  const SummaryView = () => (
    <div className="space-y-4">
      <h3 className="text-center font-bold text-lg uppercase mb-4 underline">Payroll Summary</h3>
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="py-2">Employee Name</th>
            <th className="py-2">Pay Level</th>
            <th className="py-2 text-right">Total Hours</th>
            <th className="py-2 text-right">Total Pay</th>
          </tr>
        </thead>
        <tbody>
          {summary.map((emp, i) => (
            <tr key={i} className="border-b border-gray-200">
              <td className="py-2">{emp.name}</td>
              <td className="py-2">{emp.payLevel}</td>
              <td className="py-2 text-right">{emp.totalHours.toFixed(2)}</td>
              <td className="py-2 text-right font-bold">${emp.totalPay.toFixed(2)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-black font-bold text-base">
            <td colSpan={2} className="py-3">Grand Total</td>
            <td className="py-3 text-right">{summary.reduce((s, e) => s + e.totalHours, 0).toFixed(2)}</td>
            <td className="py-3 text-right">${summary.reduce((s, e) => s + e.totalPay, 0).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  const DetailView = () => (
    <div>
      <h3 className="text-center font-bold text-lg uppercase mb-4 underline">
        {viewMode === 'hourly_only' ? 'Hourly & User-Pay Detail' : 'Full Audit Detail'}
      </h3>
      <table className="w-full text-left border-collapse text-xs">
         <thead>
           <tr className="border-b-2 border-black">
             <th className="py-1">Employee</th>
             <th className="py-1">Pay Level</th>
             <th className="py-1">Pay Code</th>
             <th className="py-1 text-right">Hrs/Qty</th>
             <th className="py-1 text-right">Rate</th>
             <th className="py-1 text-right">Total</th>
           </tr>
         </thead>
         <tbody>
           {filteredData.map((row, i) => (
             <tr key={i} className="border-b border-gray-100">
               <td className="py-1 font-medium">{row.name}</td>
               <td className="py-1 text-gray-500">{row.payLevel}</td>
               <td className="py-1">{row.code}</td>
               <td className="py-1 text-right">{row.hours.toFixed(2)}</td>
               <td className="py-1 text-right">{row.manual_rate_override ? `*${row.manual_rate_override}` : (row.rate ?? '-')}</td>
               <td className="py-1 text-right font-semibold">${(row.total || 0).toFixed(2)}</td>
             </tr>
           ))}
           <tr className="border-t-2 border-black font-bold text-sm bg-gray-50">
              <td colSpan={3} className="py-2">Total</td>
              <td className="py-2 text-right">{filteredData.reduce((acc, r) => acc + r.hours, 0).toFixed(2)}</td>
              <td></td>
              <td className="py-2 text-right">${filteredData.reduce((acc, r) => acc + (r.total||0), 0).toFixed(2)}</td>
           </tr>
         </tbody>
      </table>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white w-full max-w-6xl h-[95vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header - No Print */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-900 text-white no-print">
           <div className="flex items-center gap-3">
             <Printer className="text-blue-400" />
             <h2 className="text-xl font-bold">Print & Finalize</h2>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full"><X size={20}/></button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
           {/* Sidebar Options - No Print */}
           <div className="w-full md:w-72 bg-gray-50 p-4 border-r border-gray-200 flex flex-col gap-4 no-print overflow-y-auto">
              
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">View Mode</label>
                <div className="space-y-2">
                   {[
                     { id: 'summary', label: 'Overall Summary', desc: 'Totals per employee' },
                     { id: 'detail', label: 'Detailed Audit', desc: 'Every line item' },
                     { id: 'hourly_only', label: 'Hourly / User Pay', desc: 'Specific pay groups only' },
                     { id: 'custom', label: 'Custom Selection', desc: 'Select specific lines' }
                   ].map((m) => (
                     <button 
                       key={m.id}
                       onClick={() => setViewMode(m.id as ViewMode)}
                       className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${viewMode === m.id ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400'}`}
                     >
                       <div className="font-bold text-sm">{m.label}</div>
                       <div className={`text-xs ${viewMode === m.id ? 'text-blue-100' : 'text-gray-400'}`}>{m.desc}</div>
                     </button>
                   ))}
                </div>
              </div>

              {viewMode === 'custom' && (
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex-1 overflow-auto">
                   <div className="flex justify-between items-center mb-2">
                     <label className="text-xs font-bold text-gray-400 uppercase">Select Rows</label>
                     <button 
                       onClick={() => setCustomSelection(new Set(data.map(d=>d.id)))}
                       className="text-xs text-blue-600 hover:underline"
                     >
                       Select All
                     </button>
                   </div>
                   <div className="space-y-1">
                     {data.map(row => (
                       <div key={row.id} className="flex items-center gap-2 text-sm">
                         <button onClick={() => toggleSelection(row.id)}>
                            {customSelection.has(row.id) 
                              ? <CheckSquare size={16} className="text-blue-600" /> 
                              : <Square size={16} className="text-gray-300" />}
                         </button>
                         <span className="truncate">{row.name} - {row.code}</span>
                       </div>
                     ))}
                   </div>
                </div>
              )}
              
              <div className="mt-auto pt-4 border-t border-gray-200">
                <button onClick={handlePrint} className="w-full btn-primary bg-blue-700 text-white py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-blue-800 transform active:scale-95 transition-all">
                  <Printer size={20} /> Print Report
                </button>
              </div>
           </div>

           {/* Preview Area - This is what prints */}
           <div className="flex-1 p-8 overflow-y-auto bg-white" id="print-area">
              {/* Print Header */}
              <div className="mb-6 border-b-2 border-black pb-4">
                 <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                       {/* Logo */}
                       <div className="w-16 h-16 bg-red-800 text-white flex items-center justify-center font-bold rounded-lg text-2xl shadow-sm print:shadow-none">G</div>
                       <div>
                         <h1 className="text-3xl font-bold uppercase tracking-wide text-gray-900">Gem County Payroll</h1>
                         <p className="text-sm text-gray-600">Period Ending: {new Date().toLocaleDateString()}</p>
                       </div>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                       <div><strong>Generated:</strong> {new Date().toLocaleString()}</div>
                       <div className="mt-1 px-2 py-1 bg-gray-100 inline-block rounded border border-gray-200 print:border-none">FINAL REPORT</div>
                    </div>
                 </div>

                 {/* Signatures Moved to Top */}
                 <div className="grid grid-cols-2 gap-12 mt-8 mb-2">
                    <div>
                      <div className="h-8 border-b border-black"></div>
                      <div className="flex justify-between mt-1">
                        <span className="text-xs uppercase font-bold text-gray-500">Prepared By</span>
                        <span className="text-xs text-gray-400">Date</span>
                      </div>
                    </div>
                    <div>
                      <div className="h-8 border-b border-black"></div>
                      <div className="flex justify-between mt-1">
                        <span className="text-xs uppercase font-bold text-gray-500">Authorized Signature</span>
                        <span className="text-xs text-gray-400">Date</span>
                      </div>
                    </div>
                 </div>
              </div>

              {/* Dynamic Content */}
              <div className="min-h-[500px]">
                {viewMode === 'summary' && <SummaryView />}
                {(viewMode === 'detail' || viewMode === 'hourly_only' || viewMode === 'custom') && <DetailView />}
              </div>
              
              {/* Footer */}
              <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
                Gem County Payroll Pro • Confidential Document
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
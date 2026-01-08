import { useState } from 'react';
import { MasterRates } from '../types';
import { Plus, Trash2 } from 'lucide-react';
import { useFeedback } from './FeedbackProvider';

interface RateMatrixProps {
  rates: MasterRates;
  setRates: (r: MasterRates) => void;
}

export default function RateMatrix({ rates, setRates }: RateMatrixProps) {
  const [newLevelName, setNewLevelName] = useState("");
  const { notify, confirm } = useFeedback();

  const payCodes = rates.pay_codes.definitions;
  // Filter out "Hourly Only" if you don't want it, or keep it. 
  // We sort them to keep the list stable.
  const payLevels = Object.keys(rates.pay_levels).sort();

  // --- ACTIONS ---

  const handleRateChange = (level: string, code: string, val: string) => {
    // Allow empty string for "unset", otherwise parse float
    const num = val === '' ? 0 : parseFloat(val);
    
    // Create deep copy to avoid mutation errors
    const newRates = JSON.parse(JSON.stringify(rates));
    
    // Safety check: Ensure level exists
    if (!newRates.pay_levels[level]) return;
    if (!newRates.pay_levels[level].rates) newRates.pay_levels[level].rates = {};
    
    newRates.pay_levels[level].rates[code] = num;
    setRates(newRates);
  };

  const handleAddLevel = () => {
    if (!newLevelName.trim()) {
      notify('error', 'Please enter a name for the new Pay Level.');
      return;
    }
    if (rates.pay_levels[newLevelName]) {
      notify('error', 'This Pay Level already exists.');
      return;
    }

    const newRates = { ...rates };
    newRates.pay_levels[newLevelName] = {
      rank: 99, // Default rank
      rates: {},
      pto_group: "Fire" // Default
    };
    
    setRates(newRates);
    setNewLevelName("");
  };

  const handleDeleteLevel = async (level: string) => {
    const approved = await confirm({
      title: 'Delete Pay Level',
      message: `Are you sure you want to delete "${level}"? This might break employees assigned to this level.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel'
    });
    if (!approved) return;
    
    const newRates = { ...rates };
    delete newRates.pay_levels[level];
    setRates(newRates);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      
      {/* Top Bar: Add Level */}
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Master Pay Rate Matrix</h2>
          <p className="text-sm text-gray-500">Define base rates for each Pay Group.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-gray-300 shadow-sm">
          <input 
            className="px-3 py-1.5 text-sm border-none outline-none w-48"
            placeholder="New Level Name (e.g. Lt.)"
            value={newLevelName}
            onChange={(e) => setNewLevelName(e.target.value)}
          />
          <button 
            onClick={handleAddLevel}
            className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-green-700 transition-colors"
          >
            <Plus size={16} /> Add
          </button>
        </div>
      </div>
      
      {/* Matrix Grid */}
      <div className="flex-1 overflow-auto relative">
        <table className="border-collapse w-full min-w-[1500px]">
          <thead className="sticky top-0 z-30 bg-white shadow-lg ring-1 ring-gray-200">
             <tr>
               {/* Sticky Name Column Header */}
               <th className="sticky left-0 top-0 z-40 bg-gray-900 text-white p-3 text-left text-sm font-bold min-w-[200px] border-r border-gray-700 shadow-md">
                 Pay Level / Group
               </th>
               {/* Color coded headers for Pay Codes */}
               {payCodes.map(pc => (
                 <th 
                   key={pc.code} 
                   className="p-3 text-left text-xs font-bold text-gray-800 border-r border-gray-200 min-w-[110px]"
                   style={{ backgroundColor: pc.color ? `${pc.color}30` : '#f3f4f6', borderBottom: `3px solid ${pc.color || '#ccc'}` }}
                 >
                   <div className="flex flex-col">
                     <span className="uppercase tracking-wider truncate" title={pc.label}>{pc.label}</span>
                     <span className="text-[9px] opacity-75 font-normal uppercase">{pc.type}</span>
                   </div>
                 </th>
               ))}
               <th className="p-3 bg-gray-100 text-center min-w-[80px]">Actions</th>
             </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {payLevels.map((level) => (
              <tr key={level} className="hover:bg-blue-50/30 transition-colors group">
                
                {/* Sticky Row Name */}
                <td className="sticky left-0 z-20 bg-white p-3 text-sm font-bold text-gray-800 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] group-hover:bg-blue-50/10">
                  <div className="flex flex-col">
                    <span>{level}</span>
                    {level === 'User-Pay-Level' && (
                      <span className="text-[10px] text-blue-600 bg-blue-50 px-1 rounded w-fit mt-1">Custom Base</span>
                    )}
                  </div>
                </td>
                
                {/* Input Cells */}
                {payCodes.map(pc => {
                  // Get rate safely
                  const val = rates.pay_levels[level]?.rates?.[pc.code];
                  const displayVal = (val === undefined || val === null) ? '' : val;
                  
                  // Visual Styles
                  const isHourly = pc.type === 'hourly';
                  
                  return (
                    <td key={pc.code} className="p-1 border-r border-gray-100 relative">
                      <div className="relative w-full h-full">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] pointer-events-none">$</span>
                        <input 
                          type="number"
                          step="0.01"
                          className={`w-full pl-5 pr-2 py-1.5 text-sm text-right outline-none rounded border border-transparent focus:border-blue-500 focus:bg-white transition-all
                            ${isHourly ? 'font-mono text-gray-800' : 'font-semibold text-blue-800 bg-blue-50/30'}`}
                          placeholder="0.00"
                          value={displayVal}
                          onChange={(e) => handleRateChange(level, pc.code, e.target.value)}
                        />
                      </div>
                    </td>
                  );
                })}

                {/* Delete Button */}
                <td className="p-2 text-center">
                  {level !== 'Hourly Only' && (
                    <button 
                      onClick={() => handleDeleteLevel(level)}
                      className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete Level"
                      aria-label={`Delete ${level}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

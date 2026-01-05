import React from 'react';
import { MasterRates } from '../types';

interface RateMatrixProps {
  rates: MasterRates;
  setRates: (r: MasterRates) => void;
}

export default function RateMatrix({ rates, setRates }: RateMatrixProps) {
  const payCodes = rates.pay_codes.definitions;
  const payLevels = Object.keys(rates.pay_levels).sort();

  const handleRateChange = (level: string, code: string, val: string) => {
    const num = val === '' ? null : parseFloat(val);
    const newRates = { ...rates };
    if (!newRates.pay_levels[level].rates) newRates.pay_levels[level].rates = {};
    newRates.pay_levels[level].rates[code] = num;
    setRates(newRates);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Master Pay Rate Matrix</h2>
          <p className="text-sm text-gray-500">Edit rates for each Pay Level. Scroll right to see all codes.</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto relative">
        <table className="border-collapse w-full min-w-[1500px]">
          <thead className="sticky top-0 z-30 bg-white shadow-lg ring-1 ring-gray-200">
             <tr>
               {/* Sticky Name Column Header */}
               <th className="sticky left-0 top-0 z-40 bg-gray-900 text-white p-3 text-left text-sm font-bold min-w-[200px] border-r border-gray-700 shadow-md">
                 Pay Level
               </th>
               {/* Color coded headers */}
               {payCodes.map(pc => (
                 <th 
                   key={pc.code} 
                   className="p-3 text-left text-xs font-bold text-gray-800 border-r border-gray-200 min-w-[120px]"
                   style={{ backgroundColor: pc.color }}
                 >
                   <div className="flex flex-col">
                     <span className="uppercase tracking-wider">{pc.label}</span>
                     <span className="text-[10px] opacity-75 font-normal">{pc.type}</span>
                   </div>
                 </th>
               ))}
             </tr>
          </thead>
          <tbody>
            {payLevels.map((level, idx) => (
              <tr key={level} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                {/* Sticky Name Column Body */}
                <td className="sticky left-0 z-20 bg-white p-3 text-sm font-bold text-gray-800 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] group-hover:bg-gray-50">
                  <div className="flex flex-col">
                    <span>{level}</span>
                    <span className="text-[10px] text-gray-400 font-normal uppercase">Rank {rates.pay_levels[level].rank}</span>
                  </div>
                </td>
                
                {/* Inputs colored by column */}
                {payCodes.map(pc => {
                  const val = rates.pay_levels[level]?.rates?.[pc.code];
                  // Lighten the color for the cell background
                  const bgStyle = { backgroundColor: `${pc.color}15` }; // 15 = very low opacity hex

                  return (
                    <td key={pc.code} className="p-0 border-r border-gray-100 relative" style={bgStyle}>
                      <div className="w-full h-full flex items-center justify-center px-1">
                        <span className="text-gray-400 text-xs mr-1">$</span>
                        <input 
                          type="number"
                          step="0.01"
                          className="w-full bg-transparent py-3 text-sm font-mono text-right focus:bg-white focus:ring-2 focus:ring-blue-500 focus:z-10 outline-none text-gray-800 placeholder-gray-300 transition-all rounded-sm"
                          placeholder="-"
                          value={val === null || val === undefined ? '' : val}
                          onChange={(e) => handleRateChange(level, pc.code, e.target.value)}
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
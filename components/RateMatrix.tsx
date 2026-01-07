import { MasterRates } from '../types';

interface RateMatrixProps {
  rates: MasterRates;
  setRates: (rates: MasterRates) => void;
}

export default function RateMatrix({ rates, setRates }: RateMatrixProps) {
  
  const handleRateChange = (level: string, code: string, val: string) => {
    const num = parseFloat(val);
    if (isNaN(num)) return;

    // Deep copy state to update
    const newRates = { ...rates };
    
    if (!newRates.pay_levels[level]) return;
    if (!newRates.pay_levels[level].rates) newRates.pay_levels[level].rates = {};
    
    newRates.pay_levels[level].rates[code] = num;
    setRates(newRates);
  };

  const payCodes = rates.pay_codes.definitions;
  const levels = Object.keys(rates.pay_levels).sort();

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 bg-yellow-50 border-b border-yellow-100 text-yellow-800 text-sm">
        <strong>Warning:</strong> Changes here affect all calculations immediately.
      </div>
      
      <div className="flex-1 overflow-auto p-4">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border p-2 bg-gray-100 text-left sticky top-0 z-10">Pay Level</th>
              {payCodes.map(pc => (
                <th key={pc.code} className="border p-2 bg-gray-50 w-32 sticky top-0 z-10">
                  <div className="font-bold text-gray-700">{pc.label}</div>
                  <div className="text-[10px] text-gray-400 font-normal">{pc.type}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {levels.map(lvl => (
              <tr key={lvl}>
                <td className="border p-2 font-bold bg-gray-50">{lvl}</td>
                {payCodes.map(pc => {
                  // SAFE ACCESS: Check if rate exists, otherwise 0
                  const currentRate = rates.pay_levels[lvl]?.rates?.[pc.code] ?? 0;
                  
                  return (
                    <td key={pc.code} className="border p-1">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                        <input 
                          type="number" 
                          step="0.01"
                          className="w-full pl-6 pr-2 py-1 rounded border border-transparent hover:border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-right"
                          value={currentRate}
                          onChange={(e) => handleRateChange(lvl, pc.code, e.target.value)}
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
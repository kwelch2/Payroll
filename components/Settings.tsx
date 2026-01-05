import React, { useState } from 'react';
import { MasterRates, Employee, AppConfig, PayCode } from '../types';
import RateMatrix from './RateMatrix';
import StaffDirectory from './StaffDirectory';
import ConfigPanel from './ConfigPanel';

interface SettingsProps {
  rates: MasterRates;
  setRates: (r: MasterRates) => void;
  employees: Employee[];
  setEmployees: (e: Employee[]) => void;
  config: AppConfig;
  setConfig: (c: AppConfig) => void;
}

export default function Settings({ rates, setRates, employees, setEmployees, config, setConfig }: SettingsProps) {
  const [tab, setTab] = useState<'rates' | 'staff' | 'config'>('rates');

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-140px)]">
      {/* Sidebar */}
      <div className="w-full md:w-64 flex flex-col gap-2 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
         <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">System</h3>
         <button 
           onClick={() => setTab('rates')}
           className={`text-left px-4 py-3 rounded-lg font-medium transition-colors ${tab === 'rates' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
         >
           💰 Master Rates
         </button>
         <button 
           onClick={() => setTab('staff')}
           className={`text-left px-4 py-3 rounded-lg font-medium transition-colors ${tab === 'staff' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
         >
           👨‍🚒 Staff Directory
         </button>
         <button 
           onClick={() => setTab('config')}
           className={`text-left px-4 py-3 rounded-lg font-medium transition-colors ${tab === 'config' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
         >
           ⚙️ Configuration
         </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col">
        {tab === 'rates' && <RateMatrix rates={rates} setRates={setRates} />}
        {tab === 'staff' && <StaffDirectory employees={employees} setEmployees={setEmployees} config={config} rates={rates} />}
        {tab === 'config' && <ConfigPanel config={config} setConfig={setConfig} rates={rates} setRates={setRates} />}
      </div>
    </div>
  );
}
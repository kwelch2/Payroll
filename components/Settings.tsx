import { useState } from 'react';
import { MasterRates, Employee, AppConfig } from '../types';
import StaffDirectory from './StaffDirectory';
import RateMatrix from './RateMatrix';
import PayCodeEditor from './PayCodeEditor';
import SystemDefs from './SystemDefs';

interface SettingsProps {
  rates: MasterRates;
  setRates: (r: MasterRates) => void;
  employees: Employee[];
  setEmployees: (e: Employee[]) => void;
  config: AppConfig;
  setConfig: (c: AppConfig) => void;
}

export default function Settings({ rates, setRates, employees, setEmployees, config, setConfig }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'personnel' | 'rates' | 'codes' | 'system'>('personnel');

  return (
    <div className="flex flex-col h-full gap-4">
      
      {/* Settings Navigation */}
      <div className="flex gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
        <button 
          onClick={() => setActiveTab('personnel')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'personnel' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
        >
          Personnel
        </button>
        <button 
          onClick={() => setActiveTab('rates')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'rates' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
        >
          Pay Rates
        </button>
        <button 
          onClick={() => setActiveTab('codes')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'codes' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
        >
          Pay Codes
        </button>
        <button 
          onClick={() => setActiveTab('system')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'system' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
        >
          System Config
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        
        {activeTab === 'personnel' && (
          <StaffDirectory 
             employees={employees} 
             setEmployees={setEmployees}
             rates={rates}  // <--- ADD THIS LINE so the dropdowns work!
          />
        )}

        {activeTab === 'codes' && (
          <PayCodeEditor 
             rates={rates} 
             setRates={setRates} 
          />
        )}

        {activeTab === 'rates' && (
          <RateMatrix 
             rates={rates} 
             setRates={setRates} 
          />
        )}

        {activeTab === 'system' && (
          <SystemDefs 
             config={config}
             setConfig={setConfig}
          />
        )}

      </div>
    </div>
  );
}
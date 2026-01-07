import React, { useState } from 'react';
import { Save, Loader, CheckCircle } from 'lucide-react';
import { MasterRates, Employee, AppConfig } from '../types';
import { saveJsonFile, SystemIds } from '../services/driveService'; // Import save tools
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
  systemIds: SystemIds | null; // <--- NEW PROP
}

export default function Settings({ rates, setRates, employees, setEmployees, config, setConfig, systemIds }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'personnel' | 'rates' | 'codes' | 'system'>('personnel');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveToDrive = async () => {
    if (!systemIds) {
      alert("System not connected. Please refresh.");
      return;
    }
    
    if (!confirm("Save all settings (Personnel, Rates, Config) to Google Drive?")) return;

    setIsSaving(true);
    try {
      // Save all 3 config files in parallel
      await Promise.all([
        saveJsonFile('master_rates.json', rates, systemIds.configId),
        saveJsonFile('personnel_master_db.json', { employees, meta: { version: '1.2', updated: new Date() } }, systemIds.configId),
        saveJsonFile('app_config.json', config, systemIds.configId)
      ]);
      alert("Configuration saved successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to save configuration.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      
      {/* Header with Save Button */}
      <div className="flex justify-between items-center border-b border-gray-200 pb-2">
        <div className="flex gap-2 overflow-x-auto">
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

        {/* The Save Button */}
        <button 
          onClick={handleSaveToDrive}
          disabled={isSaving || !systemIds}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isSaving ? <Loader className="animate-spin" size={18} /> : <Save size={18} />}
          {isSaving ? "Saving..." : "Save System Config"}
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        
        {activeTab === 'personnel' && (
          <StaffDirectory 
             employees={employees} 
             setEmployees={setEmployees}
             rates={rates} 
             config={config}
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
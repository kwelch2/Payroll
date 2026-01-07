import { Plus, Trash2 } from 'lucide-react';
import { AppConfig } from '../types';

interface SystemDefsProps {
  config: AppConfig;
  setConfig: (c: AppConfig) => void;
}

export default function SystemDefs({ config, setConfig }: SystemDefsProps) {
  
  // Generic helper to add item to a list
  const addItem = (key: keyof AppConfig) => {
    const val = prompt(`Add new ${key.replace('_', ' ')}:`);
    if (val) {
      setConfig({ ...config, [key]: [...config[key], val] });
    }
  };

  // Generic helper to remove item
  const removeItem = (key: keyof AppConfig, value: string) => {
    if (confirm(`Remove "${value}"?`)) {
      setConfig({ ...config, [key]: config[key].filter(i => i !== value) });
    }
  };

  const Section = ({ title, dataKey }: { title: string, dataKey: keyof AppConfig }) => (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
        <h3 className="font-bold text-gray-700">{title}</h3>
        <button onClick={() => addItem(dataKey)} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors">
          <Plus size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2">
        {config[dataKey].map((item, idx) => (
          <div key={idx} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded group">
            <span>{item}</span>
            <button onClick={() => removeItem(dataKey, item)} className="text-gray-300 hover:text-red-500">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 h-full">
      <Section title="Rank Structure" dataKey="ranks" />
      <Section title="EMS Cert Levels" dataKey="ems_cert_levels" />
      <Section title="Cell Carriers" dataKey="carriers" />
    </div>
  );
}
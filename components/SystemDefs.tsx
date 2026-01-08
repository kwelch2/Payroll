import { Plus, Trash2 } from 'lucide-react';
import { AppConfig } from '../types';
import { useFeedback } from './FeedbackProvider';

interface SystemDefsProps {
  config: AppConfig;
  setConfig: (c: AppConfig) => void;
}

export default function SystemDefs({ config, setConfig }: SystemDefsProps) {
  const { prompt, confirm } = useFeedback();
  
  // Generic helper to add item to a list
  const addItem = async (key: keyof AppConfig) => {
    const val = await prompt({
      title: 'Add Item',
      message: `Add new ${key.replace('_', ' ')}:`,
      confirmLabel: 'Add',
      cancelLabel: 'Cancel'
    });
    if (val) {
      setConfig({ ...config, [key]: [...config[key], val] });
    }
  };

  // Generic helper to remove item
  const removeItem = async (key: keyof AppConfig, value: string) => {
    const approved = await confirm({
      title: 'Remove Item',
      message: `Remove "${value}"?`,
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel'
    });
    if (approved) {
      setConfig({ ...config, [key]: config[key].filter(i => i !== value) });
    }
  };

  const Section = ({ title, dataKey }: { title: string, dataKey: keyof AppConfig }) => (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
        <h3 className="font-bold text-gray-700">{title}</h3>
        <button onClick={() => addItem(dataKey)} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors" aria-label={`Add ${title}`}>
          <Plus size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2">
        {config[dataKey].map((item, idx) => (
          <div key={idx} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded group">
            <span>{item}</span>
            <button onClick={() => removeItem(dataKey, item)} className="text-gray-300 hover:text-red-500" aria-label={`Remove ${item}`}>
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

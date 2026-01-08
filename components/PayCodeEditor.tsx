import { Plus, Trash2 } from 'lucide-react'; // Removed unused imports
import { MasterRates, PayCodeDefinition } from '../types';
import { useFeedback } from './FeedbackProvider';

interface PayCodeEditorProps {
  rates: MasterRates;
  setRates: (rates: MasterRates) => void;
}

export default function PayCodeEditor({ rates, setRates }: PayCodeEditorProps) {
  const { confirm } = useFeedback();
  
  const handleUpdate = (index: number, field: keyof PayCodeDefinition, value: any) => {
    const newDefs = [...rates.pay_codes.definitions];
    newDefs[index] = { ...newDefs[index], [field]: value };
    setRates({ ...rates, pay_codes: { ...rates.pay_codes, definitions: newDefs } });
  };

  const handleDelete = async (index: number) => {
    const approved = await confirm({
      title: 'Delete Pay Code',
      message: 'Delete this pay code? Existing payroll records using it might break.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel'
    });
    if (!approved) return;
    const newDefs = rates.pay_codes.definitions.filter((_, i) => i !== index);
    setRates({ ...rates, pay_codes: { ...rates.pay_codes, definitions: newDefs } });
  };

  const handleAdd = () => {
    const newCode: PayCodeDefinition = {
      code: `code_${Date.now()}`,
      label: "New Pay Code",
      type: "hourly",
      color: "#94a3b8"
    };
    setRates({ 
      ...rates, 
      pay_codes: { 
        ...rates.pay_codes, 
        definitions: [...rates.pay_codes.definitions, newCode] 
      } 
    });
  };

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Pay Code Configuration</h2>
          <p className="text-sm text-gray-500">Define the types of pay available in the system.</p>
        </div>
        <button onClick={handleAdd} className="btn-primary flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-sm">
          <Plus size={16} /> Add Pay Code
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase">
            <tr>
              <th className="p-4 w-16">Color</th>
              <th className="p-4">Label (Name)</th>
              <th className="p-4">System Code</th>
              <th className="p-4">Pay Type</th>
              <th className="p-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rates.pay_codes.definitions.map((def, idx) => (
              <tr key={idx} className="hover:bg-gray-50 transition-colors">
                <td className="p-4">
                  <input 
                    type="color" 
                    value={def.color || '#000000'}
                    onChange={(e) => handleUpdate(idx, 'color', e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-none bg-transparent"
                    title="Pick Color"
                  />
                </td>
                <td className="p-4">
                  <input 
                    className="border border-gray-300 rounded px-2 py-1 text-sm font-medium w-full focus:ring-2 focus:ring-blue-500 outline-none"
                    value={def.label}
                    onChange={(e) => handleUpdate(idx, 'label', e.target.value)}
                  />
                </td>
                <td className="p-4">
                  <input 
                    className="bg-gray-100 text-gray-500 border border-transparent rounded px-2 py-1 text-xs font-mono w-full"
                    value={def.code}
                    disabled
                    title="System ID cannot be changed"
                  />
                </td>
                <td className="p-4">
                  <select 
                    className="border border-gray-300 rounded px-2 py-1 text-sm bg-white w-full focus:ring-2 focus:ring-blue-500 outline-none"
                    value={def.type}
                    onChange={(e) => handleUpdate(idx, 'type', e.target.value)}
                  >
                    <option value="hourly">Hourly (Rate x Hours)</option>
                    <option value="flat">Flat Rate (Fixed Amount)</option>
                  </select>
                </td>
                <td className="p-4 text-center">
                  <button 
                    onClick={() => handleDelete(idx)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Code"
                    aria-label={`Delete ${def.label}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

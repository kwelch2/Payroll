import React from 'react';
import { AppConfig, MasterRates, PTORule } from '../types';

interface ConfigPanelProps {
  config: AppConfig;
  setConfig: (c: AppConfig) => void;
  rates: MasterRates;
  setRates: (r: MasterRates) => void;
}

export default function ConfigPanel({ config, setConfig, rates, setRates }: ConfigPanelProps) {
  
  const handleListChange = (key: keyof AppConfig, value: string) => {
    setConfig({
      ...config,
      [key]: value.split('\n').filter(s => s.trim() !== '')
    });
  };

  const handlePtoRuleChange = (group: string, field: keyof PTORule, value: any) => {
    const rules = { ...(rates.pto_rules || {}) };
    if (!rules[group]) rules[group] = { carryover_cap: 0, yearly_allowance: 0, accrual_type: 'monthly' };
    
    // @ts-ignore
    rules[group][field] = value;
    setRates({ ...rates, pto_rules: rules });
  };

  // Ensure config arrays exist before joining
  const ranks = config.ranks ? config.ranks.join('\n') : '';
  const emsCerts = config.ems_cert_levels ? config.ems_cert_levels.join('\n') : '';

  // Ensure PTO groups exist
  const ptoGroups = rates.pto_rules ? Object.keys(rates.pto_rules) : ['Fire', 'EMS'];

  return (
    <div className="p-6 overflow-auto space-y-8 h-full bg-white">
      
      <section>
        <h2 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b">System Dropdowns</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="label">Ranks (One per line)</label>
            <textarea 
              className="input-field h-48 font-mono text-sm bg-gray-50" 
              value={ranks}
              onChange={e => handleListChange('ranks', e.target.value)}
              placeholder="e.g. Firefighter&#10;Captain"
            />
          </div>
          <div>
            <label className="label">EMS Cert Levels (One per line)</label>
            <textarea 
              className="input-field h-48 font-mono text-sm bg-gray-50" 
              value={emsCerts}
              onChange={e => handleListChange('ems_cert_levels', e.target.value)}
              placeholder="e.g. EMT&#10;Paramedic"
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b">Paid Time Off (PTO) Banks</h2>
        <p className="text-sm text-gray-500 mb-4">Define accumulation rules for each PTO group.</p>
        
        <div className="space-y-4">
           {ptoGroups.length === 0 && <button className="btn-secondary" onClick={() => handlePtoRuleChange('NewGroup', 'yearly_allowance', 0)}>+ Add Group</button>}
           
           {ptoGroups.map(group => {
             const rule = rates.pto_rules?.[group] || { carryover_cap: 0, yearly_allowance: 0, accrual_type: 'monthly' };
             return (
               <div key={group} className="bg-blue-50 p-4 rounded-lg border border-blue-100 shadow-sm">
                 <h4 className="font-bold text-blue-900 mb-3 text-lg">{group} Group Rules</h4>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="label text-blue-800">Yearly Allowance (Hours)</label>
                      <input 
                        type="number" 
                        className="input-field bg-white border-blue-200 focus:ring-blue-400" 
                        value={rule.yearly_allowance} 
                        onChange={e => handlePtoRuleChange(group, 'yearly_allowance', parseFloat(e.target.value))} 
                      />
                    </div>
                    <div>
                      <label className="label text-blue-800">Carryover Cap (Hours)</label>
                      <input 
                        type="number" 
                        className="input-field bg-white border-blue-200 focus:ring-blue-400" 
                        value={rule.carryover_cap} 
                        onChange={e => handlePtoRuleChange(group, 'carryover_cap', parseFloat(e.target.value))} 
                      />
                    </div>
                    <div>
                      <label className="label text-blue-800">Accrual Frequency</label>
                      <select 
                        className="input-field bg-white border-blue-200 focus:ring-blue-400" 
                        value={rule.accrual_type} 
                        onChange={e => handlePtoRuleChange(group, 'accrual_type', e.target.value)}
                      >
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly Dump</option>
                      </select>
                    </div>
                 </div>
               </div>
             )
           })}
        </div>
      </section>

    </div>
  );
}
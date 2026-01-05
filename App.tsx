import React, { useState, useEffect } from 'react';
import { MasterRates, Employee, PayrollRow, AppConfig } from './types';
import { INITIAL_RATES, INITIAL_EMPLOYEES, INITIAL_CONFIG } from './constants';
import { calculatePayRow } from './services/payrollService';

// Components
import Dashboard from './components/Dashboard';
import Editor from './components/Editor';
import Settings from './components/Settings';
import Reports from './components/Reports';
import { Settings as SettingsIcon, FileText, Users, Home } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('editor');
  
  // Global State (In a real app, use Context)
  const [rates, setRates] = useState<MasterRates>(INITIAL_RATES);
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [config, setConfig] = useState<AppConfig>(INITIAL_CONFIG);
  const [payrollData, setPayrollData] = useState<PayrollRow[]>([]);

  // Load from LocalStorage on mount
  useEffect(() => {
    const savedRates = localStorage.getItem('gc_rates');
    const savedEmp = localStorage.getItem('gc_employees');
    const savedConfig = localStorage.getItem('gc_config');

    if (savedRates) setRates(JSON.parse(savedRates));
    if (savedEmp) setEmployees(JSON.parse(savedEmp));
    if (savedConfig) setConfig(JSON.parse(savedConfig));
  }, []);

  // Save to LocalStorage on change
  useEffect(() => { localStorage.setItem('gc_rates', JSON.stringify(rates)); }, [rates]);
  useEffect(() => { localStorage.setItem('gc_employees', JSON.stringify(employees)); }, [employees]);
  useEffect(() => { localStorage.setItem('gc_config', JSON.stringify(config)); }, [config]);

  const NavButton = ({ id, label, icon: Icon }: any) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
        activeTab === id 
          ? 'bg-red-800 text-white shadow-md' 
          : 'text-gray-400 hover:text-white hover:bg-white/10'
      }`}
    >
      <Icon size={18} />
      {label}
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-gray-900 text-white p-4 shadow-lg no-print sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center font-bold text-lg">G</div>
             <h1 className="text-xl font-bold tracking-tight">Gem County Payroll</h1>
          </div>
          <nav className="flex gap-2">
            <NavButton id="dashboard" label="Dashboard" icon={Home} />
            <NavButton id="editor" label="Payroll" icon={FileText} />
            <NavButton id="reports" label="Reports" icon={Users} />
            <NavButton id="settings" label="Settings" icon={SettingsIcon} />
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1920px] w-full mx-auto p-4 md:p-6 overflow-hidden">
        {activeTab === 'dashboard' && (
          <Dashboard 
            rates={rates} setRates={setRates}
            employees={employees} setEmployees={setEmployees}
            config={config} setConfig={setConfig}
          />
        )}
        {activeTab === 'editor' && (
          <Editor 
            data={payrollData} 
            setData={setPayrollData} 
            employees={employees} 
            rates={rates} 
          />
        )}
        {activeTab === 'reports' && <Reports />}
        {activeTab === 'settings' && (
          <Settings 
            rates={rates} 
            setRates={setRates} 
            employees={employees} 
            setEmployees={setEmployees}
            config={config}
            setConfig={setConfig}
          />
        )}
      </main>
    </div>
  );
}
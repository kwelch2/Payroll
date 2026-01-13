import { useState, useEffect } from 'react';
import Welcome from './components/Welcome';
import Layout from './components/Layout';
import PayrollPage from './components/PayrollPage';
import LeaveManager from './components/LeaveManager';
import Settings from './components/Settings';
import Reports from './components/Reports';
import { FeedbackProvider, useFeedback } from './components/FeedbackProvider';
import { 
  initGapi, initGis, requestAccessToken, 
  initializeSystem, saveSystemData, SystemIds 
} from './services/driveService';
import { processLeaveUsage } from './services/leaveService';
import { MasterRates, Employee, PayrollRow, AppConfig } from './types';
import { INITIAL_RATES, INITIAL_EMPLOYEES, INITIAL_CONFIG } from './constants';

function AppContent() {
  const { notify } = useFeedback();
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [gapiReady, setGapiReady] = useState(false);
  const [authStatus, setAuthStatus] = useState("Initializing...");

  const [activeTab, setActiveTab] = useState('payroll');
  const [systemIds, setSystemIds] = useState<SystemIds | null>(null);

  const [systemStatus, setSystemStatus] = useState({
    rates: false,
    employees: false,
    config: false
  });

  const [rates, setRates] = useState<MasterRates>(INITIAL_RATES);
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [config, setConfig] = useState<AppConfig>(INITIAL_CONFIG);
  const [payrollData, setPayrollData] = useState<PayrollRow[]>([]);

  useEffect(() => {
    const boot = async () => {
      try {
        await initGapi();
        await initGis((token: any) => {
          if (token && token.access_token) {
            setIsAuthenticated(true);
            setAuthStatus("Authorized.");
          }
        });
        setGapiReady(true);
        setAuthStatus("Ready.");
      } catch (err) {
        console.error(err);
        setAuthStatus("Connection Failed.");
      }
    };
    boot();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadSystem();
    }
  }, [isAuthenticated]);

  const loadSystem = async () => {
    try {
      setAuthStatus("Loading System Data...");
      const result = await initializeSystem();
      setSystemIds(result.ids);
      
      if (result.data.rates) {
        setRates(result.data.rates);
        setSystemStatus(prev => ({ ...prev, rates: true }));
      }
      if (result.data.employees) {
        setEmployees(result.data.employees);
        setSystemStatus(prev => ({ ...prev, employees: true }));
      }
      if (result.data.config) {
        setConfig(result.data.config);
        setSystemStatus(prev => ({ ...prev, config: true }));
      }
      
      setAuthStatus("Online");
    } catch (err) {
      console.error("System Load Error", err);
      setAuthStatus("Error Loading Data");
    }
  };

  const handleLogin = () => requestAccessToken();
  const handleLogout = () => {
    setIsAuthenticated(false);
    window.location.reload(); 
  };

  // --- ACTIONS ---

  const handleSaveToDrive = async () => {
    if (!systemIds) {
      notify('error', 'System not initialized (Missing IDs)');
      return;
    }
    try {
      notify('info', 'Saving to Drive...');
      await saveSystemData(systemIds, { rates, employees, config });
      notify('success', 'System saved successfully.');
    } catch (error) {
      console.error(error);
      notify('error', 'Failed to save system data.');
    }
  };

  const handlePostLeave = () => {
    const ptoRows = payrollData.filter(r => r.code === 'Paid Time Off' && r.hours > 0);

    if (ptoRows.length === 0) {
      notify('info', 'No Paid Time Off rows found to post.');
      return;
    }

    let updatedEmployees = [...employees];
    let processedCount = 0;

    ptoRows.forEach(row => {
      const empIndex = updatedEmployees.findIndex(e => {
          return e.personal.full_name === row.name; 
      });

      if (empIndex !== -1) {
         const emp = updatedEmployees[empIndex];
         if (emp.classifications.employment_type === 'Full Time') {
            updatedEmployees[empIndex] = processLeaveUsage(
               emp, 
               row.hours, 
               row.startDate || new Date().toISOString().split('T')[0],
               'Payroll Run Deduction'
            );
            processedCount++;
         }
      }
    });

    setEmployees(updatedEmployees);
    notify('success', `Posted leave deductions for ${processedCount} employees.`);
  };

  if (!isAuthenticated) {
    return <Welcome onLogin={handleLogin} status={authStatus} isReady={gapiReady} />;
  }

  return (
    <Layout 
      activeTab={activeTab} 
      onTabChange={setActiveTab} 
      userEmail="Admin User" 
      onLogout={handleLogout}
      systemStatus={systemStatus}
      authStatus={authStatus}
    >
      {activeTab === 'payroll' && (
        <PayrollPage 
          data={payrollData} 
          setData={setPayrollData} 
          employees={employees} 
          rates={rates} 
          onSave={handleSaveToDrive} 
          onPostLeave={handlePostLeave}
          systemIds={systemIds}
        />
      )}
      
      {activeTab === 'leave' && (
        <LeaveManager employees={employees} setEmployees={setEmployees} onSave={handleSaveToDrive}/>
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
           systemIds={systemIds}
        />
      )}
    </Layout>
  );
}

export default function App() {
  return (
    <FeedbackProvider>
      <AppContent />
    </FeedbackProvider>
  );
}
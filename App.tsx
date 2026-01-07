import { useState, useEffect } from 'react';
import Welcome from './components/Welcome';
import Layout from './components/Layout';
import PayrollPage from './components/PayrollPage'; 
import Settings from './components/Settings';
import Reports from './components/Reports';
import { 
  initGapi, initGis, requestAccessToken, 
  initializeSystem, SystemIds 
} from './services/driveService';
import { MasterRates, Employee, PayrollRow, AppConfig } from './types';
import { INITIAL_RATES, INITIAL_EMPLOYEES, INITIAL_CONFIG } from './constants';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [gapiReady, setGapiReady] = useState(false);
  const [authStatus, setAuthStatus] = useState("Initializing...");

  const [activeTab, setActiveTab] = useState('payroll');
  const [systemIds, setSystemIds] = useState<SystemIds | null>(null);

  // --- NEW: Track individual file loading status ---
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
      
      // Update data and track status individually
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

  if (!isAuthenticated) {
    return <Welcome onLogin={handleLogin} status={authStatus} isReady={gapiReady} />;
  }

  return (
    <Layout 
      activeTab={activeTab} 
      onTabChange={setActiveTab} 
      userEmail="Admin User" 
      onLogout={handleLogout}
      systemStatus={systemStatus} // <--- PASSING STATUS HERE
    >
      {activeTab === 'payroll' && (
        <PayrollPage 
          data={payrollData} 
          setData={setPayrollData} 
          employees={employees} 
          rates={rates} 
          systemIds={systemIds}
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
           systemIds={systemIds}
        />
      )}
    </Layout>
  );
}
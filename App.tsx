import { useState, useEffect } from 'react';
import Welcome from './components/Welcome';
import Layout from './components/Layout';
import PayrollPage from './components/PayrollPage'; 
import Settings from './components/Settings';
import Reports from './components/Reports';
import { initGapi, initGis, requestAccessToken, ensureSystemFolders, SystemIds } from './services/driveService';
import { MasterRates, Employee, PayrollRow, AppConfig } from './types';
import { INITIAL_RATES, INITIAL_EMPLOYEES, INITIAL_CONFIG } from './constants';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [gapiReady, setGapiReady] = useState(false);
  const [authStatus, setAuthStatus] = useState("Initializing Secure Handshake...");

  const [activeTab, setActiveTab] = useState('payroll');
  const [systemIds, setSystemIds] = useState<SystemIds | null>(null);

  const [rates, setRates] = useState<MasterRates>(INITIAL_RATES);
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [config, setConfig] = useState<AppConfig>(INITIAL_CONFIG);
  const [payrollData, setPayrollData] = useState<PayrollRow[]>([]);

  // Init Google on Mount
  useEffect(() => {
    const boot = async () => {
      try {
        await initGapi();
        await initGis((token) => {
          if (token && token.access_token) {
            setIsAuthenticated(true);
            setAuthStatus("Authorized.");
          }
        });
        setGapiReady(true);
        setAuthStatus("System Ready. Waiting for Auth.");
      } catch (err) {
        console.error(err);
        setAuthStatus("Connection Failed. Check Internet.");
      }
    };
    boot();
  }, []);

  // Load System Data on Login
  useEffect(() => {
    if (isAuthenticated) {
      loadSystem();
    }
  }, [isAuthenticated]);

  const loadSystem = async () => {
    try {
      const ids = await ensureSystemFolders();
      setSystemIds(ids);
      console.log("System Folders Located:", ids);
    } catch (err) {
      console.error("System Load Error", err);
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
        />
      )}
    </Layout>
  );
}
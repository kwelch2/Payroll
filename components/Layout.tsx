import { ReactNode } from 'react';
import { LogOut, FileText, Users, Settings as SettingsIcon } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  userEmail: string;
  onLogout: () => void;
  systemStatus: { rates: boolean; employees: boolean; config: boolean; };
  authStatus: string;
}

interface NavItemProps {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}

export default function Layout({ children, activeTab, onTabChange, userEmail, onLogout, systemStatus, authStatus }: LayoutProps) {
  
  const NavItem = ({ id, label, icon: Icon }: NavItemProps) => (
    <button
      onClick={() => onTabChange(id)}
      className={`relative flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all ${activeTab === id ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
    >
      <Icon size={18} />
      {label}
      {activeTab === id && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-t-full"></div>}
    </button>
  );

  const StatusDot = ({ label, active }: { label: string, active: boolean }) => (
    <button
      type="button"
      className="relative flex flex-col items-center group cursor-help focus:outline-none"
      aria-label={`${label}: ${active ? 'Loaded' : 'Pending'}`}
    >
      <span className={`w-3 h-3 rounded-full ${active ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-300'}`}></span>
      <span className="absolute top-12 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity bg-gray-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-50 pointer-events-none">
        {label}: {active ? 'Loaded' : 'Pending'}
      </span>
    </button>
  );

  const allLoaded = Object.values(systemStatus).every(Boolean);
  const statusTone = authStatus.toLowerCase().includes('error')
    ? 'bg-red-500'
    : authStatus.toLowerCase().includes('loading') || !allLoaded
      ? 'bg-amber-500'
      : 'bg-green-500';
  const statusLabel = authStatus === 'Online'
    ? (allLoaded ? 'System Online' : 'Partial Load')
    : authStatus;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1920px] mx-auto px-4 flex justify-between items-center h-16">
          
          {/* Logo Area */}
          <div className="flex items-center gap-3 w-64">
             {/* UPDATED: Uses logo.jpg from public folder */}
             <img src="/logo.jpg" alt="Gem Payroll" className="w-10 h-10 object-contain" />
             <div className="leading-tight">
               <h1 className="font-bold text-gray-900 tracking-tight">Gem Payroll</h1>
               <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${statusTone} ${statusTone === 'bg-green-500' ? 'animate-pulse' : ''}`}></span>
                  <span className="text-[10px] uppercase font-bold text-gray-400">{statusLabel}</span>
               </div>
             </div>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center h-full">
            <NavItem id="payroll" label="Payroll Editor" icon={FileText} />
            <NavItem id="reports" label="Reports" icon={Users} />
            <NavItem id="settings" label="Settings" icon={SettingsIcon} />
          </nav>

          {/* User & Status Area */}
          <div className="flex items-center gap-6 w-64 justify-end">
            
            {/* The 3 Checkmarks */}
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
               <StatusDot label="Pay Rates" active={systemStatus.rates} />
               <StatusDot label="Personnel DB" active={systemStatus.employees} />
               <StatusDot label="Sys Config" active={systemStatus.config} />
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-gray-900">{userEmail || 'User'}</div>
                <div className="text-[10px] text-gray-500">Administrator</div>
              </div>
              <button onClick={onLogout} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Log Out">
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-[1920px] w-full mx-auto p-4 md:p-6 overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  );
}
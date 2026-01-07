import { ReactNode } from 'react';
import { LogOut, FileText, Users, Settings as SettingsIcon } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  userEmail: string;
  onLogout: () => void;
}

export default function Layout({ children, activeTab, onTabChange, userEmail, onLogout }: LayoutProps) {
  
  const NavItem = ({ id, label, icon: Icon }: any) => (
    <button
      onClick={() => onTabChange(id)}
      className={`relative flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all
        ${activeTab === id ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}
      `}
    >
      <Icon size={18} />
      {label}
      {activeTab === id && (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-t-full"></div>
      )}
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1920px] mx-auto px-4 flex justify-between items-center h-16">
          
          {/* Left: Brand */}
          <div className="flex items-center gap-3 w-64">
             <div className="w-8 h-8 bg-red-700 rounded-lg flex items-center justify-center text-white font-bold text-lg">G</div>
             <div className="leading-tight">
               <h1 className="font-bold text-gray-900 tracking-tight">Gem Payroll</h1>
               <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  <span className="text-[10px] uppercase font-bold text-gray-400">Online</span>
               </div>
             </div>
          </div>

          {/* Center: Navigation */}
          <nav className="hidden md:flex items-center h-full">
            <NavItem id="payroll" label="Payroll Editor" icon={FileText} />
            <NavItem id="reports" label="Reports" icon={Users} />
            <NavItem id="settings" label="Settings" icon={SettingsIcon} />
          </nav>

          {/* Right: User */}
          <div className="flex items-center gap-4 w-64 justify-end">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-gray-900">{userEmail || 'User'}</div>
              <div className="text-[10px] text-gray-500">Administrator</div>
            </div>
            <button 
              onClick={onLogout}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Log Out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Stage */}
      <main className="flex-1 max-w-[1920px] w-full mx-auto p-4 md:p-6 overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  );
}
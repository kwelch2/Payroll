import { ShieldCheck, Lock } from 'lucide-react';

interface WelcomeProps {
  onLogin: () => void;
  status: string;
  isReady: boolean;
}

export default function Welcome({ onLogin, status, isReady }: WelcomeProps) {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-2xl shadow-xl p-8 text-center border border-gray-200">
        
        {/* Logo Icon */}
        <div className="w-20 h-20 bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
          <ShieldCheck className="text-white" size={40} />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Gem County Payroll</h1>
        <p className="text-gray-500 mb-8">Secure Personnel & Compensation System</p>

        {/* Status Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8 text-sm font-medium text-gray-400 bg-gray-50 py-2 rounded-lg">
           <div className={`w-2 h-2 rounded-full ${isReady ? 'bg-green-500 animate-pulse' : 'bg-orange-400'}`}></div>
           {status}
        </div>

        {/* Login Button */}
        <button 
          onClick={onLogin}
          disabled={!isReady}
          className="w-full btn-primary bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          <Lock size={20} />
          Authenticate with Google
        </button>

        <p className="mt-6 text-xs text-gray-400">
          Authorized Access Only. All activity is logged.
        </p>
      </div>
    </div>
  );
}
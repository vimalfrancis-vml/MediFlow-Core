import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NotificationCenter } from './NotificationCenter';

interface DashboardHeaderProps {
  title?: string;
  brandPrefix?: string;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ title = "MediFlow", brandPrefix }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="dashboard-header bg-white border-b border-slate-200 shadow-2xs px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between sticky top-0 z-40">
      <div className="dashboard-brand flex items-center gap-2.5">
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0" aria-hidden="true">
          <rect width="32" height="32" rx="8" fill="url(#dash-logo-gradient)" />
          <path d="M16 8V24M8 16H24" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          <defs>
            <linearGradient id="dash-logo-gradient" x1="0" y1="0" x2="32" y2="32">
              <stop stopColor="#6366f1" />
              <stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </svg>
        <div className="flex items-baseline gap-2">
          <span className="brand-name font-bold text-base sm:text-lg text-slate-900 tracking-tight whitespace-nowrap">
            {title}
          </span>
          {brandPrefix && (
            <span className="text-[11px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200/60 rounded uppercase tracking-wider hidden sm:inline-block">
              {brandPrefix}
            </span>
          )}
        </div>
      </div>

      <div className="dashboard-user-info flex items-center gap-2 sm:gap-4">
        <NotificationCenter />
        
        <div className="user-details hidden md:flex flex-col items-end leading-tight">
          <span className="user-name text-xs sm:text-sm font-semibold text-slate-800">
            {user?.firstName} {user?.lastName}
          </span>
          <span className="user-role text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
            {user?.role ? user.role.replace(/_/g, ' ') : ''}
          </span>
        </div>

        <button 
          type="button"
          className="logout-button text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 sm:px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 flex-shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600" 
          id="logout-button" 
          onClick={handleLogout}
          aria-label="Sign out of MediFlow"
        >
          Sign out
        </button>
      </div>
    </header>
  );
};

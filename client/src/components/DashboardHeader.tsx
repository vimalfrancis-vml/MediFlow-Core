import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NotificationCenter } from './NotificationCenter';
import logoImg from '../assets/logo.png';

interface DashboardHeaderProps {
  title?: string;
  brandPrefix?: string;
  isSticky?: boolean;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ title = "MediFlow", isSticky = true }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const roleDisplay = user?.role ? user.role.replace(/_/g, ' ') : '';
  const deptDisplay = (user as any)?.department?.displayName || (user as any)?.department?.name || (user as any)?.departmentCode;
  const userSubtitle = deptDisplay ? `${roleDisplay} · ${deptDisplay}` : roleDisplay;

  return (
    <header className={`dashboard-header bg-white border-b border-slate-200 shadow-2xs px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between ${isSticky ? 'sticky top-0 z-40' : ''}`}>
      <div className="dashboard-brand flex items-center gap-2.5">
        <img
          src={logoImg}
          alt="Jubilee Mission Medical College & Research Institute Logo"
          className="w-8 h-8 sm:w-9 sm:h-9 object-contain flex-shrink-0 drop-shadow-xs"
        />
        <div className="flex items-baseline gap-2">
          <span className="brand-name font-bold text-base sm:text-lg text-slate-900 tracking-tight whitespace-nowrap">
            {title}
          </span>
        </div>
      </div>

      <div className="dashboard-user-info flex items-center gap-2 sm:gap-4">
        <NotificationCenter />
        
        <div className="user-details hidden md:flex flex-col items-end leading-tight">
          <span className="user-name text-xs sm:text-sm font-semibold text-slate-800">
            {user?.firstName} {user?.lastName}
          </span>
          <span className="user-role text-[11px] text-slate-500 font-medium">
            {userSubtitle}
          </span>
        </div>

        <button 
          type="button"
          className="logout-button text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 flex-shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2457A7]" 
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

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { NotificationCenter } from './NotificationCenter';

interface DashboardHeaderProps {
  title?: string;
  brandPrefix?: string;
  children?: React.ReactNode; // nav items
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ title = "MediFlow", brandPrefix, children }) => {
  const { user, logout } = useAuth();

  return (
    <header className="dashboard-header bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
      <div className="dashboard-brand flex items-center gap-3">
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
          <rect width="32" height="32" rx="8" fill="url(#dash-logo-gradient)" />
          <path d="M16 8V24M8 16H24" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          <defs>
            <linearGradient id="dash-logo-gradient" x1="0" y1="0" x2="32" y2="32">
              <stop stopColor="#6366f1" />
              <stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </svg>
        <span className="brand-name font-bold text-xl text-slate-800">
          {brandPrefix ? `${title} (${brandPrefix})` : title}
        </span>
      </div>

      <div className="dashboard-user-info flex items-center gap-6">
        <NotificationCenter />
        {children}
        <div className="user-details flex flex-col items-end">
          <span className="user-name text-sm font-semibold text-slate-900">{user?.firstName} {user?.lastName}</span>
          <span className="user-role text-xs text-slate-500 font-medium uppercase tracking-wider">{user?.role.replace(/_/g, ' ')}</span>
        </div>
        <button 
          className="logout-button text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-md hover:bg-slate-100 transition-colors" 
          id="logout-button" 
          onClick={logout}
          aria-label="Sign out of MediFlow"
        >
          Sign out
        </button>
      </div>
    </header>
  );
};

import React from 'react';
import { DashboardHeader } from './DashboardHeader';

interface DashboardLayoutProps {
  title?: string;
  brandPrefix?: string;
  nav?: React.ReactNode;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ title, brandPrefix, nav, children }) => {
  return (
    <div className="dashboard-layout min-h-screen bg-slate-50 flex flex-col">
      <DashboardHeader title={title} brandPrefix={brandPrefix} />

      {nav && (
        <div className="dashboard-subnav bg-white border-b border-slate-200 sticky top-[57px] z-30 shadow-2xs">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10">
            {nav}
          </div>
        </div>
      )}

      <main className="dashboard-main flex-1 max-w-[1280px] mx-auto w-full px-4 sm:px-6 lg:px-10 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
};

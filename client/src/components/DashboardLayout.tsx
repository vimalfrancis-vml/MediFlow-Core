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
      <DashboardHeader title={title} brandPrefix={brandPrefix}>
        {nav}
      </DashboardHeader>

      <main className="dashboard-main flex-1 max-w-[1280px] mx-auto w-full px-6 lg:px-10 py-8">
        {children}
      </main>
    </div>
  );
};

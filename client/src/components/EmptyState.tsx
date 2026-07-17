import React from 'react';

interface EmptyStateProps {
  message: string;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ message, icon }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 bg-slate-50 rounded-lg border border-slate-200 border-dashed" role="status" aria-live="polite">
      {icon && <div className="mb-4 text-slate-400" aria-hidden="true">{icon}</div>}
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
};

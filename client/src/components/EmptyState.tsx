import React from 'react';

interface EmptyStateProps {
  message: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ message, icon, actionLabel, onAction }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 bg-slate-50 rounded-lg border border-slate-200 border-dashed" role="status" aria-live="polite">
      {icon && <div className="mb-4 text-slate-400" aria-hidden="true">{icon}</div>}
      <p className="text-sm font-medium">{message}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

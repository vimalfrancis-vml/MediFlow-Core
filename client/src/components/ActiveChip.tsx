import type { FC } from 'react';

export interface ActiveChipProps {
  isActive?: boolean | null;
  className?: string;
}

export const ActiveChip: FC<ActiveChipProps> = ({ isActive = true, className = '' }) => {
  const active = Boolean(isActive);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium whitespace-nowrap leading-none ${
        active
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
          : 'bg-slate-100 text-slate-600 border-slate-200'
      } ${className}`}
      role="status"
      aria-label={`Status: ${active ? 'Active' : 'Inactive'}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          active ? 'bg-emerald-500' : 'bg-slate-400'
        }`}
        aria-hidden="true"
      />
      <span>{active ? 'Active' : 'Inactive'}</span>
    </span>
  );
};


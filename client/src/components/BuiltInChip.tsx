import type { FC } from 'react';

export interface BuiltInChipProps {
  isSystem?: boolean | null;
  className?: string;
}

export const BuiltInChip: FC<BuiltInChipProps> = ({ isSystem = true, className = '' }) => {
  const isBuiltIn = Boolean(isSystem);

  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium whitespace-nowrap leading-none ${
        isBuiltIn
          ? 'border-slate-200 bg-slate-100 text-slate-700'
          : 'border-blue-200 bg-blue-50 text-blue-700'
      } ${className}`}
      role="status"
      aria-label={`Role type: ${isBuiltIn ? 'Built-in' : 'Custom'}`}
    >
      {isBuiltIn ? 'Built-in' : 'Custom'}
    </span>
  );
};


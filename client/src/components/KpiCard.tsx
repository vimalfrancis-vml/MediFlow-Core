import type { FC } from 'react';

export interface KpiCardProps {
  label: string;
  count: number;
  accentBorder: string;
  isSelected?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}

export const KpiCard: FC<KpiCardProps> = ({
  label,
  count,
  accentBorder,
  isSelected = false,
  onClick,
  ariaLabel,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      aria-label={ariaLabel || `${label}: ${count}`}
      className={`text-left w-full rounded-lg border p-4 transition-all duration-150 border-l-4 ${accentBorder} ${
        isSelected
          ? 'bg-blue-50/50 border-blue-300 ring-2 ring-blue-700/20 shadow-xs'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 shadow-2xs'
      } focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 focus-visible:outline-offset-1`}
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-slate-500 truncate">
          {label}
        </span>
        <span className="text-2xl font-semibold tabular-nums text-slate-900 leading-none">
          {count}
        </span>
      </div>
    </button>
  );
};

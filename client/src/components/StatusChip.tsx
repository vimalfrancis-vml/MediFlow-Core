import type { FC } from 'react';
import { useTerminology } from '../context/TerminologyContext';
import { getStatusConfig } from '../constants/status';

export interface StatusChipProps {
  status?: string | null;
  className?: string;
  size?: 'sm' | 'md';
}

export { STATUS } from '../constants/status';

export const StatusChip: FC<StatusChipProps> = ({ status, className = '', size = 'md' }) => {
  const { getStatusLabel } = useTerminology();
  const theme = getStatusConfig(status);
  const label = getStatusLabel(status);

  const sizeClasses = size === 'sm' 
    ? 'text-[10px] px-2 py-0.5 gap-1.5' 
    : 'text-[11px] px-2.5 py-1 gap-1.5 font-semibold';

  return (
    <span
      className={`inline-flex items-center rounded-full border whitespace-nowrap leading-none ${theme.bg} ${theme.text} ${theme.border} ${sizeClasses} ${className}`}
      title={`Status: ${label}`}
      role="status"
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${theme.dot}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
};

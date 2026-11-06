import React from 'react';
import { useTerminology } from '../context/TerminologyContext';

export interface StatusChipProps {
  status?: string | null;
  className?: string;
  size?: 'sm' | 'md';
}

interface StatusConfig {
  bg: string;
  text: string;
  border: string;
  dot: string;
}

const STATUS_THEMES: Record<string, StatusConfig> = {
  DRAFT: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  },
  SUBMITTED: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200/80',
    dot: 'bg-blue-500',
  },
  IN_REVIEW: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200/80',
    dot: 'bg-amber-500',
  },
  UNDER_REVIEW: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200/80',
    dot: 'bg-amber-500',
  },
  APPROVED: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200/80',
    dot: 'bg-emerald-500',
  },
  REJECTED: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200/80',
    dot: 'bg-rose-500',
  },
  RETURNED: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200/80',
    dot: 'bg-amber-500',
  },
  CANCELLED: {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  },
};

const DEFAULT_THEME: StatusConfig = {
  bg: 'bg-slate-50',
  text: 'text-slate-700',
  border: 'border-slate-200',
  dot: 'bg-slate-400',
};

export const StatusChip: React.FC<StatusChipProps> = ({ status, className = '', size = 'md' }) => {
  const { getStatusLabel } = useTerminology();
  const normalized = (status || '').toUpperCase().replace(/[\s-]+/g, '_');
  const theme = STATUS_THEMES[normalized] || DEFAULT_THEME;
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

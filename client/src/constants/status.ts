export interface StatusConfig {
  key: string;
  label: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
  accentBorder: string;
  barColor: string;
}

export const STATUS: Record<string, StatusConfig> = {
  DRAFT: {
    key: 'DRAFT',
    label: 'Draft',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
    accentBorder: 'border-l-slate-400',
    barColor: 'bg-slate-400',
  },
  SUBMITTED: {
    key: 'SUBMITTED',
    label: 'Submitted',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200/80',
    dot: 'bg-blue-500',
    accentBorder: 'border-l-blue-600',
    barColor: 'bg-blue-600',
  },
  IN_REVIEW: {
    key: 'IN_REVIEW',
    label: 'Under review',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200/80',
    dot: 'bg-amber-500',
    accentBorder: 'border-l-amber-500',
    barColor: 'bg-amber-500',
  },
  UNDER_REVIEW: {
    key: 'UNDER_REVIEW',
    label: 'Under review',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200/80',
    dot: 'bg-amber-500',
    accentBorder: 'border-l-amber-500',
    barColor: 'bg-amber-500',
  },
  APPROVED: {
    key: 'APPROVED',
    label: 'Approved',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200/80',
    dot: 'bg-emerald-500',
    accentBorder: 'border-l-emerald-600',
    barColor: 'bg-emerald-600',
  },
  REJECTED: {
    key: 'REJECTED',
    label: 'Rejected',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200/80',
    dot: 'bg-rose-500',
    accentBorder: 'border-l-rose-600',
    barColor: 'bg-rose-600',
  },
  RETURNED: {
    key: 'RETURNED',
    label: 'Returned',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200/80',
    dot: 'bg-amber-500',
    accentBorder: 'border-l-amber-600',
    barColor: 'bg-amber-600',
  },
  CANCELLED: {
    key: 'CANCELLED',
    label: 'Cancelled',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
    accentBorder: 'border-l-slate-400',
    barColor: 'bg-slate-400',
  },
};

export const DEFAULT_STATUS_CONFIG: StatusConfig = {
  key: 'UNKNOWN',
  label: 'Unknown',
  bg: 'bg-slate-50',
  text: 'text-slate-700',
  border: 'border-slate-200',
  dot: 'bg-slate-400',
  accentBorder: 'border-l-slate-300',
  barColor: 'bg-slate-400',
};

export function getStatusConfig(status?: string | null): StatusConfig {
  if (!status) return DEFAULT_STATUS_CONFIG;
  const normalized = status.toUpperCase().replace(/[\s-]+/g, '_');
  return STATUS[normalized] || DEFAULT_STATUS_CONFIG;
}


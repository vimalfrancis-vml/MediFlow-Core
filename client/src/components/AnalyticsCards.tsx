import type { AnalyticsData } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getRoleTheme } from '../constants/theme';

interface AnalyticsCardsProps {
  data: AnalyticsData['kpis'] | null;
  isLoading: boolean;
  role?: string;
}

export function AnalyticsCards({ data, isLoading, role }: AnalyticsCardsProps) {
  const { user } = useAuth();
  const theme = getRoleTheme(role || user?.role);

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {[...Array(5)].map((_, i) => (
          <div 
            key={i} 
            className="animate-pulse bg-white p-4 sm:p-5 rounded-xl shadow-2xs border border-slate-200/90 h-[96px] flex flex-col justify-between"
          >
            <div className="h-3 w-20 bg-slate-200 rounded"></div>
            <div className="h-7 w-12 bg-slate-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    { 
      label: 'Total Requests', 
      value: data.total, 
      color: 'text-slate-900', 
      dotColor: 'bg-slate-400',
      description: 'All submitted requests',
      isAwaitingAction: false,
    },
    { 
      label: 'Pending Review', 
      value: data.pending, 
      color: 'text-slate-900', 
      dotColor: 'bg-amber-500',
      description: 'Awaiting departmental action',
      isAwaitingAction: true,
    },
    { 
      label: 'Approved', 
      value: data.approved, 
      color: 'text-emerald-700', 
      dotColor: 'bg-emerald-500',
      description: 'Successfully authorized',
      isAwaitingAction: false,
    },
    { 
      label: 'Rejected', 
      value: data.rejected, 
      color: 'text-rose-700', 
      dotColor: 'bg-rose-500',
      description: 'Declined requisitions',
      isAwaitingAction: false,
    },
    { 
      label: 'Returned', 
      value: data.returned, 
      color: 'text-amber-700', 
      dotColor: 'bg-amber-500',
      description: 'Returned for revision',
      isAwaitingAction: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
      {cards.map((card) => (
        <div 
          key={card.label} 
          className={`bg-white p-4 sm:p-5 rounded-xl shadow-2xs border border-slate-200/90 hover:border-slate-300 transition-all duration-150 flex flex-col justify-between min-h-[96px] group ${
            card.isAwaitingAction ? `border-l-4 ${theme.kpiBorder}` : ''
          }`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider leading-none">
              {card.label}
            </span>
            <span 
              className={`w-2 h-2 rounded-full flex-shrink-0 ${card.dotColor}`} 
              aria-hidden="true" 
            />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className={`text-2xl sm:text-3xl font-bold tracking-tight leading-none tabular-nums ${card.color}`}>
              {card.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

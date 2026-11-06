import type { AnalyticsData } from '../services/api';

interface AnalyticsCardsProps {
  data: AnalyticsData['kpis'] | null;
  isLoading: boolean;
}

export function AnalyticsCards({ data, isLoading }: AnalyticsCardsProps) {
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
      badgeBg: 'bg-slate-50 border-slate-200/80 text-slate-600',
      description: 'All submitted requests'
    },
    { 
      label: 'Pending Review', 
      value: data.pending, 
      color: 'text-[#2457A7]', 
      dotColor: 'bg-[#2457A7]',
      badgeBg: 'bg-blue-50/80 border-blue-200/70 text-[#2457A7]',
      description: 'Awaiting departmental action'
    },
    { 
      label: 'Approved', 
      value: data.approved, 
      color: 'text-emerald-700', 
      dotColor: 'bg-emerald-500',
      badgeBg: 'bg-emerald-50/80 border-emerald-200/70 text-emerald-700',
      description: 'Successfully authorized'
    },
    { 
      label: 'Rejected', 
      value: data.rejected, 
      color: 'text-rose-700', 
      dotColor: 'bg-rose-500',
      badgeBg: 'bg-rose-50/80 border-rose-200/70 text-rose-700',
      description: 'Declined requisitions'
    },
    { 
      label: 'Returned', 
      value: data.returned, 
      color: 'text-amber-700', 
      dotColor: 'bg-amber-500',
      badgeBg: 'bg-amber-50/80 border-amber-200/70 text-amber-800',
      description: 'Returned for revision'
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
      {cards.map((card) => (
        <div 
          key={card.label} 
          className="bg-white p-4 sm:p-5 rounded-xl shadow-2xs border border-slate-200/90 hover:border-slate-300 transition-all duration-150 flex flex-col justify-between min-h-[96px] group"
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

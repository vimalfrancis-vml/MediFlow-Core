
import type { AnalyticsData } from '../services/api';

interface AnalyticsCardsProps {
  data: AnalyticsData['kpis'] | null;
  isLoading: boolean;
}

export function AnalyticsCards({ data, isLoading }: AnalyticsCardsProps) {
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse bg-white p-5 rounded-lg shadow-sm border border-slate-200/80 h-[96px]"></div>
        ))}
      </div>
    );
  }

  const cards = [
    { label: 'Total Requests', value: data.total, color: 'text-slate-800', border: 'border-l-3 border-l-slate-400' },
    { label: 'Pending Review', value: data.pending, color: 'text-blue-600', border: 'border-l-3 border-l-blue-500' },
    { label: 'Approved', value: data.approved, color: 'text-emerald-600', border: 'border-l-3 border-l-emerald-500' },
    { label: 'Rejected', value: data.rejected, color: 'text-red-600', border: 'border-l-3 border-l-red-500' },
    { label: 'Returned', value: data.returned, color: 'text-amber-600', border: 'border-l-3 border-l-amber-500' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {cards.map((card) => (
        <div key={card.label} className={`bg-white px-5 py-4 rounded-lg shadow-sm border border-slate-200/80 ${card.border} hover:shadow-md transition-shadow duration-200 flex flex-col justify-between min-h-[88px]`}>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider leading-none">{card.label}</span>
          <div className="flex items-baseline gap-1 mt-3">
            <span className={`text-3xl font-extrabold tracking-tight leading-none ${card.color}`}>{card.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

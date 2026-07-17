
import type { AnalyticsData } from '../services/api';

interface AnalyticsCardsProps {
  data: AnalyticsData['kpis'] | null;
  isLoading: boolean;
}

export function AnalyticsCards({ data, isLoading }: AnalyticsCardsProps) {
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse bg-white p-4 rounded-xl shadow-sm border border-slate-100 h-24"></div>
        ))}
      </div>
    );
  }

  const cards = [
    { label: 'Total Requests', value: data.total, color: 'text-slate-800', bg: 'bg-slate-50' },
    { label: 'Pending Review', value: data.pending, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Approved', value: data.approved, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Rejected', value: data.rejected, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Returned', value: data.returned, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      {cards.map((card) => (
        <div key={card.label} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow flex flex-col justify-center">
          <span className="text-sm font-medium text-slate-500 mb-1">{card.label}</span>
          <div className="flex items-end gap-2">
            <span className={`text-2xl font-bold ${card.color}`}>{card.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

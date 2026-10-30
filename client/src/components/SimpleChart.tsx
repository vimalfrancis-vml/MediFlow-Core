import { useTerminology } from '../context/TerminologyContext';

interface SimpleChartProps {
  title: string;
  data: { name: string; value: number }[];
}

export function SimpleChart({ title, data }: SimpleChartProps) {
  const { getStatusLabel, getRequestTypeLabel } = useTerminology();
  const max = Math.max(...data.map(d => d.value), 1);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  // Helper to format item labels nicely based on category
  const formatItemName = (rawName: string) => {
    if (title.toLowerCase().includes('status')) {
      return getStatusLabel(rawName);
    }
    if (title.toLowerCase().includes('type')) {
      return getRequestTypeLabel(rawName);
    }
    return rawName.replace(/_/g, ' ');
  };

  return (
    <div className="bg-white rounded-xl shadow-2xs border border-slate-200/90 flex flex-col overflow-hidden">
      {/* Card Header */}
      <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider leading-none">
          {title}
        </h3>
        <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
          {total} total
        </span>
      </div>

      {/* Chart Body */}
      <div className="px-4 sm:px-5 py-4 flex flex-col gap-3.5">
        {total === 0 || data.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No request data recorded yet
          </div>
        ) : (
          data.map((item, idx) => {
            const percentage = max > 0 ? Math.round((item.value / max) * 100) : 0;
            const pctOfTotal = total > 0 ? Math.round((item.value / total) * 100) : 0;
            return (
              <div key={idx} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-700 truncate leading-none">
                    {formatItemName(item.name)}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {pctOfTotal}%
                    </span>
                    <span className="text-xs font-bold text-slate-900 leading-none tabular-nums min-w-[20px] text-right">
                      {item.value}
                    </span>
                  </div>
                </div>
                {/* Progress bar track & indicator */}
                <div 
                  className="w-full bg-slate-100 h-2 rounded-full overflow-hidden" 
                  role="progressbar" 
                  aria-valuenow={item.value} 
                  aria-valuemin={0} 
                  aria-valuemax={max} 
                  aria-label={`${formatItemName(item.name)}: ${item.value}`}
                >
                  <div
                    className="bg-[#2457A7] h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

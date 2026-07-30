
interface SimpleChartProps {
  title: string;
  data: { name: string; value: number }[];
}

export function SimpleChart({ title, data }: SimpleChartProps) {
  const max = Math.max(...data.map(d => d.value), 1);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200/80 flex flex-col">
      {/* Card header — matches AnalyticsCards label style */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-100">
        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider leading-none">{title}</h3>
      </div>

      {/* Chart body */}
      <div className="px-5 py-4 flex flex-col gap-3">
        {total === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">No data available</div>
        ) : (
          data.map((item, idx) => {
            const percentage = Math.round((item.value / max) * 100);
            return (
              <div key={idx} className="flex flex-col gap-1.5">
                {/* Label row — vertically centered, consistent padding */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-700 truncate leading-none">
                    {item.name.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs font-bold text-slate-900 leading-none tabular-nums flex-shrink-0">
                    {item.value}
                  </span>
                </div>
                {/* Progress bar — same left/right boundary as label */}
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full transition-all duration-700 ease-out"
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

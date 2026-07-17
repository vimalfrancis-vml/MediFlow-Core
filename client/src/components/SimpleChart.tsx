

interface SimpleChartProps {
  title: string;
  data: { name: string; value: number }[];
}

export function SimpleChart({ title, data }: SimpleChartProps) {
  const max = Math.max(...data.map(d => d.value), 1);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col h-full min-h-[250px]">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">{title}</h3>
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col h-full">
      <h3 className="text-sm font-semibold text-slate-800 mb-4">{title}</h3>
      <div className="flex-1 flex flex-col justify-end gap-3 mt-auto">
        {data.map((item, idx) => {
          const percentage = Math.round((item.value / max) * 100);
          return (
            <div key={idx} className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-slate-500">
                <span>{item.name.replace(/_/g, ' ')}</span>
                <span className="font-medium">{item.value}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-500 h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

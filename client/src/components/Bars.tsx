import type { FC } from 'react';

export interface BarItem {
  label: string;
  count: number;
  percentage: number;
  barColor?: string;
}

export interface BarsProps {
  title: string;
  items: BarItem[];
  total: number;
  emptyMessage?: string;
}

export const Bars: FC<BarsProps> = ({
  title,
  items,
  total,
  emptyMessage = 'No request data available.',
}) => {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-2xs flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <span className="text-xs font-medium text-slate-500 tabular-nums">
          {total} total
        </span>
      </div>

      {/* Bar List */}
      <div className="pt-4 flex flex-col gap-3.5">
        {items.length === 0 || total === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            {emptyMessage}
          </div>
        ) : (
          items.map((item) => {
            const barWidth = Math.min(Math.max(item.percentage, 0), 100);
            return (
              <div key={item.label} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-700 truncate">
                    {item.label}
                  </span>
                  <div className="flex items-baseline gap-2 flex-shrink-0">
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {item.percentage}%
                    </span>
                    <span className="text-xs font-semibold text-slate-900 tabular-nums min-w-[24px] text-right">
                      {item.count}
                    </span>
                  </div>
                </div>

                {/* Progress bar track */}
                <div
                  className="w-full bg-slate-100 h-2 rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuenow={item.count}
                  aria-valuemin={0}
                  aria-valuemax={total}
                  aria-label={`${item.label}: ${item.count} (${item.percentage}%)`}
                >
                  <div
                    className={`h-full rounded-full transition-all duration-300 ease-out ${
                      item.barColor || 'bg-blue-700'
                    }`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};


import type { RequestItem } from '../services/api';
import { formatDateTime } from '../utils/date';

interface AuditTimelineProps {
  logs: NonNullable<RequestItem['auditLogs']>;
}

export function AuditTimeline({ logs }: AuditTimelineProps) {
  if (!logs || logs.length === 0) {
    return (
      <div className="section-card mt-8 bg-white p-6 rounded-xl shadow-sm border border-slate-200/80">
        <h2 className="text-lg font-bold text-slate-900 mb-4 border-b border-slate-100 pb-4">Audit Timeline</h2>
        <div className="flex flex-col items-center justify-center py-6 text-center text-slate-400">
          <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium">No audit activity recorded yet.</p>
        </div>
      </div>
    );
  }

  const getIcon = (action: string) => {
    switch(action) {
      case 'CREATED':
      case 'SUBMITTED':
        return (
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
        );
      case 'APPROVED':
        return (
          <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'REJECTED':
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'RETURNED':
        return (
          <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        );
      case 'COMMENTED':
        return (
          <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        );
      case 'DOCUMENT_UPLOADED':
        return (
          <svg className="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getElapsedTime = (currentDate: Date, previousDate?: Date) => {
    if (!previousDate) return null;
    const diffMs = currentDate.getTime() - previousDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h`;
    if (diffHours > 0) return `${diffHours}h ${diffMins % 60}m`;
    if (diffMins > 0) return `${diffMins}m`;
    return 'just now';
  };

  return (
    <div className="section-card mt-8 bg-white p-6 rounded-xl shadow-sm border border-slate-200/80">
      <h2 className="text-lg font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4">Audit Timeline</h2>
      <div className="relative border-l border-slate-200 ml-3">
        {logs.map((log, index) => {
          const currentDate = new Date(log.timestamp);
          const previousDate = index > 0 ? new Date(logs[index - 1].timestamp) : undefined;
          const elapsed = getElapsedTime(currentDate, previousDate);

          return (
            <div key={log.id} className="mb-8 ml-6 relative group">
              <span className="absolute -left-9 top-1 bg-white border border-slate-200 rounded-full w-6 h-6 flex items-center justify-center group-hover:scale-110 transition-transform">
                {getIcon(log.action)}
              </span>
              <div className="flex justify-between items-start">
                <div className="text-sm flex-1 min-w-0 break-words">
                  <span className="font-semibold text-slate-900">{log.action.replace(/_/g, ' ')}</span>
                  <p className="text-slate-600 mt-1 whitespace-pre-wrap">{log.description}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <time className="block mb-1 text-xs font-normal text-slate-400">
                    {formatDateTime(log.timestamp)}
                  </time>
                  {elapsed && (
                    <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                      +{elapsed}
                    </span>
                  )}
                </div>
              </div>
              {log.actor && (
                <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px]">
                    {log.actor.firstName[0]}{log.actor.lastName[0]}
                  </div>
                  <span>{log.actor.firstName} {log.actor.lastName} ({log.actor.role.replace(/_/g, ' ')})</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

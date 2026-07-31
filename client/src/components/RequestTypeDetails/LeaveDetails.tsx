import type { RequestItem } from '../../services/api';

interface LeaveDetailsProps {
  request: RequestItem;
}

export default function LeaveDetails({ request }: LeaveDetailsProps) {
  const details = request.leaveDetail;
  if (!details) return null;

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <section className="details-section fade-in">
      <h2>Leave Application Details</h2>
      <div className="info-grid">
        <div className="info-item">
          <span className="info-label">Leave Type</span>
          <span className="info-value">{details.leaveType || '—'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Total Days</span>
          <span className="info-value">{details.totalDays ?? '—'} Day{details.totalDays !== 1 ? 's' : ''}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Start Date</span>
          <span className="info-value">{details.startDate ? formatDate(details.startDate) : '—'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">End Date</span>
          <span className="info-value">{details.endDate ? formatDate(details.endDate) : '—'}</span>
        </div>
        {details.coveringStaff && (
          <div className="info-item" style={{ gridColumn: 'span 2' }}>
            <span className="info-label">Emergency Contact</span>
            <span className="info-value">{details.coveringStaff}</span>
          </div>
        )}
        <div className="info-item" style={{ gridColumn: 'span 2' }}>
          <span className="info-label">Reason for Leave</span>
          <span className="info-value" style={{ whiteSpace: 'pre-wrap' }}>{details.reason || '—'}</span>
        </div>
      </div>
    </section>
  );
}

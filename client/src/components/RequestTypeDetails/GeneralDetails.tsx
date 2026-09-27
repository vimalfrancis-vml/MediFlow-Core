import type { RequestItem } from '../../services/api';

interface GeneralDetailsProps {
  request: RequestItem;
}

export default function GeneralDetails({ request }: GeneralDetailsProps) {
  const details = request.generalDetail;
  if (!details) return null;

  return (
    <section className="details-section fade-in">
      <h2>General Request Details</h2>
      <div className="info-grid">
        <div className="info-item" style={{ gridColumn: 'span 2' }}>
          <span className="info-label">Subject</span>
          <span className="info-value" style={{ fontWeight: 600 }}>{details.subject || request.title || '—'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Target Department</span>
          <span className="info-value">
            {details.targetDepartment?.displayName || details.targetDepartment?.name || 'All / Not Specified'}
          </span>
        </div>
        <div className="info-item">
          <span className="info-label">Assigned Recipient</span>
          <span className="info-value">
            {details.targetUser ? (
              <span>
                {details.targetUser.firstName} {details.targetUser.lastName}
                {details.targetUser.roleRef?.displayName ? ` (${details.targetUser.roleRef.displayName})` : ` (${details.targetUser.role})`}
              </span>
            ) : (
              <span className="text-slate-500 italic">Department Queue (Any Authorized Reviewer)</span>
            )}
          </span>
        </div>
        {details.requiredDate && (
          <div className="info-item">
            <span className="info-label">Required Date</span>
            <span className="info-value">{new Date(details.requiredDate).toLocaleDateString()}</span>
          </div>
        )}
        {details.endDate && (
          <div className="info-item">
            <span className="info-label">End / Return Date</span>
            <span className="info-value">{new Date(details.endDate).toLocaleDateString()}</span>
          </div>
        )}
        <div className="info-item" style={{ gridColumn: 'span 2' }}>
          <span className="info-label">Requirement &amp; Description</span>
          <span className="info-value" style={{ whiteSpace: 'pre-wrap' }}>{details.description || '—'}</span>
        </div>
      </div>
    </section>
  );
}

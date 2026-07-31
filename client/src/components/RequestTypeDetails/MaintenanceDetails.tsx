import type { RequestItem } from '../../services/api';

interface MaintenanceDetailsProps {
  request: RequestItem;
}

export default function MaintenanceDetails({ request }: MaintenanceDetailsProps) {
  const details = request.maintenanceDetail;
  if (!details) return null;

  // Deserialize issueDescription and notes
  const fullText = details.issueDescription || '';
  let description = fullText;
  let notes = '';

  if (fullText.startsWith('Issue Description:\n')) {
    const parts = fullText.split('\n\nNotes:\n');
    description = parts[0].replace('Issue Description:\n', '').trim();
    notes = parts[1] ? parts[1].trim() : '';
  }

  return (
    <section className="details-section fade-in">
      <h2>Maintenance Request Details</h2>
      <div className="info-grid">
        <div className="info-item">
          <span className="info-label">Equipment / Asset Name</span>
          <span className="info-value">{details.equipmentName || '—'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Location / Department</span>
          <span className="info-value">{details.location || '—'}</span>
        </div>
        <div className="info-item" style={{ gridColumn: 'span 2' }}>
          <span className="info-label">Urgency Level</span>
          <span className="info-value">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
              details.urgencyLevel === 'EMERGENCY' ? 'bg-red-100 text-red-850' :
              details.urgencyLevel === 'HIGH' ? 'bg-orange-100 text-orange-850' :
              details.urgencyLevel === 'NORMAL' ? 'bg-blue-100 text-blue-850' :
              'bg-slate-100 text-slate-800'
            }`}>
              {details.urgencyLevel}
            </span>
          </span>
        </div>
        <div className="info-item" style={{ gridColumn: 'span 2' }}>
          <span className="info-label">Issue Description</span>
          <span className="info-value" style={{ whiteSpace: 'pre-wrap' }}>{description || '—'}</span>
        </div>
        {notes && (
          <div className="info-item" style={{ gridColumn: 'span 2' }}>
            <span className="info-label">Notes</span>
            <span className="info-value" style={{ whiteSpace: 'pre-wrap' }}>{notes}</span>
          </div>
        )}
      </div>
    </section>
  );
}

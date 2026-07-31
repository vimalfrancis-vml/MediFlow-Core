import type { RequestItem } from '../../services/api';

interface PurchaseDetailsProps {
  request: RequestItem;
}

export default function PurchaseDetails({ request }: PurchaseDetailsProps) {
  const details = request.purchaseDetail;
  if (!details) return null;

  return (
    <section className="details-section fade-in">
      <h2>Purchase Request Details</h2>
      <div className="info-grid">
        <div className="info-item" style={{ gridColumn: 'span 2' }}>
          <span className="info-label">Item Description</span>
          <span className="info-value">{details.itemDescription || '—'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Quantity</span>
          <span className="info-value">{details.quantity ?? '—'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Estimated Cost</span>
          <span className="info-value">₹{details.estimatedCost !== undefined ? Number(details.estimatedCost).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</span>
        </div>
        {details.vendorName && (
          <div className="info-item">
            <span className="info-label">Vendor Name</span>
            <span className="info-value">{details.vendorName}</span>
          </div>
        )}
        {details.budgetCode && (
          <div className="info-item">
            <span className="info-label">Budget Code</span>
            <span className="info-value">{details.budgetCode}</span>
          </div>
        )}
        <div className="info-item" style={{ gridColumn: 'span 2' }}>
          <span className="info-label">Business Justification</span>
          <span className="info-value" style={{ whiteSpace: 'pre-wrap' }}>{details.justification || '—'}</span>
        </div>
      </div>
    </section>
  );
}

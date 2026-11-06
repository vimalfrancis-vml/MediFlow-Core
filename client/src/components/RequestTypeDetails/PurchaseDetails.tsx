import type { RequestItem } from '../../services/api';

interface PurchaseDetailsProps {
  request: RequestItem;
  className?: string;
}

export default function PurchaseDetails({ request, className = '' }: PurchaseDetailsProps) {
  const details = request.purchaseDetail;
  if (!details) return null;

  const costNum = details.estimatedCost !== undefined ? Number(details.estimatedCost) : null;
  const formattedCost = costNum !== null && !isNaN(costNum)
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(costNum)
    : '—';

  return (
    <section className={`bg-white rounded-lg border border-slate-200 shadow-2xs ${className}`} aria-labelledby="purchase-details-heading">
      {/* Standard Card Header: px-5 py-3 border-b border-slate-200 */}
      <div className="px-5 py-3 border-b border-slate-200">
        <h2 id="purchase-details-heading" className="text-sm font-semibold text-slate-900">
          Purchase Details
        </h2>
      </div>

      {/* Standard Card Body: p-5 */}
      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 text-xs">
          <div className="sm:col-span-2">
            <span className="text-xs font-medium text-slate-500 block mb-1">
              Item description
            </span>
            <span className="text-sm text-slate-900 font-medium">
              {details.itemDescription || '—'}
            </span>
          </div>

          <div>
            <span className="text-xs font-medium text-slate-500 block mb-1">
              Quantity
            </span>
            <span className="text-sm text-slate-900 tabular-nums">
              {details.quantity ?? '—'}
            </span>
          </div>

          <div>
            <span className="text-xs font-medium text-slate-500 block mb-1">
              Estimated cost
            </span>
            <span className="text-sm font-semibold text-slate-900 tabular-nums">
              {formattedCost}
            </span>
          </div>

          {details.vendorName && (
            <div>
              <span className="text-xs font-medium text-slate-500 block mb-1">
                Vendor name
              </span>
              <span className="text-sm text-slate-900">
                {details.vendorName}
              </span>
            </div>
          )}

          {details.budgetCode && (
            <div>
              <span className="text-xs font-medium text-slate-500 block mb-1">
                Budget code
              </span>
              <span className="text-sm text-slate-900 font-mono">
                {details.budgetCode}
              </span>
            </div>
          )}

          <div className="sm:col-span-2 pt-2 border-t border-slate-100">
            <span className="text-xs font-medium text-slate-500 block mb-1">
              Business justification
            </span>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {details.justification || '—'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}


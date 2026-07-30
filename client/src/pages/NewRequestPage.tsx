import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { DashboardLayout } from '../components/DashboardLayout';
import './NewRequestPage.css';

export default function NewRequestPage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [type, setType] = useState('PURCHASE');
  const [priority, setPriority] = useState('NORMAL');
  
  // Specific Details State (Purchase as example)
  const [itemDescription, setItemDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [estimatedCost, setEstimatedCost] = useState('');
  const [justification, setJustification] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (!title.trim()) {
      setError('Request title is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createRequest({
        title,
        type,
        priority,
        details: type === 'PURCHASE' ? {
          itemDescription,
          quantity: Number(quantity),
          estimatedCost: Number(estimatedCost),
          justification,
        } : undefined,
      });
      // Navigate after successful creation
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to create request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="MediFlow">
      {/* Page width constraint — same as other content pages */}
      <div className="max-w-3xl mx-auto">

        {/* Page header */}
        <div className="mb-6">
          <button
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600 mb-3 bg-transparent border-none cursor-pointer p-0 transition-colors"
            onClick={() => navigate('/dashboard')}
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create New Request</h1>
          <p className="text-sm text-slate-500 mt-1">Fill in the details below to submit a new request for approval.</p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-md text-sm font-medium text-red-700 mb-6">
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* General Information */}
            <div className="pb-6 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800 tracking-tight mb-4">General Information</h2>

              <div className="mb-4">
                <label htmlFor="title" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Request Title</label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Briefly describe your request..."
                  disabled={isSubmitting}
                  required
                  className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="type" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Request Type</label>
                  <select
                    id="type"
                    value={type}
                    onChange={e => setType(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
                  >
                    <option value="PURCHASE">Purchase Request</option>
                    <option value="MAINTENANCE">Maintenance Request</option>
                    <option value="LEAVE">Leave Application</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="priority" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Priority</label>
                  <select
                    id="priority"
                    value={priority}
                    onChange={e => setPriority(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="EMERGENCY">Emergency</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Purchase Details */}
            {type === 'PURCHASE' && (
              <div className="pb-6 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-800 tracking-tight mb-4">Purchase Details</h2>

                <div className="mb-4">
                  <label htmlFor="itemDescription" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Item Description</label>
                  <input
                    id="itemDescription"
                    type="text"
                    value={itemDescription}
                    onChange={e => setItemDescription(e.target.value)}
                    placeholder="What do you need?"
                    disabled={isSubmitting}
                    required
                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="quantity" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Quantity</label>
                    <input
                      id="quantity"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={e => setQuantity(Number(e.target.value))}
                      disabled={isSubmitting}
                      required
                      className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
                    />
                  </div>
                  <div>
                    <label htmlFor="estimatedCost" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Estimated Cost (₹)</label>
                    <input
                      id="estimatedCost"
                      type="number"
                      min="0"
                      step="0.01"
                      value={estimatedCost}
                      onChange={e => setEstimatedCost(e.target.value)}
                      disabled={isSubmitting}
                      required
                      className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="justification" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Business Justification</label>
                  <textarea
                    id="justification"
                    value={justification}
                    onChange={e => setJustification(e.target.value)}
                    placeholder="Why is this purchase necessary?"
                    disabled={isSubmitting}
                    rows={4}
                    required
                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all resize-y"
                  />
                </div>
              </div>
            )}

            {/* Form actions */}
            <div className="flex justify-end items-center gap-3">
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => navigate('/dashboard')}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}

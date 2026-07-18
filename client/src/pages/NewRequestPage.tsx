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
      <div className="new-request-page">
        <header className="page-header">
          <button className="back-btn" onClick={() => navigate('/dashboard')}>
            &larr; Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold text-slate-900 mt-2">Create New Request</h1>
        </header>

        <main className="form-container">
          {error && (
            <div className="form-error">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="request-form">
            <section className="form-section">
              <h2>General Information</h2>
              
              <div className="form-group">
                <label>Request Title</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Briefly describe your request..."
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Request Type</label>
                  <select value={type} onChange={e => setType(e.target.value)} disabled={isSubmitting}>
                    <option value="PURCHASE">Purchase Request</option>
                    <option value="MAINTENANCE">Maintenance Request</option>
                    <option value="LEAVE">Leave Application</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Priority</label>
                  <select value={priority} onChange={e => setPriority(e.target.value)} disabled={isSubmitting}>
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="EMERGENCY">Emergency</option>
                  </select>
                </div>
              </div>
            </section>

            {type === 'PURCHASE' && (
              <section className="form-section fade-in">
                <h2>Purchase Details</h2>
                
                <div className="form-group">
                  <label>Item Description</label>
                  <input 
                    type="text" 
                    value={itemDescription}
                    onChange={e => setItemDescription(e.target.value)}
                    placeholder="What do you need?"
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Quantity</label>
                    <input 
                      type="number" 
                      min="1"
                      value={quantity}
                      onChange={e => setQuantity(Number(e.target.value))}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Estimated Cost ($)</label>
                    <input 
                      type="number" 
                      min="0"
                      step="0.01"
                      value={estimatedCost}
                      onChange={e => setEstimatedCost(e.target.value)}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Business Justification</label>
                  <textarea 
                    value={justification}
                    onChange={e => setJustification(e.target.value)}
                    placeholder="Why is this purchase necessary?"
                    disabled={isSubmitting}
                    rows={4}
                    required
                  />
                </div>
              </section>
            )}

            <div className="form-actions">
              <button type="button" className="btn-cancel" onClick={() => navigate('/dashboard')} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="submit" className="btn-submit" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </main>
      </div>
    </DashboardLayout>
  );
}

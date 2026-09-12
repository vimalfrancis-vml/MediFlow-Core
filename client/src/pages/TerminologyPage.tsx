import React, { useState, useEffect } from 'react';
import { api, type TerminologyItem } from '../services/api';
import { DashboardLayout } from '../components/DashboardLayout';
import { LoadingState } from '../components/LoadingState';
import { AdminNav } from '../components/AdminNav';
import { useTerminology } from '../context/TerminologyContext';

export default function TerminologyPage() {
  const { refreshTerms } = useTerminology();
  const [terms, setTerms] = useState<TerminologyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit Modal State
  const [editingTerm, setEditingTerm] = useState<TerminologyItem | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchTerminology = async () => {
    try {
      setIsLoading(true);
      const res = await api.getTerminologies();
      setTerms(res.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load terminology');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTerminology();
  }, []);

  useEffect(() => {
    if (!editingTerm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        setEditingTerm(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingTerm, isSubmitting]);

  const handleOpenEdit = (term: TerminologyItem) => {
    setEditingTerm(term);
    setNewLabel(term.label);
    setModalError(null);
  };

  const handleSaveTerminology = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTerm) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      await api.updateTerminology(editingTerm.key, newLabel.trim());
      setSuccessMessage(`Label for "${editingTerm.key}" updated to "${newLabel.trim()}".`);
      setEditingTerm(null);
      await fetchTerminology();
      await refreshTerms();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setModalError(err.message || 'Failed to update terminology label');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group terms by category
  const categories = Array.from(new Set(terms.map((t) => t.category)));

  return (
    <DashboardLayout
      title="MediFlow"
      brandPrefix="Admin"
      nav={<AdminNav />}
    >
      <div className="terminology-page max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">System Terminology</h1>
            <p className="text-slate-500 mt-1">
              Customize display labels for request types, priorities, and workflow statuses without changing backend database enums or business rules.
            </p>
          </div>
        </div>

        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-50 text-emerald-800 text-sm font-semibold rounded-md border border-emerald-200">
            ✓ {successMessage}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm font-semibold rounded-md border border-red-200">
            ✕ {error}
          </div>
        )}

        {isLoading ? (
          <LoadingState message="Loading terminology configuration..." />
        ) : (
          <div className="space-y-6">
            {categories.map((category) => {
              const categoryTerms = terms.filter((t) => t.category === category);
              return (
                <div key={category} className="bg-white rounded-xl shadow-xs border border-slate-200/80 overflow-hidden">
                  <div className="bg-slate-50/75 px-5 py-3 border-b border-slate-200">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      {category.replace(/_/g, ' ')}
                    </h2>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {categoryTerms.map((term) => (
                      <div key={term.id} className="p-4 sm:px-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                              {term.key}
                            </span>
                            <span className="text-sm font-bold text-slate-900">→ {term.label}</span>
                          </div>
                          {term.description && (
                            <p className="text-xs text-slate-500 mt-1">{term.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleOpenEdit(term)}
                          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold transition-colors"
                        >
                          Customize
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* EDIT TERMINOLOGY MODAL */}
        {editingTerm && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
            onClick={() => { if (!isSubmitting) setEditingTerm(null); }}
          >
            <div 
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-left border border-slate-200"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="term-modal-title"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
                <div>
                  <h3 id="term-modal-title" className="text-base font-bold text-slate-900">Customize Display Label</h3>
                  <span className="text-xs font-mono font-bold text-indigo-600 uppercase">{editingTerm.key}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingTerm(null)}
                  disabled={isSubmitting}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                  aria-label="Close dialog"
                >
                  ✕
                </button>
              </div>

              {modalError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-md border border-red-200">
                  {modalError}
                </div>
              )}

              <form onSubmit={handleSaveTerminology} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Display Label <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="e.g. Commercial Requisition"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    System internal key <code className="font-mono text-indigo-600 font-bold">{editingTerm.key}</code> remains unchanged.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingTerm(null)}
                    disabled={isSubmitting}
                    className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md shadow-xs"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Label'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

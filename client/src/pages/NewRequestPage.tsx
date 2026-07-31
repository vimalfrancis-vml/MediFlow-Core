import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { DashboardLayout } from '../components/DashboardLayout';
import './NewRequestPage.css';

export default function NewRequestPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // General Request Form State
  const [title, setTitle] = useState('');
  const [type, setType] = useState('PURCHASE');
  const [priority, setPriority] = useState('NORMAL');

  // Purchase Details State
  const [itemDescription, setItemDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [estimatedCost, setEstimatedCost] = useState('');
  const [justification, setJustification] = useState('');

  // Maintenance Details State
  const [equipmentName, setEquipmentName] = useState('');
  const [location, setLocation] = useState('');
  const [urgencyLevel, setUrgencyLevel] = useState('NORMAL');
  const [issueDescription, setIssueDescription] = useState('');
  const [maintenanceNotes, setMaintenanceNotes] = useState('');

  // Leave Details State
  const [leaveType, setLeaveType] = useState('Annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [coveringStaff, setCoveringStaff] = useState(''); // Mapped to Emergency Contact

  // Helper to deserialize Maintenance description
  const deserializeMaintenance = (fullText: string) => {
    if (fullText.startsWith('Issue Description:\n')) {
      const parts = fullText.split('\n\nNotes:\n');
      const desc = parts[0].replace('Issue Description:\n', '').trim();
      const notes = parts[1] ? parts[1].trim() : '';
      return { desc, notes };
    }
    return { desc: fullText, notes: '' };
  };

  // 1. Isolated Loading Flow for Edit Mode
  useEffect(() => {
    async function loadDraftData() {
      if (!id) return;
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.getRequestById(id);
        const req = res.data;

        if (req.status !== 'DRAFT' && req.status !== 'RETURNED') {
          setError('Only draft or returned requests can be edited.');
          return;
        }

        setTitle(req.title);
        setType(req.type);
        setPriority(req.priority);

        if (req.type === 'PURCHASE' && req.purchaseDetail) {
          setItemDescription(req.purchaseDetail.itemDescription || '');
          setQuantity(req.purchaseDetail.quantity || 1);
          setEstimatedCost(req.purchaseDetail.estimatedCost?.toString() || '');
          setJustification(req.purchaseDetail.justification || '');
        } else if (req.type === 'MAINTENANCE' && req.maintenanceDetail) {
          setEquipmentName(req.maintenanceDetail.equipmentName || '');
          setLocation(req.maintenanceDetail.location || '');
          setUrgencyLevel(req.maintenanceDetail.urgencyLevel || 'NORMAL');
          
          const { desc, notes } = deserializeMaintenance(req.maintenanceDetail.issueDescription || '');
          setIssueDescription(desc);
          setMaintenanceNotes(notes);
        } else if (req.type === 'LEAVE' && req.leaveDetail) {
          setLeaveType(req.leaveDetail.leaveType || 'Annual');
          // Format Date string to YYYY-MM-DD for date input fields
          setStartDate(req.leaveDetail.startDate ? req.leaveDetail.startDate.substring(0, 10) : '');
          setEndDate(req.leaveDetail.endDate ? req.leaveDetail.endDate.substring(0, 10) : '');
          setLeaveReason(req.leaveDetail.reason || '');
          setCoveringStaff(req.leaveDetail.coveringStaff || '');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load request for editing.');
      } finally {
        setIsLoading(false);
      }
    }

    if (isEditMode) {
      loadDraftData();
    }
  }, [id, isEditMode]);

  // 2. Live calculated leave days calculation
  const calculatedDays = (() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    if (end < start) return 0;
    const diffTime = end.getTime() - start.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  })();

  // 3. Isolated Form Submission Flow
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validations with descriptive messages
    if (!title.trim()) {
      setError('Request title is required.');
      return;
    }

    let detailsPayload: any = undefined;

    if (type === 'PURCHASE') {
      if (!itemDescription.trim()) {
        setError('Item description is required.');
        return;
      }
      if (Number(quantity) <= 0) {
        setError('Quantity must be greater than zero.');
        return;
      }
      if (Number(estimatedCost) < 0) {
        setError('Estimated cost cannot be negative.');
        return;
      }
      if (!justification.trim()) {
        setError('Business justification is required.');
        return;
      }
      detailsPayload = {
        itemDescription: itemDescription.trim(),
        quantity: Number(quantity),
        estimatedCost: Number(estimatedCost),
        justification: justification.trim(),
      };
    } else if (type === 'MAINTENANCE') {
      if (!equipmentName.trim()) {
        setError('Equipment name is required.');
        return;
      }
      if (!location.trim()) {
        setError('Location is required.');
        return;
      }
      if (!issueDescription.trim()) {
        setError('Issue description is required.');
        return;
      }
      if (!['LOW', 'NORMAL', 'HIGH', 'EMERGENCY'].includes(urgencyLevel)) {
        setError('Urgency level must be Low, Normal, High, or Emergency.');
        return;
      }
      detailsPayload = {
        equipmentName: equipmentName.trim(),
        location: location.trim(),
        urgencyLevel,
        issueDescription: issueDescription.trim(),
        notes: maintenanceNotes.trim(),
      };
    } else if (type === 'LEAVE') {
      if (!leaveType.trim()) {
        setError('Leave type is required.');
        return;
      }
      if (!startDate) {
        setError('Start date is required.');
        return;
      }
      if (!endDate) {
        setError('End date is required.');
        return;
      }
      if (!leaveReason.trim()) {
        setError('Leave reason is required.');
        return;
      }
      
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end < start) {
        setError('End date cannot be before the start date.');
        return;
      }

      detailsPayload = {
        leaveType: leaveType.trim(),
        startDate,
        endDate,
        reason: leaveReason.trim(),
        coveringStaff: coveringStaff.trim() || undefined,
      };
    }

    setIsSubmitting(true);
    try {
      if (isEditMode && id) {
        await api.editRequest(id, {
          title: title.trim(),
          type,
          priority,
          details: detailsPayload,
        });
      } else {
        await api.createRequest({
          title: title.trim(),
          type,
          priority,
          details: detailsPayload,
        });
      }
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to submit request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout title="MediFlow">
        <div className="max-w-3xl mx-auto py-12 text-center text-slate-500">
          Loading request details...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="MediFlow">
      <div className="max-w-3xl mx-auto">
        {/* Page header */}
        <div className="mb-6">
          <button
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600 mb-3 bg-transparent border-none cursor-pointer p-0 transition-colors"
            onClick={() => navigate('/dashboard')}
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {isEditMode ? 'Edit Request' : 'Create New Request'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isEditMode
              ? 'Update the fields below to edit your request.'
              : 'Fill in the details below to submit a new request for approval.'}
          </p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-md text-sm font-medium text-red-700 mb-6">
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* General Information */}
            <div className="pb-6 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800 tracking-tight mb-4">General Information</h2>

              <div className="mb-4">
                <label htmlFor="title" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Request Title
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Briefly describe your request..."
                  disabled={isSubmitting}
                  required
                  className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="type" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Request Type
                  </label>
                  <select
                    id="type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    disabled={isSubmitting || isEditMode}
                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
                  >
                    <option value="PURCHASE">Purchase Request</option>
                    <option value="MAINTENANCE">Maintenance Request</option>
                    <option value="LEAVE">Leave Application</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="priority" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Priority
                  </label>
                  <select
                    id="priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
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

            {/* PURCHASE SECTION */}
            {type === 'PURCHASE' && (
              <div className="pb-6 border-b border-slate-100 fade-in">
                <h2 className="text-sm font-bold text-slate-800 tracking-tight mb-4">Purchase Details</h2>

                <div className="mb-4">
                  <label htmlFor="itemDescription" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Item Description
                  </label>
                  <input
                    id="itemDescription"
                    type="text"
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    placeholder="What do you need?"
                    disabled={isSubmitting}
                    required
                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="quantity" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Quantity
                    </label>
                    <input
                      id="quantity"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      disabled={isSubmitting}
                      required
                      className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
                    />
                  </div>
                  <div>
                    <label htmlFor="estimatedCost" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Estimated Cost (₹)
                    </label>
                    <input
                      id="estimatedCost"
                      type="number"
                      min="0"
                      step="0.01"
                      value={estimatedCost}
                      onChange={(e) => setEstimatedCost(e.target.value)}
                      disabled={isSubmitting}
                      required
                      className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="justification" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Business Justification
                  </label>
                  <textarea
                    id="justification"
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Why is this purchase necessary?"
                    disabled={isSubmitting}
                    rows={4}
                    required
                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all resize-y"
                  />
                </div>
              </div>
            )}

            {/* MAINTENANCE SECTION */}
            {type === 'MAINTENANCE' && (
              <div className="pb-6 border-b border-slate-100 fade-in">
                <h2 className="text-sm font-bold text-slate-800 tracking-tight mb-4">Maintenance Details</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="equipmentName" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Equipment / Asset Name
                    </label>
                    <input
                      id="equipmentName"
                      type="text"
                      value={equipmentName}
                      onChange={(e) => setEquipmentName(e.target.value)}
                      placeholder="e.g. ECG Machine, Patient Monitor"
                      disabled={isSubmitting}
                      required
                      className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
                    />
                  </div>
                  <div>
                    <label htmlFor="location" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Location / Department
                    </label>
                    <input
                      id="location"
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Cardiology Ward, Room 302"
                      disabled={isSubmitting}
                      required
                      className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label htmlFor="urgencyLevel" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Urgency Level
                  </label>
                  <select
                    id="urgencyLevel"
                    value={urgencyLevel}
                    onChange={(e) => setUrgencyLevel(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="EMERGENCY">Emergency</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label htmlFor="issueDescription" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Issue Description
                  </label>
                  <textarea
                    id="issueDescription"
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                    placeholder="Describe the issue or repair required in detail..."
                    disabled={isSubmitting}
                    rows={4}
                    required
                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all resize-y"
                  />
                </div>

                <div>
                  <label htmlFor="maintenanceNotes" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Optional Notes
                  </label>
                  <textarea
                    id="maintenanceNotes"
                    value={maintenanceNotes}
                    onChange={(e) => setMaintenanceNotes(e.target.value)}
                    placeholder="Any additional information..."
                    disabled={isSubmitting}
                    rows={2}
                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all resize-y"
                  />
                </div>
              </div>
            )}

            {/* LEAVE SECTION */}
            {type === 'LEAVE' && (
              <div className="pb-6 border-b border-slate-100 fade-in">
                <h2 className="text-sm font-bold text-slate-800 tracking-tight mb-4">Leave Application Details</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="leaveType" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Leave Type
                    </label>
                    <select
                      id="leaveType"
                      value={leaveType}
                      onChange={(e) => setLeaveType(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
                    >
                      <option value="Annual">Annual Leave</option>
                      <option value="Sick">Sick Leave</option>
                      <option value="Casual">Casual Leave</option>
                      <option value="Maternity">Maternity Leave</option>
                      <option value="Paternity">Paternity Leave</option>
                      <option value="Unpaid">Unpaid Leave</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Calculated Duration
                    </label>
                    <div className="w-full px-3 py-2 text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-md h-[38px] flex align-middle items-center">
                      {calculatedDays > 0 ? `${calculatedDays} Day${calculatedDays > 1 ? 's' : ''}` : '—'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="startDate" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Start Date
                    </label>
                    <input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      disabled={isSubmitting}
                      required
                      className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
                    />
                  </div>
                  <div>
                    <label htmlFor="endDate" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      End Date
                    </label>
                    <input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      disabled={isSubmitting}
                      required
                      className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label htmlFor="coveringStaff" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Emergency Contact
                  </label>
                  <input
                    id="coveringStaff"
                    type="text"
                    value={coveringStaff}
                    onChange={(e) => setCoveringStaff(e.target.value)}
                    placeholder="Name and contact details..."
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="leaveReason" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Reason for Leave
                  </label>
                  <textarea
                    id="leaveReason"
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    placeholder="Provide details of your leave request..."
                    disabled={isSubmitting}
                    rows={4}
                    required
                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all resize-y"
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
                {isSubmitting ? 'Submitting…' : isEditMode ? 'Save Changes' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}

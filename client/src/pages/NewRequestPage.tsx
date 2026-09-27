import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type DepartmentItem, type RecipientItem } from '../services/api';
import { DashboardLayout } from '../components/DashboardLayout';
import { useTerminology } from '../context/TerminologyContext';
import { useAuth } from '../context/AuthContext';
import './NewRequestPage.css';

export default function NewRequestPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { getRequestTypeLabel } = useTerminology();
  const { user } = useAuth();
  const isEditMode = !!id;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // General Request Form State
  const [title, setTitle] = useState('');
  const [type, setType] = useState('PURCHASE');
  const [priority, setPriority] = useState('NORMAL');

  // General Request Specific Details State
  const [generalSubject, setGeneralSubject] = useState('');
  const [generalDescription, setGeneralDescription] = useState('');
  const [targetDepartmentId, setTargetDepartmentId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [requiredDate, setRequiredDate] = useState('');
  const [generalEndDate, setGeneralEndDate] = useState('');

  // Recipient Directory for General Requests
  const [recipientDirectory, setRecipientDirectory] = useState<{
    departments: DepartmentItem[];
    users: RecipientItem[];
  }>({ departments: [], users: [] });

  // Purchase Details State
  const [itemDescription, setItemDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [estimatedCost, setEstimatedCost] = useState('');
  const [justification, setJustification] = useState('');

  // Maintenance Details State
  const [equipmentName, setEquipmentName] = useState('');
  const [location, setLocation] = useState('');
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
          // urgencyLevel is now derived from request priority, not a separate field
          
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
        } else if (req.type === 'GENERAL' && req.generalDetail) {
          setGeneralSubject(req.generalDetail.subject || req.title);
          setGeneralDescription(req.generalDetail.description || '');
          setTargetDepartmentId(req.generalDetail.targetDepartmentId || '');
          setTargetUserId(req.generalDetail.targetUserId || '');
          setRequiredDate(req.generalDetail.requiredDate ? req.generalDetail.requiredDate.substring(0, 10) : '');
          setGeneralEndDate(req.generalDetail.endDate ? req.generalDetail.endDate.substring(0, 10) : '');
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

  // Load Recipient Directory for General Requests
  useEffect(() => {
    async function loadDirectory() {
      try {
        const res = await api.getRecipientDirectory();
        if (res.data) {
          setRecipientDirectory(res.data);
        }
      } catch (err) {
        console.error('Failed to load recipient directory:', err);
      }
    }
    loadDirectory();
  }, []);

  // 2. Live calculated leave days calculation
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const calculatedDays = (() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    if (end < start) return 0;
    const diffTime = end.getTime() - start.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  })();

  // Filter users eligible for assignment (active, non-admin, non-self, matching target dept if selected)
  const eligibleUsers = recipientDirectory.users.filter((u) => {
    if (user && u.id === user.id) return false;
    if (targetDepartmentId && u.department?.id !== targetDepartmentId) return false;
    return true;
  });

  // 3. Isolated Form Submission Flow
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const finalTitle = (type === 'GENERAL' ? (generalSubject || title) : title).trim();

    // Client-side validations with descriptive messages
    if (!finalTitle) {
      setError(type === 'GENERAL' ? 'Subject is required.' : 'Request title is required.');
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
      // urgencyLevel is derived from the request-level priority so users
      // don't have to fill in two redundant fields that share the same enum.
      detailsPayload = {
        equipmentName: equipmentName.trim(),
        location: location.trim(),
        urgencyLevel: priority,
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

      if (startDate < todayStr) {
        setError('Leave start date cannot be in the past.');
        return;
      }

      detailsPayload = {
        leaveType: leaveType.trim(),
        startDate,
        endDate,
        reason: leaveReason.trim(),
        coveringStaff: coveringStaff.trim() || undefined,
      };
    } else if (type === 'GENERAL') {
      if (!generalDescription.trim()) {
        setError('Description / Requirement is required.');
        return;
      }
      if (!targetDepartmentId && !targetUserId) {
        setError('Please select a target department or specific recipient.');
        return;
      }
      if (targetUserId && user?.id === targetUserId) {
        setError('You cannot assign a General Request to yourself.');
        return;
      }
      if (requiredDate && generalEndDate) {
        const reqD = new Date(requiredDate);
        const endD = new Date(generalEndDate);
        if (endD < reqD) {
          setError('End / Return date cannot be before the required date.');
          return;
        }
      }

      detailsPayload = {
        subject: finalTitle,
        description: generalDescription.trim(),
        targetDepartmentId: targetDepartmentId || undefined,
        targetUserId: targetUserId || undefined,
        requiredDate: requiredDate || undefined,
        endDate: generalEndDate || undefined,
      };
    }

    setIsSubmitting(true);
    try {
      if (isEditMode && id) {
        await api.editRequest(id, {
          title: finalTitle,
          type,
          priority,
          details: detailsPayload,
        });
        navigate(`/request/${id}`, { replace: true });
      } else {
        const res = await api.createRequest({
          title: finalTitle,
          type,
          priority,
          details: detailsPayload,
        });
        const createdId = res.data?.id;
        if (createdId) {
          navigate(`/request/${createdId}`, { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create request.');
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
          <p className="text-xs text-slate-500 mb-5 font-medium">
            Fields marked with <span className="text-red-500 font-bold">*</span> are required.
          </p>

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

              {type !== 'GENERAL' && (
                <div className="mb-4">
                  <label htmlFor="title" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Request Title <span className="text-red-500 font-bold ml-0.5" title="Required">*</span>
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
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="type" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Request Type <span className="text-red-500 font-bold ml-0.5" title="Required">*</span>
                  </label>
                  <select
                    id="type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    disabled={isSubmitting || isEditMode}
                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
                  >
                    <option value="PURCHASE">{getRequestTypeLabel('PURCHASE')}</option>
                    <option value="MAINTENANCE">{getRequestTypeLabel('MAINTENANCE')}</option>
                    <option value="LEAVE">{getRequestTypeLabel('LEAVE')}</option>
                    <option value="GENERAL">{getRequestTypeLabel('GENERAL')}</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="priority" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Priority <span className="text-red-500 font-bold ml-0.5" title="Required">*</span>
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
                    Item Description <span className="text-red-500 font-bold ml-0.5" title="Required">*</span>
                  </label>
                  <input
                    id="itemDescription"
                    type="text"
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    placeholder="e.g. Surgical Gloves, ECG Paper Roll"
                    disabled={isSubmitting}
                    required
                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="quantity" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Quantity <span className="text-red-500 font-bold ml-0.5" title="Required">*</span>
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
                      Estimated Cost (₹) <span className="text-red-500 font-bold ml-0.5" title="Required">*</span>
                    </label>
                    <input
                      id="estimatedCost"
                      type="number"
                      min="1"
                      step="0.01"
                      value={estimatedCost}
                      onChange={(e) => setEstimatedCost(e.target.value)}
                      disabled={isSubmitting}
                      required
                      className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
                    />
                  </div>

                  {Number(estimatedCost) > 100000 && (
                    <div className="col-span-1 sm:col-span-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-950 text-xs flex items-start gap-2.5">
                      <span className="font-bold text-emerald-700 text-sm">₹</span>
                      <div>
                        <span className="font-bold text-emerald-900">Hospital Finance Policy:</span> Because this purchase exceeds ₹1,00,000, Jubilee Hospital governance automatically requires mandatory Finance clearance as Step 1 before departmental review.
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="justification" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Business Justification <span className="text-red-500 font-bold ml-0.5" title="Required">*</span>
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
                      Equipment / Asset Name <span className="text-red-500 font-bold ml-0.5" title="Required">*</span>
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
                      Location / Department <span className="text-red-500 font-bold ml-0.5" title="Required">*</span>
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

                {/* Urgency Level is automatically derived from the request Priority field above.
                    No separate input is needed — this avoids the duplicate field the user review flagged. */}

                <div className="mb-4">
                  <label htmlFor="issueDescription" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Issue Description <span className="text-red-500 font-bold ml-0.5" title="Required">*</span>
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
                      Leave Type <span className="text-red-500 font-bold ml-0.5" title="Required">*</span>
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
                      Start Date <span className="text-red-500 font-bold ml-0.5" title="Required">*</span>
                    </label>
                    <input
                      id="startDate"
                      type="date"
                      min={todayStr}
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      disabled={isSubmitting}
                      required
                      className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
                    />
                  </div>
                  <div>
                    <label htmlFor="endDate" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      End Date <span className="text-red-500 font-bold ml-0.5" title="Required">*</span>
                    </label>
                    <input
                      id="endDate"
                      type="date"
                      min={startDate || todayStr}
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
                    Reason for Leave <span className="text-red-500 font-bold ml-0.5" title="Required">*</span>
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

            {/* GENERAL SECTION */}
            {type === 'GENERAL' && (
              <div className="pb-6 border-b border-slate-100 fade-in">
                <h2 className="text-sm font-bold text-slate-800 tracking-tight mb-4">General Request Details</h2>

                <div className="mb-4">
                  <label htmlFor="generalSubject" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Subject <span className="text-red-500 font-bold ml-0.5" title="Required">*</span>
                  </label>
                  <input
                    id="generalSubject"
                    type="text"
                    value={generalSubject || title}
                    onChange={(e) => {
                      setGeneralSubject(e.target.value);
                      setTitle(e.target.value);
                    }}
                    placeholder="e.g. 3 HD Cameras for 3-Day Workshop Rental"
                    disabled={isSubmitting}
                    required
                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="targetDepartment" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Target Department
                    </label>
                    <select
                      id="targetDepartment"
                      value={targetDepartmentId}
                      onChange={(e) => {
                        const newDeptId = e.target.value;
                        setTargetDepartmentId(newDeptId);
                        if (targetUserId) {
                          const selectedUser = recipientDirectory.users.find((u) => u.id === targetUserId);
                          if (newDeptId && selectedUser?.department?.id !== newDeptId) {
                            setTargetUserId('');
                          }
                        }
                      }}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
                    >
                      <option value="">Select Target Department...</option>
                      {recipientDirectory.departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.displayName || dept.name} ({dept.code})
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Target department queue for processing this operational request.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="targetUser" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Specific Recipient (Optional)
                    </label>
                    <select
                      id="targetUser"
                      value={targetUserId}
                      onChange={(e) => {
                        const newUserId = e.target.value;
                        setTargetUserId(newUserId);
                        if (newUserId) {
                          const foundUser = recipientDirectory.users.find((u) => u.id === newUserId);
                          if (foundUser?.department?.id) {
                            setTargetDepartmentId(foundUser.department.id);
                          }
                        }
                      }}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
                    >
                      <option value="">Department Queue (Any Authorized Personnel)</option>
                      {eligibleUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.firstName} {u.lastName} — {u.roleRef?.displayName || u.role} ({u.department?.displayName || u.department?.name || 'Staff'})
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Directly assigns to this person. Cannot assign to yourself.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="requiredDate" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Required Date (Optional)
                    </label>
                    <input
                      id="requiredDate"
                      type="date"
                      value={requiredDate}
                      onChange={(e) => setRequiredDate(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
                    />
                  </div>
                  <div>
                    <label htmlFor="generalEndDate" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      End / Return Date (Optional)
                    </label>
                    <input
                      id="generalEndDate"
                      type="date"
                      min={requiredDate || undefined}
                      value={generalEndDate}
                      onChange={(e) => setGeneralEndDate(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label htmlFor="generalDescription" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Description / Requirement <span className="text-red-500 font-bold ml-0.5" title="Required">*</span>
                  </label>
                  <textarea
                    id="generalDescription"
                    value={generalDescription}
                    onChange={(e) => setGeneralDescription(e.target.value)}
                    placeholder="Provide full requirement details, e.g. item specifications, purpose, rental terms..."
                    disabled={isSubmitting}
                    rows={4}
                    required
                    className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all resize-y"
                  />
                </div>

                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-lg text-xs text-indigo-900 flex items-start gap-2.5">
                  <span className="font-bold text-indigo-600 text-sm">📎</span>
                  <div>
                    <span className="font-bold text-indigo-950">Supporting Documents &amp; Attachments:</span> Supporting specifications, rental estimates, or invoices can be attached directly from the Request Details page upon saving.
                  </div>
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
                {isSubmitting ? 'Saving…' : isEditMode ? 'Save Changes' : 'Create Request (Draft)'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}

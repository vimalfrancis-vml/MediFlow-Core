import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type DepartmentItem, type RecipientItem, type AttachmentItem } from '../services/api';
import { DashboardLayout } from '../components/DashboardLayout';
import { useTerminology } from '../context/TerminologyContext';
import { useAuth } from '../context/AuthContext';
import { NOTIFICATIONS_REFRESH_EVENT } from '../constants/notifications';
import './NewRequestPage.css';

interface FormErrors {
  title?: string;
  itemDescription?: string;
  quantity?: string;
  estimatedCost?: string;
  justification?: string;
  equipmentName?: string;
  location?: string;
  issueDescription?: string;
  leaveType?: string;
  startDate?: string;
  endDate?: string;
  leaveReason?: string;
  generalSubject?: string;
  generalDescription?: string;
  targetSelection?: string;
  generalEndDate?: string;
}

export default function NewRequestPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { getRequestTypeLabel } = useTerminology();
  const { user } = useAuth();
  const isEditMode = Boolean(id);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<'draft' | 'submit' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);

  // Field touched tracking for onBlur validation
  const [touched, setTouched] = useState<Record<string, boolean>>({});

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
  const [quantity, setQuantity] = useState<number | string>(1);
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
  const [coveringStaff, setCoveringStaff] = useState('');

  // Queued File Attachments State (for new upload)
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  // Existing Attachments State (for edit mode)
  const [existingAttachments, setExistingAttachments] = useState<AttachmentItem[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

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
      setTopError(null);
      try {
        const res = await api.getRequestById(id);
        const req = res.data;

        if (req.status !== 'DRAFT' && req.status !== 'RETURNED') {
          setTopError('Only draft or returned requests can be edited.');
          return;
        }

        setTitle(req.title || '');
        setType(req.type);
        setPriority(req.priority || 'NORMAL');

        if (req.type === 'PURCHASE' && req.purchaseDetail) {
          setItemDescription(req.purchaseDetail.itemDescription || '');
          setQuantity(req.purchaseDetail.quantity || 1);
          setEstimatedCost(req.purchaseDetail.estimatedCost?.toString() || '');
          setJustification(req.purchaseDetail.justification || '');
        } else if (req.type === 'MAINTENANCE' && req.maintenanceDetail) {
          setEquipmentName(req.maintenanceDetail.equipmentName || '');
          setLocation(req.maintenanceDetail.location || '');
          const { desc, notes } = deserializeMaintenance(req.maintenanceDetail.issueDescription || '');
          setIssueDescription(desc);
          setMaintenanceNotes(notes);
        } else if (req.type === 'LEAVE' && req.leaveDetail) {
          setLeaveType(req.leaveDetail.leaveType || 'Annual');
          setStartDate(req.leaveDetail.startDate ? req.leaveDetail.startDate.substring(0, 10) : '');
          setEndDate(req.leaveDetail.endDate ? req.leaveDetail.endDate.substring(0, 10) : '');
          setLeaveReason(req.leaveDetail.reason || '');
          setCoveringStaff(req.leaveDetail.coveringStaff || '');
        } else if (req.type === 'GENERAL' && req.generalDetail) {
          setGeneralSubject(req.generalDetail.subject || req.title || '');
          setGeneralDescription(req.generalDetail.description || '');
          setTargetDepartmentId(req.generalDetail.targetDepartmentId || '');
          setTargetUserId(req.generalDetail.targetUserId || '');
          setRequiredDate(req.generalDetail.requiredDate ? req.generalDetail.requiredDate.substring(0, 10) : '');
          setGeneralEndDate(req.generalDetail.endDate ? req.generalDetail.endDate.substring(0, 10) : '');
        }

        // Load any existing attachments
        try {
          const attRes = await api.getAttachments(id);
          if (attRes.data) {
            setExistingAttachments(attRes.data);
          }
        } catch {
          // attachments optional
        }
      } catch (err: any) {
        setTopError(err.message || 'Failed to load request for editing.');
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

  // Live calculated leave days calculation
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

  // Filter users eligible for assignment (active, non-self, matching target dept if selected)
  const eligibleUsers = recipientDirectory.users.filter((u) => {
    if (user && u.id === user.id) return false;
    if (targetDepartmentId && u.department?.id !== targetDepartmentId) return false;
    return true;
  });

  // Mark field as touched on blur
  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  // Compute validation errors
  const computeErrors = (): FormErrors => {
    const errs: FormErrors = {};

    if (type !== 'GENERAL') {
      if (!title.trim()) {
        errs.title = 'Request title is required.';
      }
    }

    if (type === 'PURCHASE') {
      if (!itemDescription.trim()) {
        errs.itemDescription = 'Item description is required.';
      }
      if (!quantity || Number(quantity) <= 0) {
        errs.quantity = 'Quantity must be at least 1.';
      }
      if (!estimatedCost || isNaN(Number(estimatedCost)) || Number(estimatedCost) <= 0) {
        errs.estimatedCost = 'Estimated cost must be greater than zero.';
      }
      if (!justification.trim()) {
        errs.justification = 'Business justification is required.';
      }
    } else if (type === 'MAINTENANCE') {
      if (!equipmentName.trim()) {
        errs.equipmentName = 'Equipment or asset name is required.';
      }
      if (!location.trim()) {
        errs.location = 'Location or ward is required.';
      }
      if (!issueDescription.trim()) {
        errs.issueDescription = 'Detailed issue description is required.';
      }
    } else if (type === 'LEAVE') {
      if (!leaveType.trim()) {
        errs.leaveType = 'Please select a leave type.';
      }
      if (!startDate) {
        errs.startDate = 'Start date is required.';
      } else if (startDate < todayStr) {
        errs.startDate = 'Leave start date cannot be in the past.';
      }

      if (!endDate) {
        errs.endDate = 'End date is required.';
      } else if (startDate && endDate < startDate) {
        errs.endDate = 'End date cannot be earlier than start date.';
      }

      if (!leaveReason.trim()) {
        errs.leaveReason = 'Reason for leave is required.';
      }
    } else if (type === 'GENERAL') {
      if (!generalSubject.trim() && !title.trim()) {
        errs.generalSubject = 'Subject is required.';
      }
      if (!generalDescription.trim()) {
        errs.generalDescription = 'Requirement description is required.';
      }
      if (!targetDepartmentId && !targetUserId) {
        errs.targetSelection = 'Please select either a target department or specific recipient.';
      }
      if (targetUserId && user?.id === targetUserId) {
        errs.targetSelection = 'You cannot assign a General Request to yourself.';
      }
      if (requiredDate && generalEndDate) {
        if (new Date(generalEndDate) < new Date(requiredDate)) {
          errs.generalEndDate = 'End/return date cannot be before the required date.';
        }
      }
    }

    return errs;
  };

  const formErrors = computeErrors();

  // Mark all fields relevant to current type as touched
  const touchAllFields = () => {
    const allTouched: Record<string, boolean> = { title: true };
    if (type === 'PURCHASE') {
      allTouched.itemDescription = true;
      allTouched.quantity = true;
      allTouched.estimatedCost = true;
      allTouched.justification = true;
    } else if (type === 'MAINTENANCE') {
      allTouched.equipmentName = true;
      allTouched.location = true;
      allTouched.issueDescription = true;
    } else if (type === 'LEAVE') {
      allTouched.leaveType = true;
      allTouched.startDate = true;
      allTouched.endDate = true;
      allTouched.leaveReason = true;
    } else if (type === 'GENERAL') {
      allTouched.generalSubject = true;
      allTouched.generalDescription = true;
      allTouched.targetDepartment = true;
      allTouched.targetUser = true;
      allTouched.targetSelection = true;
      allTouched.generalEndDate = true;
    }
    setTouched(allTouched);
  };

  // File selection handling
  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setAttachmentError(null);

    const allowed = ['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv'];
    const maxBytes = 10 * 1024 * 1024; // 10MB
    const valid: File[] = [];
    const errors: string[] = [];

    Array.from(files).forEach((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!allowed.includes(ext)) {
        errors.push(`"${file.name}" has an unsupported format (.${ext}).`);
      } else if (file.size > maxBytes) {
        errors.push(`"${file.name}" exceeds 10MB limit.`);
      } else {
        valid.push(file);
      }
    });

    if (errors.length > 0) {
      setAttachmentError(errors.join(' '));
    }
    if (valid.length > 0) {
      setQueuedFiles((prev) => [...prev, ...valid]);
    }
    e.target.value = '';
  };

  const handleRemoveQueuedFile = (index: number) => {
    setQueuedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeleteExistingAttachment = async (attachmentId: string) => {
    if (!id) return;
    try {
      await api.deleteAttachment(id, attachmentId);
      setExistingAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch (err: any) {
      setAttachmentError(err.message || 'Failed to remove attachment.');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['pdf'].includes(ext)) return '📄';
    if (['png', 'jpg', 'jpeg'].includes(ext)) return '🖼️';
    if (['doc', 'docx'].includes(ext)) return '📝';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
    return '📎';
  };

  // Build Payload
  const buildDetailsPayload = () => {
    const finalTitle = (type === 'GENERAL' ? (generalSubject || title) : title).trim();

    if (type === 'PURCHASE') {
      return {
        itemDescription: itemDescription.trim(),
        quantity: Number(quantity),
        estimatedCost: Number(estimatedCost),
        justification: justification.trim(),
      };
    }
    if (type === 'MAINTENANCE') {
      return {
        equipmentName: equipmentName.trim(),
        location: location.trim(),
        urgencyLevel: priority,
        issueDescription: issueDescription.trim(),
        notes: maintenanceNotes.trim(),
      };
    }
    if (type === 'LEAVE') {
      return {
        leaveType: leaveType.trim(),
        startDate,
        endDate,
        reason: leaveReason.trim(),
        coveringStaff: coveringStaff.trim() || undefined,
      };
    }
    if (type === 'GENERAL') {
      return {
        subject: finalTitle,
        description: generalDescription.trim(),
        targetDepartmentId: targetDepartmentId || undefined,
        targetUserId: targetUserId || undefined,
        requiredDate: requiredDate || undefined,
        endDate: generalEndDate || undefined,
      };
    }
    return undefined;
  };

  // Main Submit & Save Handler
  const processForm = async (action: 'draft' | 'submit') => {
    setTopError(null);
    setAttachmentError(null);
    touchAllFields();

    // Check errors
    const errs = computeErrors();
    const hasErrors = Object.keys(errs).length > 0;

    if (hasErrors) {
      setTopError('Please correct the highlighted errors before proceeding.');
      // Scroll to top of card smoothly
      window.scrollTo({ top: 120, behavior: 'smooth' });
      return;
    }

    const finalTitle = (type === 'GENERAL' ? (generalSubject || title) : title).trim();
    const detailsPayload = buildDetailsPayload();

    setIsSubmitting(true);
    setSubmittingAction(action);

    try {
      let targetRequestId = id;

      if (isEditMode && id) {
        await api.editRequest(id, {
          title: finalTitle,
          type,
          priority,
          details: detailsPayload,
        });
      } else {
        const createRes = await api.createRequest({
          title: finalTitle,
          type,
          priority,
          details: detailsPayload,
        });
        targetRequestId = createRes.data?.id;
      }

      if (!targetRequestId) {
        throw new Error('Failed to obtain reference ID for the created request.');
      }

      // Upload any queued attachments
      if (queuedFiles.length > 0) {
        for (const file of queuedFiles) {
          try {
            await api.uploadAttachment(targetRequestId, file);
          } catch (uploadErr: any) {
            console.error(`Attachment upload failed for "${file.name}":`, uploadErr);
          }
        }
      }

      // If action is submit for approval, trigger workflow initiation
      if (action === 'submit') {
        await api.submitRequest(targetRequestId);
        window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
      }

      // Navigate to request details
      navigate(`/request/${targetRequestId}`, { replace: true });
    } catch (err: any) {
      setTopError(err.message || 'Operation failed. Please review your entries and try again.');
    } finally {
      setIsSubmitting(false);
      setSubmittingAction(null);
    }
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    processForm('submit');
  };

  // Visual helper for input styling
  const getInputClass = (fieldName: keyof FormErrors, extra = '') => {
    const isInvalid = Boolean(touched[fieldName] && formErrors[fieldName]);
    return `w-full h-[38px] px-3 bg-white border ${
      isInvalid
        ? 'border-rose-400 focus:border-rose-600 focus:ring-2 focus:ring-rose-500/15'
        : 'border-slate-300 focus:border-[#2457A7] focus:ring-2 focus:ring-[#2457A7]/15'
    } rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all duration-150 ${extra}`;
  };

  const getTextareaClass = (fieldName: keyof FormErrors, extra = '') => {
    const isInvalid = Boolean(touched[fieldName] && formErrors[fieldName]);
    return `w-full px-3 py-2.5 bg-white border ${
      isInvalid
        ? 'border-rose-400 focus:border-rose-600 focus:ring-2 focus:ring-rose-500/15'
        : 'border-slate-300 focus:border-[#2457A7] focus:ring-2 focus:ring-[#2457A7]/15'
    } rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all duration-150 resize-y ${extra}`;
  };

  const renderFieldError = (fieldName: keyof FormErrors) => {
    if (touched[fieldName] && formErrors[fieldName]) {
      return (
        <p className="text-xs text-rose-600 mt-1 font-medium flex items-center gap-1" role="alert">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{formErrors[fieldName]}</span>
        </p>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <DashboardLayout title="E-Office">
        <div className="max-w-4xl mx-auto py-16 text-center">
          <div className="w-8 h-8 border-3 border-[#2457A7]/20 border-t-[#2457A7] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Loading request details...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="E-Office">
      <div className="max-w-4xl mx-auto">
        {/* Navigation Breadcrumb / Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#2457A7] mb-2 bg-transparent border-none cursor-pointer p-0 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2457A7]"
              onClick={() => navigate(isEditMode && id ? `/request/${id}` : '/dashboard')}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span>{isEditMode ? 'Back to Request Details' : 'Back to Dashboard'}</span>
            </button>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {isEditMode ? 'Edit Request' : 'Create New Request'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {isEditMode
                ? 'Update the requisition details below to save changes or resubmit.'
                : 'Fill in the details below to submit a requisition for departmental review and authorization.'}
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs text-slate-400">Jubilee Hospital e-OFFICE</span>
          </div>
        </div>

        {/* Top Validation Error Banner */}
        {topError && (
          <div className="flex items-start gap-2.5 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-sm font-medium text-rose-800 mb-6 shadow-2xs" role="alert">
            <svg className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className="font-semibold text-rose-900">Unable to proceed</p>
              <p className="text-xs text-rose-700 mt-0.5">{topError}</p>
            </div>
          </div>
        )}

        {/* Form Container Card */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <form onSubmit={handleFormSubmit} noValidate>
            {/* 1. Request Classification Section */}
            <div className="p-5 sm:p-7 border-b border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#2457A7]" aria-hidden="true" />
                  Request Classification
                </h2>
                <span className="text-[11px] font-medium text-slate-400">
                  <span className="text-rose-500 font-bold">*</span> Mandatory fields
                </span>
              </div>

              {/* Request Title (for Purchase, Maintenance, Leave) */}
              {type !== 'GENERAL' && (
                <div className="mb-4">
                  <label htmlFor="request-title" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Request Title <span className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="request-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => handleBlur('title')}
                    placeholder="Brief summary of your request (e.g., Annual Supply of Surgical Gloves)"
                    disabled={isSubmitting}
                    className={getInputClass('title')}
                    aria-required="true"
                    aria-invalid={Boolean(touched.title && formErrors.title)}
                  />
                  {renderFieldError('title')}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Request Type */}
                <div>
                  <label htmlFor="request-type" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Request Type <span className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="request-type"
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      disabled={isSubmitting || isEditMode}
                      className="w-full h-[38px] appearance-none bg-white border border-slate-300 rounded-lg pl-3 pr-8 text-sm text-slate-800 focus:outline-none focus:border-[#2457A7] focus:ring-2 focus:ring-[#2457A7]/15 disabled:bg-slate-50 disabled:text-slate-500 cursor-pointer transition-all duration-150"
                    >
                      <option value="PURCHASE">{getRequestTypeLabel('PURCHASE')}</option>
                      <option value="MAINTENANCE">{getRequestTypeLabel('MAINTENANCE')}</option>
                      <option value="LEAVE">{getRequestTypeLabel('LEAVE')}</option>
                      <option value="GENERAL">{getRequestTypeLabel('GENERAL')}</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  {isEditMode && (
                    <p className="text-[11px] text-slate-400 mt-1">Request type cannot be changed once created.</p>
                  )}
                </div>

                {/* Priority */}
                <div>
                  <label htmlFor="request-priority" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Priority Level <span className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="request-priority"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full h-[38px] appearance-none bg-white border border-slate-300 rounded-lg pl-3 pr-8 text-sm text-slate-800 focus:outline-none focus:border-[#2457A7] focus:ring-2 focus:ring-[#2457A7]/15 cursor-pointer transition-all duration-150"
                    >
                      <option value="LOW">Low — Routine Non-Urgent</option>
                      <option value="NORMAL">Normal — Standard Workflow</option>
                      <option value="HIGH">High — Priority Attention</option>
                      <option value="EMERGENCY">Emergency — Critical Action Required</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Category-Specific Fields Section */}

            {/* PURCHASE SECTION */}
            {type === 'PURCHASE' && (
              <div className="p-5 sm:p-7 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" aria-hidden="true" />
                  Purchase Procurement Details
                </h2>

                <div className="mb-4">
                  <label htmlFor="purchase-itemDescription" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Item Description <span className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="purchase-itemDescription"
                    type="text"
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    onBlur={() => handleBlur('itemDescription')}
                    placeholder="e.g. Sterile Latex Gloves (Medium), ECG Thermal Paper Roll"
                    disabled={isSubmitting}
                    className={getInputClass('itemDescription')}
                    aria-required="true"
                  />
                  {renderFieldError('itemDescription')}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="purchase-quantity" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Quantity <span className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="purchase-quantity"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      onBlur={() => handleBlur('quantity')}
                      disabled={isSubmitting}
                      className={getInputClass('quantity')}
                      aria-required="true"
                    />
                    {renderFieldError('quantity')}
                  </div>

                  <div>
                    <label htmlFor="purchase-estimatedCost" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Estimated Cost (₹) <span className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="purchase-estimatedCost"
                      type="number"
                      min="1"
                      step="0.01"
                      value={estimatedCost}
                      onChange={(e) => setEstimatedCost(e.target.value)}
                      onBlur={() => handleBlur('estimatedCost')}
                      placeholder="0.00"
                      disabled={isSubmitting}
                      className={getInputClass('estimatedCost')}
                      aria-required="true"
                    />
                    {renderFieldError('estimatedCost')}
                  </div>
                </div>

                {/* Jubilee Finance Policy Flag */}
                {Number(estimatedCost) > 100000 && (
                  <div className="mb-4 p-3.5 bg-emerald-50/80 border border-emerald-200/90 rounded-xl text-emerald-950 text-xs flex items-start gap-2.5">
                    <span className="font-bold text-emerald-700 text-sm leading-none mt-0.5">₹</span>
                    <div>
                      <span className="font-bold text-emerald-900">Hospital Finance Policy:</span> Because this capital procurement exceeds ₹1,00,000, Jubilee Hospital governance automatically routes this request to the Finance Department for Step-1 clearance before final departmental review.
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="purchase-justification" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Business / Clinical Justification <span className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</span>
                  </label>
                  <textarea
                    id="purchase-justification"
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    onBlur={() => handleBlur('justification')}
                    placeholder="Describe the clinical necessity, usage forecast, or departmental requirement..."
                    disabled={isSubmitting}
                    rows={3}
                    className={getTextareaClass('justification')}
                    aria-required="true"
                  />
                  {renderFieldError('justification')}
                </div>
              </div>
            )}

            {/* MAINTENANCE SECTION */}
            {type === 'MAINTENANCE' && (
              <div className="p-5 sm:p-7 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 rounded-full bg-amber-600" aria-hidden="true" />
                  Maintenance &amp; Repair Details
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="maint-equipmentName" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Equipment / Asset Name <span className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="maint-equipmentName"
                      type="text"
                      value={equipmentName}
                      onChange={(e) => setEquipmentName(e.target.value)}
                      onBlur={() => handleBlur('equipmentName')}
                      placeholder="e.g. Philips Patient Monitor, GE Ultrasound Probe"
                      disabled={isSubmitting}
                      className={getInputClass('equipmentName')}
                      aria-required="true"
                    />
                    {renderFieldError('equipmentName')}
                  </div>

                  <div>
                    <label htmlFor="maint-location" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Location / Ward / Room <span className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="maint-location"
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      onBlur={() => handleBlur('location')}
                      placeholder="e.g. ICU Block B, Room 304, OT-2"
                      disabled={isSubmitting}
                      className={getInputClass('location')}
                      aria-required="true"
                    />
                    {renderFieldError('location')}
                  </div>
                </div>

                <div className="mb-4">
                  <label htmlFor="maint-issueDescription" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Issue Description <span className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</span>
                  </label>
                  <textarea
                    id="maint-issueDescription"
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                    onBlur={() => handleBlur('issueDescription')}
                    placeholder="Describe the malfunction, error code, or repair requested in detail..."
                    disabled={isSubmitting}
                    rows={3}
                    className={getTextareaClass('issueDescription')}
                    aria-required="true"
                  />
                  {renderFieldError('issueDescription')}
                </div>

                <div>
                  <label htmlFor="maint-notes" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    id="maint-notes"
                    value={maintenanceNotes}
                    onChange={(e) => setMaintenanceNotes(e.target.value)}
                    placeholder="Any safety precautions, manufacturer warranty details, or vendor contacts..."
                    disabled={isSubmitting}
                    rows={2}
                    className={getTextareaClass('issueDescription', 'border-slate-300')}
                  />
                </div>
              </div>
            )}

            {/* LEAVE SECTION */}
            {type === 'LEAVE' && (
              <div className="p-5 sm:p-7 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 rounded-full bg-blue-600" aria-hidden="true" />
                  Leave Application Details
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="leave-type" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Leave Type <span className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</span>
                    </label>
                    <div className="relative">
                      <select
                        id="leave-type"
                        value={leaveType}
                        onChange={(e) => setLeaveType(e.target.value)}
                        onBlur={() => handleBlur('leaveType')}
                        disabled={isSubmitting}
                        className="w-full h-[38px] appearance-none bg-white border border-slate-300 rounded-lg pl-3 pr-8 text-sm text-slate-800 focus:outline-none focus:border-[#2457A7] focus:ring-2 focus:ring-[#2457A7]/15 cursor-pointer transition-all duration-150"
                      >
                        <option value="Annual">Annual Leave</option>
                        <option value="Sick">Sick / Medical Leave</option>
                        <option value="Casual">Casual Leave</option>
                        <option value="Maternity">Maternity Leave</option>
                        <option value="Paternity">Paternity Leave</option>
                        <option value="Unpaid">Unpaid Leave</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    {renderFieldError('leaveType')}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Calculated Duration
                    </label>
                    <div className="w-full h-[38px] px-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center text-sm font-semibold text-slate-700">
                      {calculatedDays > 0 ? (
                        <span className="text-[#2457A7] flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#2457A7]" />
                          {calculatedDays} {calculatedDays === 1 ? 'Calendar Day' : 'Calendar Days'}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">Select start and end dates</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="leave-startDate" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Start Date <span className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="leave-startDate"
                      type="date"
                      min={todayStr}
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      onBlur={() => handleBlur('startDate')}
                      disabled={isSubmitting}
                      className={getInputClass('startDate')}
                      aria-required="true"
                    />
                    {renderFieldError('startDate')}
                  </div>

                  <div>
                    <label htmlFor="leave-endDate" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      End Date <span className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="leave-endDate"
                      type="date"
                      min={startDate || todayStr}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      onBlur={() => handleBlur('endDate')}
                      disabled={isSubmitting}
                      className={getInputClass('endDate')}
                      aria-required="true"
                    />
                    {renderFieldError('endDate')}
                  </div>
                </div>

                <div className="mb-4">
                  <label htmlFor="leave-coveringStaff" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Covering Staff / Emergency Contact (Optional)
                  </label>
                  <input
                    id="leave-coveringStaff"
                    type="text"
                    value={coveringStaff}
                    onChange={(e) => setCoveringStaff(e.target.value)}
                    placeholder="Name and contact phone number of covering colleague"
                    disabled={isSubmitting}
                    className={getInputClass('title', 'border-slate-300')}
                  />
                </div>

                <div>
                  <label htmlFor="leave-reason" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Reason for Leave <span className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</span>
                  </label>
                  <textarea
                    id="leave-reason"
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    onBlur={() => handleBlur('leaveReason')}
                    placeholder="Provide details regarding the nature of the leave request..."
                    disabled={isSubmitting}
                    rows={3}
                    className={getTextareaClass('leaveReason')}
                    aria-required="true"
                  />
                  {renderFieldError('leaveReason')}
                </div>
              </div>
            )}

            {/* GENERAL SECTION */}
            {type === 'GENERAL' && (
              <div className="p-5 sm:p-7 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 rounded-full bg-slate-700" aria-hidden="true" />
                  General Requisition Details
                </h2>

                <div className="mb-4">
                  <label htmlFor="gen-subject" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Subject <span className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="gen-subject"
                    type="text"
                    value={generalSubject || title}
                    onChange={(e) => {
                      setGeneralSubject(e.target.value);
                      setTitle(e.target.value);
                    }}
                    onBlur={() => handleBlur('generalSubject')}
                    placeholder="e.g. Request for Audio/Visual Equipment for CME Seminar"
                    disabled={isSubmitting}
                    className={getInputClass('generalSubject')}
                    aria-required="true"
                  />
                  {renderFieldError('generalSubject')}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="gen-targetDept" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Target Department
                    </label>
                    <div className="relative">
                      <select
                        id="gen-targetDept"
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
                        onBlur={() => handleBlur('targetSelection')}
                        disabled={isSubmitting}
                        className="w-full h-[38px] appearance-none bg-white border border-slate-300 rounded-lg pl-3 pr-8 text-sm text-slate-800 focus:outline-none focus:border-[#2457A7] focus:ring-2 focus:ring-[#2457A7]/15 cursor-pointer transition-all duration-150"
                      >
                        <option value="">Select Target Department...</option>
                        {recipientDirectory.departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.displayName || dept.name} ({dept.code})
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Department queue responsible for processing this request.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="gen-targetUser" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Specific Recipient (Optional)
                    </label>
                    <div className="relative">
                      <select
                        id="gen-targetUser"
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
                        onBlur={() => handleBlur('targetSelection')}
                        disabled={isSubmitting}
                        className="w-full h-[38px] appearance-none bg-white border border-slate-300 rounded-lg pl-3 pr-8 text-sm text-slate-800 focus:outline-none focus:border-[#2457A7] focus:ring-2 focus:ring-[#2457A7]/15 cursor-pointer transition-all duration-150"
                      >
                        <option value="">Department Queue (Any Authorized Personnel)</option>
                        {eligibleUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.firstName} {u.lastName} — {u.roleRef?.displayName || u.role} ({u.department?.displayName || u.department?.name || 'Staff'})
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Direct individual assignment. You cannot assign to yourself.
                    </p>
                  </div>
                </div>

                {renderFieldError('targetSelection')}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="gen-requiredDate" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Required Date (Optional)
                    </label>
                    <input
                      id="gen-requiredDate"
                      type="date"
                      value={requiredDate}
                      onChange={(e) => setRequiredDate(e.target.value)}
                      disabled={isSubmitting}
                      className={getInputClass('title', 'border-slate-300')}
                    />
                  </div>
                  <div>
                    <label htmlFor="gen-endDate" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      End / Return Date (Optional)
                    </label>
                    <input
                      id="gen-endDate"
                      type="date"
                      min={requiredDate || undefined}
                      value={generalEndDate}
                      onChange={(e) => setGeneralEndDate(e.target.value)}
                      onBlur={() => handleBlur('generalEndDate')}
                      disabled={isSubmitting}
                      className={getInputClass('generalEndDate')}
                    />
                    {renderFieldError('generalEndDate')}
                  </div>
                </div>

                <div>
                  <label htmlFor="gen-description" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Description &amp; Specifications <span className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</span>
                  </label>
                  <textarea
                    id="gen-description"
                    value={generalDescription}
                    onChange={(e) => setGeneralDescription(e.target.value)}
                    onBlur={() => handleBlur('generalDescription')}
                    placeholder="Provide full operational requirement details, item specifications, and timing..."
                    disabled={isSubmitting}
                    rows={3}
                    className={getTextareaClass('generalDescription')}
                    aria-required="true"
                  />
                  {renderFieldError('generalDescription')}
                </div>
              </div>
            )}

            {/* 3. Supporting Attachments Section (Functional & Integrated) */}
            <div className="p-5 sm:p-7 border-b border-slate-100 bg-slate-50/40">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" aria-hidden="true" />
                  Supporting Attachments &amp; Documents
                </h2>
                <span className="text-[11px] text-slate-400">Optional (Max 10MB per file)</span>
              </div>

              {/* Existing Attachments in Edit Mode */}
              {isEditMode && existingAttachments.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Current Attached Documents ({existingAttachments.length})
                  </p>
                  <div className="space-y-2">
                    {existingAttachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-base">{getFileIcon(att.originalName)}</span>
                          <span className="font-semibold text-slate-800 truncate">{att.originalName}</span>
                          <span className="text-slate-400">({formatFileSize(att.sizeBytes)})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteExistingAttachment(att.id)}
                          className="text-xs text-rose-600 hover:text-rose-800 font-medium px-2 py-1 rounded hover:bg-rose-50 transition-colors"
                          aria-label={`Delete ${att.originalName}`}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Drop Zone / Input */}
              <div className="border-2 border-dashed border-slate-300 hover:border-[#2457A7] rounded-xl p-4 sm:p-5 text-center bg-white transition-colors duration-150">
                <input
                  type="file"
                  id="attachment-upload"
                  multiple
                  onChange={handleFileSelect}
                  disabled={isSubmitting}
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.txt,.csv"
                />
                <label
                  htmlFor="attachment-upload"
                  className="cursor-pointer flex flex-col items-center justify-center gap-1.5 focus-within:outline focus-within:outline-2 focus-within:outline-[#2457A7]"
                >
                  <div className="w-9 h-9 rounded-full bg-blue-50 text-[#2457A7] flex items-center justify-center" aria-hidden="true">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-slate-800 hover:text-[#2457A7]">
                    Click to select files to attach
                  </span>
                  <span className="text-[11px] text-slate-400">
                    PDF, PNG, JPG, Word (.docx), Excel (.xlsx), CSV (up to 10MB each)
                  </span>
                </label>
              </div>

              {/* Queued Files List */}
              {queuedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">
                    Ready to upload ({queuedFiles.length} {queuedFiles.length === 1 ? 'file' : 'files'}):
                  </p>
                  {queuedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-white border border-slate-200/90 rounded-lg text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-base">{getFileIcon(file.name)}</span>
                        <span className="font-semibold text-slate-800 truncate">{file.name}</span>
                        <span className="text-slate-400">({formatFileSize(file.size)})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveQueuedFile(idx)}
                        disabled={isSubmitting}
                        className="text-xs font-semibold text-slate-500 hover:text-rose-600 px-2 py-1 rounded hover:bg-slate-50 transition-colors"
                        aria-label={`Remove ${file.name}`}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {attachmentError && (
                <p className="text-xs text-rose-600 mt-2 font-medium" role="alert">
                  {attachmentError}
                </p>
              )}
            </div>

            {/* 4. Workflow Governance Guidance Note */}
            <div className="px-5 sm:px-7 py-4 bg-slate-50/60 border-b border-slate-100 flex items-start gap-2.5 text-xs text-slate-600">
              <svg className="w-4 h-4 text-[#2457A7] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <span className="font-semibold text-slate-800">Dynamic Workflow Governance: </span>
                Upon submission, approval routing is automatically assigned according to Jubilee Mission Medical College institutional rules, departmental hierarchies, and monetary threshold policies.
              </div>
            </div>

            {/* 5. Form Actions Row */}
            <div className="p-5 sm:p-7 bg-white flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400"
                onClick={() => navigate(isEditMode && id ? `/request/${id}` : '/dashboard')}
                disabled={isSubmitting}
              >
                Cancel
              </button>

              <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2.5">
                {/* Save Draft Action */}
                <button
                  type="button"
                  onClick={() => processForm('draft')}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2457A7]"
                >
                  {isSubmitting && submittingAction === 'draft' ? (
                    <span className="flex items-center gap-2 justify-center">
                      <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-slate-700 rounded-full animate-spin" />
                      Saving Draft...
                    </span>
                  ) : isEditMode ? (
                    'Save Draft Changes'
                  ) : (
                    'Save as Draft'
                  )}
                </button>

                {/* Submit for Approval Action */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-5 py-2 text-xs font-semibold text-white bg-[#2457A7] hover:bg-[#1D4ED8] active:bg-[#1E40AF] rounded-lg shadow-2xs transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2457A7] focus-visible:outline-offset-2"
                >
                  {isSubmitting && submittingAction === 'submit' ? (
                    <span className="flex items-center gap-2 justify-center">
                      <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Submitting for Approval...
                    </span>
                  ) : (
                    'Submit for Approval'
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}

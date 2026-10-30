import React, { useState, useRef } from 'react';
import { api, type AttachmentItem } from '../services/api';
import { fmtDateTime, fmtSize } from '../utils/date';

interface AttachmentListProps {
  requestId: string;
  attachments: AttachmentItem[];
  canUpload?: boolean;
  canDelete?: boolean;
  currentUser?: {
    id: string;
    role: string;
  } | null;
  onAttachmentsChanged?: (attachments: AttachmentItem[]) => void;
  className?: string;
}

export const AttachmentList: React.FC<AttachmentListProps> = ({
  requestId,
  attachments,
  canUpload = true,
  canDelete = false,
  currentUser,
  onAttachmentsChanged,
  className = '',
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isActionLoadingId, setIsActionLoadingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mobileCameraRef = useRef<HTMLInputElement | null>(null);

  const clearStatus = () => {
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const handleFilesUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setStatusMessage(null);

    const fileList = Array.from(files);
    const maxSizeBytes = 10 * 1024 * 1024; // 10MB
    const allowed = ['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv'];

    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of fileList) {
      if (file.size > maxSizeBytes) {
        errors.push(`"${file.name}" exceeds 10MB limit (${fmtSize(file.size)}).`);
        continue;
      }
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!allowed.includes(ext)) {
        errors.push(`"${file.name}" has unsupported format .${ext}.`);
        continue;
      }
      validFiles.push(file);
    }

    if (errors.length > 0 && validFiles.length === 0) {
      setStatusMessage({ type: 'error', text: errors.join(' ') });
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (mobileCameraRef.current) mobileCameraRef.current.value = '';
      clearStatus();
      return;
    }

    try {
      setIsUploading(true);
      const newlyUploaded: AttachmentItem[] = [];
      const uploadErrors: string[] = [];

      for (const file of validFiles) {
        try {
          const res = await api.uploadAttachment(requestId, file);
          if (res.success && res.data) {
            newlyUploaded.push(res.data);
          }
        } catch (err: any) {
          uploadErrors.push(`"${file.name}": ${err.message || 'Upload failed'}`);
        }
      }

      if (newlyUploaded.length > 0) {
        const updated = [...newlyUploaded, ...attachments];
        onAttachmentsChanged?.(updated);

        if (errors.length === 0 && uploadErrors.length === 0) {
          setStatusMessage({
            type: 'success',
            text: newlyUploaded.length === 1
              ? `"${newlyUploaded[0].originalName}" uploaded successfully.`
              : `${newlyUploaded.length} files uploaded successfully.`,
          });
        } else {
          setStatusMessage({
            type: 'error',
            text: `${newlyUploaded.length} file(s) uploaded. ${[...errors, ...uploadErrors].join(' ')}`,
          });
        }
      } else if (errors.length > 0 || uploadErrors.length > 0) {
        setStatusMessage({ type: 'error', text: [...errors, ...uploadErrors].join(' ') });
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (mobileCameraRef.current) mobileCameraRef.current.value = '';
      clearStatus();
    }
  };

  const handlePreview = async (att: AttachmentItem) => {
    try {
      setIsActionLoadingId(att.id);
      await api.downloadAttachmentFile(requestId, att.id, att.originalName, false);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Unable to open file preview.' });
      clearStatus();
    } finally {
      setIsActionLoadingId(null);
    }
  };

  const handleDownload = async (att: AttachmentItem) => {
    try {
      setIsActionLoadingId(att.id);
      await api.downloadAttachmentFile(requestId, att.id, att.originalName, true);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Unable to download file.' });
      clearStatus();
    } finally {
      setIsActionLoadingId(null);
    }
  };

  const handleDelete = async (att: AttachmentItem) => {
    if (!window.confirm(`Are you sure you want to remove "${att.originalName}"?`)) {
      return;
    }

    try {
      setIsActionLoadingId(att.id);
      await api.deleteAttachment(requestId, att.id);
      const updated = attachments.filter((a) => a.id !== att.id);
      onAttachmentsChanged?.(updated);
      setStatusMessage({ type: 'success', text: `"${att.originalName}" removed.` });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to delete attachment.' });
    } finally {
      setIsActionLoadingId(null);
      clearStatus();
    }
  };

  const canUserDelete = (att: AttachmentItem): boolean => {
    if (!canDelete) return false;
    if (!currentUser) return true;
    if (currentUser.role === 'ADMIN') return true;
    return Boolean(
      (att.uploadedBy && att.uploadedBy.id === currentUser.id) ||
      (att as any).uploadedById === currentUser.id
    );
  };

  const getFileIcon = (mimeType?: string | null, fileName: string = '') => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const mime = (mimeType || '').toLowerCase();

    // 1. Images
    if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
      return (
        <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
      );
    }

    // 2. Spreadsheets
    if (
      mime.includes('sheet') ||
      mime.includes('excel') ||
      mime.includes('csv') ||
      ['xls', 'xlsx', 'csv'].includes(ext)
    ) {
      return (
        <svg className="w-4 h-4 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
          <path d="M3 9h18" />
          <path d="M3 15h18" />
          <path d="M9 3v18" />
          <path d="M15 3v18" />
        </svg>
      );
    }

    // 3. Documents and PDFs
    if (
      mime.includes('pdf') ||
      mime.includes('word') ||
      mime.includes('document') ||
      ['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)
    ) {
      return (
        <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      );
    }

    // 4. Safe generic file icon
    return (
      <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    );
  };

  return (
    <section className={`bg-white rounded-lg border border-slate-200 shadow-2xs ${className}`} aria-labelledby="attachments-heading">
      {/* Standard Card Header: px-5 py-3 border-b border-slate-200 */}
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
        <h2 id="attachments-heading" className="text-sm font-semibold text-slate-900">
          Attachments ({attachments.length})
        </h2>

        {canUpload && (
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files && handleFilesUpload(e.target.files)}
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.txt,.csv"
              multiple
              aria-label="Upload document file"
            />
            <input
              type="file"
              ref={mobileCameraRef}
              onChange={(e) => e.target.files && handleFilesUpload(e.target.files)}
              className="hidden"
              accept="image/*"
              capture="environment"
              aria-label="Take photo with camera"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200/80 rounded-md transition-colors disabled:opacity-50"
              aria-label="Add attachment file"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>{isUploading ? 'Uploading…' : 'Add file'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Standard Card Body: p-5 */}
      <div className="p-5">
        {/* Status Messages */}
        {statusMessage && (
          <div
            className={`mb-4 px-3 py-2 rounded-md text-xs font-medium border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
            role="status"
          >
            {statusMessage.text}
          </div>
        )}

        {/* Attachment List */}
        {attachments.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            No attachments uploaded for this request.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100" role="list">
            {attachments.map((att) => {
              const isLoadingThis = isActionLoadingId === att.id;
              const canDeleteThis = canUserDelete(att);
              const uploaderName = att.uploadedBy
                ? `${att.uploadedBy.firstName} ${att.uploadedBy.lastName}`
                : 'Requester';
              const metaParts = [
                fmtSize(att.sizeBytes),
                uploaderName,
                att.createdAt ? fmtDateTime(att.createdAt) : null,
              ].filter(Boolean);

              return (
                <li
                  key={att.id}
                  className="py-2.5 sm:py-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/70 px-2 rounded-md transition-colors"
                >
                  {/* Left: MIME File-Type Icon + File info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
                      {getFileIcon(att.mimeType, att.originalName)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <span
                        className="text-sm font-medium truncate text-slate-900 block"
                        title={att.originalName}
                      >
                        {att.originalName}
                      </span>

                      {/* Metadata: size · uploader · date in plain text */}
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {metaParts.join(' · ')}
                      </p>
                    </div>
                  </div>

                  {/* Right: Actions (Ghost View, Ghost Download, Delete if permitted) */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handlePreview(att)}
                      disabled={isLoadingThis}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
                      title={`View ${att.originalName}`}
                      aria-label={`View ${att.originalName}`}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownload(att)}
                      disabled={isLoadingThis}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
                      title={`Download ${att.originalName}`}
                      aria-label={`Download ${att.originalName}`}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    </button>

                    {canDeleteThis && (
                      <button
                        type="button"
                        onClick={() => handleDelete(att)}
                        disabled={isLoadingThis}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-700"
                        title={`Remove ${att.originalName}`}
                        aria-label={`Remove ${att.originalName}`}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};


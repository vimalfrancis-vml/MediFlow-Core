import React, { useState, useRef, useEffect } from 'react';
import { api, type AttachmentItem } from '../services/api';
import { CameraCaptureModal } from './CameraCaptureModal';
import './AttachmentManager.css';

interface AttachmentManagerProps {
  requestId: string;
  initialAttachments?: AttachmentItem[];
  canUpload?: boolean;
  canDelete?: boolean;
  currentUser?: {
    id: string;
    role: string;
  } | null;
  onAttachmentsChanged?: (attachments: AttachmentItem[]) => void;
}

export const AttachmentManager: React.FC<AttachmentManagerProps> = ({
  requestId,
  initialAttachments = [],
  canUpload = true,
  canDelete = true,
  currentUser,
  onAttachmentsChanged,
}) => {
  const [attachments, setAttachments] = useState<AttachmentItem[]>(initialAttachments);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mobileCameraInputRef = useRef<HTMLInputElement | null>(null);

  // Sync state if initial attachments prop changes
  useEffect(() => {
    if (initialAttachments && initialAttachments.length > 0) {
      setAttachments(initialAttachments);
    }
  }, [initialAttachments]);

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getFileIcon = (mimeType: string, fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (mimeType.includes('pdf') || ext === 'pdf') return '📄';
    if (mimeType.startsWith('image/') || ['png', 'jpg', 'jpeg'].includes(ext)) return '🖼️';
    if (['doc', 'docx'].includes(ext) || mimeType.includes('word')) return '📝';
    if (['xls', 'xlsx', 'csv'].includes(ext) || mimeType.includes('excel') || mimeType.includes('sheet')) return '📊';
    if (ext === 'txt' || mimeType.includes('text/plain')) return '📑';
    return '📁';
  };

  const handleFilesUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    const fileList = Array.from(files);
    const maxSizeBytes = 10 * 1024 * 1024;
    const allowed = ['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv'];

    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of fileList) {
      if (file.size > maxSizeBytes) {
        errors.push(`"${file.name}" exceeds 10MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
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
      setErrorMessage(errors.join(' '));
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (mobileCameraInputRef.current) mobileCameraInputRef.current.value = '';
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
        setAttachments((prev) => {
          const updated = [...newlyUploaded, ...prev];
          onAttachmentsChanged?.(updated);
          return updated;
        });

        if (errors.length === 0 && uploadErrors.length === 0) {
          setSuccessMessage(
            newlyUploaded.length === 1
              ? `"${newlyUploaded[0].originalName}" uploaded successfully.`
              : `${newlyUploaded.length} files uploaded successfully.`
          );
        } else {
          setSuccessMessage(`${newlyUploaded.length} file(s) uploaded successfully.`);
          setErrorMessage([...errors, ...uploadErrors].join(' '));
        }
      } else if (errors.length > 0 || uploadErrors.length > 0) {
        setErrorMessage([...errors, ...uploadErrors].join(' '));
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (mobileCameraInputRef.current) mobileCameraInputRef.current.value = '';
    }
  };

  const handleFileUpload = (file: File) => {
    handleFilesUpload([file]);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFilesUpload(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(e.dataTransfer.files);
    }
  };

  const handleView = async (att: AttachmentItem) => {
    try {
      await api.downloadAttachmentFile(requestId, att.id, att.originalName, false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to open file preview.');
    }
  };

  const handleDownload = async (att: AttachmentItem) => {
    try {
      await api.downloadAttachmentFile(requestId, att.id, att.originalName, true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to download file.');
    }
  };

  const handleDelete = async (att: AttachmentItem) => {
    if (!window.confirm(`Are you sure you want to delete "${att.originalName}"?`)) {
      return;
    }

    try {
      setIsDeletingId(att.id);
      setErrorMessage(null);
      await api.deleteAttachment(requestId, att.id);
      setAttachments((prev) => {
        const updated = prev.filter((a) => a.id !== att.id);
        onAttachmentsChanged?.(updated);
        return updated;
      });
      setSuccessMessage(`"${att.originalName}" deleted successfully.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete attachment.');
    } finally {
      setIsDeletingId(null);
    }
  };

  const canUserDeleteAttachment = (att: AttachmentItem): boolean => {
    if (!canDelete) return false;
    if (!currentUser) return true;
    if (currentUser.role === 'ADMIN') return true;
    const isOwner =
      (att.uploadedBy && att.uploadedBy.id === currentUser.id) ||
      (att as any).uploadedById === currentUser.id;
    return Boolean(isOwner);
  };

  return (
    <section className="attachment-manager" aria-label="Attachments & Supporting Documents">
      <div className="attachment-header">
        <h3 className="attachment-title">
          <span>📎</span> Supporting Documents & Attachments
          <span className="attachment-count-badge">{attachments.length}</span>
        </h3>

        {canUpload && (
          <div className="attachment-actions-bar">
            {/* Desktop / Laptop File Picker */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              className="attachment-hidden-input"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.txt,.csv"
              multiple
              aria-label="Upload document file"
            />
            <button
              type="button"
              className="attachment-btn attachment-btn-primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              📁 {isUploading ? 'Uploading...' : 'Upload File'}
            </button>

            {/* Mobile Native Camera Input */}
            <input
              type="file"
              ref={mobileCameraInputRef}
              onChange={handleFileInputChange}
              className="attachment-hidden-input"
              accept="image/*"
              capture="environment"
              aria-label="Take photo with native mobile camera"
            />
            <button
              type="button"
              className="attachment-btn"
              onClick={() => mobileCameraInputRef.current?.click()}
              disabled={isUploading}
              title="Capture photo on mobile or tablet"
            >
              📱 Mobile Camera
            </button>

            {/* Desktop WebRTC Camera Modal Trigger */}
            <button
              type="button"
              className="attachment-btn"
              onClick={() => setIsCameraModalOpen(true)}
              disabled={isUploading}
              title="Open desktop webcam modal"
            >
              📷 Webcam Modal
            </button>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="attachment-alert attachment-alert-error" role="alert">
          <span>⚠️ {errorMessage}</span>
          <button
            type="button"
            className="attachment-action-btn"
            onClick={() => setErrorMessage(null)}
          >
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="attachment-alert attachment-alert-success" role="status">
          <span>✓ {successMessage}</span>
          <button
            type="button"
            className="attachment-action-btn"
            onClick={() => setSuccessMessage(null)}
          >
            ✕
          </button>
        </div>
      )}

      {canUpload && (
        <div
          className={`attachment-dropzone ${isDragActive ? 'drag-active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          aria-label="Drag and drop file upload area"
        >
          <div className="attachment-dropzone-icon">☁️</div>
          <p className="attachment-dropzone-text">
            Drag & drop quotation, invoice, or prescription files here, or <span style={{ color: '#0284c7', textDecoration: 'underline' }}>browse</span>
          </p>
          <p className="attachment-dropzone-hint">
            Supports PDF, PNG, JPG, DOCX, XLSX, CSV up to 10MB per file
          </p>
        </div>
      )}

      {attachments.length === 0 ? (
        <div className="attachment-empty-state">
          <p>No documents or attachments uploaded yet for this request.</p>
        </div>
      ) : (
        <div className="attachment-list">
          {attachments.map((att) => (
            <div key={att.id} className="attachment-card">
              <div className="attachment-card-top">
                <div className="attachment-file-icon" aria-hidden="true">
                  {getFileIcon(att.mimeType, att.originalName)}
                </div>
                <div className="attachment-file-info">
                  <h4 className="attachment-file-name" title={att.originalName}>
                    {att.originalName}
                  </h4>
                  <div className="attachment-file-meta">
                    <span>Size: {formatFileSize(att.sizeBytes)}</span>
                    <span>
                      Uploaded:{' '}
                      {new Date(att.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {att.uploadedBy && (
                      <span>
                        By: {att.uploadedBy.firstName} {att.uploadedBy.lastName} ({att.uploadedBy.role})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="attachment-card-actions">
                <button
                  type="button"
                  className="attachment-action-btn"
                  onClick={() => handleView(att)}
                  title="View document in browser"
                >
                  👁️ View
                </button>
                <button
                  type="button"
                  className="attachment-action-btn"
                  onClick={() => handleDownload(att)}
                  title="Download document file"
                >
                  ⬇️ Download
                </button>
                {canUserDeleteAttachment(att) && (
                  <button
                    type="button"
                    className="attachment-action-btn delete-btn"
                    onClick={() => handleDelete(att)}
                    disabled={isDeletingId === att.id}
                    title="Delete attachment"
                  >
                    🗑️ {isDeletingId === att.id ? 'Deleting...' : 'Delete'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Desktop WebRTC Camera Modal */}
      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={handleFileUpload}
      />
    </section>
  );
};

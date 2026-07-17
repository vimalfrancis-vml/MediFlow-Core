import { useState, useCallback, type FormEvent } from 'react';
import './ActionModal.css';

type ActionType = 'approve' | 'reject' | 'return';

interface ActionModalProps {
  action: ActionType;
  requestTitle: string;
  isLoading: boolean;
  onConfirm: (comment: string) => void;
  onClose: () => void;
}

const ACTION_CONFIG = {
  approve: {
    title: 'Approve Request',
    description: 'You are about to approve this request. It will advance to the next step in the workflow.',
    commentLabel: 'Comment (optional)',
    commentRequired: false,
    confirmLabel: 'Approve',
    confirmClass: 'btn-approve',
  },
  reject: {
    title: 'Reject Request',
    description: 'You are about to reject this request. The requester will be notified.',
    commentLabel: 'Reason for rejection (required)',
    commentRequired: true,
    confirmLabel: 'Reject',
    confirmClass: 'btn-reject',
  },
  return: {
    title: 'Return for Changes',
    description: 'The request will be sent back to the requester for corrections.',
    commentLabel: 'What changes are needed? (required)',
    commentRequired: true,
    confirmLabel: 'Return for Changes',
    confirmClass: 'btn-return',
  },
};

export default function ActionModal({ action, requestTitle, isLoading, onConfirm, onClose }: ActionModalProps) {
  const [comment, setComment] = useState('');
  const config = ACTION_CONFIG[action];

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault();
    if (config.commentRequired && !comment.trim()) return;
    onConfirm(comment);
  }, [comment, config.commentRequired, onConfirm]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">{config.title}</h2>
        <p className="modal-subtitle">
          <strong>"{requestTitle}"</strong>
        </p>
        <p className="modal-description">{config.description}</p>

        <form onSubmit={handleSubmit}>
          <div className="modal-field">
            <label>{config.commentLabel}</label>
            <textarea
              rows={4}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Type here..."
              required={config.commentRequired}
              disabled={isLoading}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-modal-cancel" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button
              type="submit"
              className={`btn-modal-confirm ${config.confirmClass}`}
              disabled={isLoading || (config.commentRequired && !comment.trim())}
            >
              {isLoading ? 'Processing...' : config.confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

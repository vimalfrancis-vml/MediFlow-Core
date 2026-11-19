import { useState, type FC } from 'react';

export interface TemporaryPasswordModalProps {
  isOpen: boolean;
  userEmail: string;
  temporaryPassword: string;
  expiresAt?: string;
  onClose: () => void;
}

export const TemporaryPasswordModal: FC<TemporaryPasswordModalProps> = ({
  isOpen,
  userEmail,
  temporaryPassword,
  expiresAt,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="temp-pwd-title"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <svg className="w-5 h-5 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 id="temp-pwd-title" className="text-base font-bold">
              Temporary Password Generated
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-emerald-100 hover:text-white rounded-lg p-1 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-600">
            A secure temporary password has been generated for{' '}
            <strong className="text-slate-900 font-semibold">{userEmail}</strong>.
          </p>

          {/* Password Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
            <span className="font-mono text-base font-bold text-slate-800 tracking-wider select-all">
              {temporaryPassword}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>

          {/* Expiry and Security Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1.5">
            <div className="font-semibold flex items-center space-x-1.5 text-amber-950">
              <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>One-Time Display Warning</span>
            </div>
            <p className="text-amber-800 leading-relaxed">
              This password will <strong className="text-amber-950">not</strong> be shown again and cannot be retrieved from the server.
              {expiresAt ? ` It will expire in 72 hours.` : ' It expires in 72 hours.'}
            </p>
            <p className="text-amber-800">
              The user will be required to change it immediately upon their first login.
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold shadow transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


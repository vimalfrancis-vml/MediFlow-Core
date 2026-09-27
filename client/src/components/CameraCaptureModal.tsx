import React, { useState, useEffect, useRef } from 'react';
import './CameraCaptureModal.css';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Bind stream to video element whenever stream changes
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {
        /* autoplay policy handling */
      });
    }
  }, [stream, capturedImage]);

  // Initialize camera stream on open
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    const startCamera = async () => {
      if (!isOpen) return;
      setError(null);
      setCapturedImage(null);
      setCapturedBlob(null);
      setIsInitializing(true);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera access is not supported by your browser or secure HTTPS is required.');
        setIsInitializing(false);
        return;
      }

      try {
        let mediaStream: MediaStream;
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch {
          // Fallback to any available video constraint
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        activeStream = mediaStream;
        setStream(mediaStream);
      } catch (err: any) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Camera permission was denied. Please allow camera access in your browser settings.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('No camera device was found on this system.');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setError('Camera is currently in use by another application.');
        } else {
          setError(`Unable to access camera: ${err.message || 'Unknown error'}`);
        }
      } finally {
        setIsInitializing(false);
      }
    };

    if (isOpen) {
      startCamera();
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen]);

  const handleCaptureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(dataUrl);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCapturedBlob(blob);
        }
      },
      'image/jpeg',
      0.92
    );
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setCapturedBlob(null);
  };

  const handleConfirmUpload = () => {
    if (!capturedBlob) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `camera_scan_${timestamp}.jpg`;
    const file = new File([capturedBlob], fileName, { type: 'image/jpeg' });
    onCapture(file);
    handleClose();
  };

  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCapturedImage(null);
    setCapturedBlob(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="camera-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-modal-title"
    >
      <div className="camera-modal-container">
        <div className="camera-modal-header">
          <h3 id="camera-modal-title" className="camera-modal-title">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
            Capture Document via Camera
          </h3>
          <button
            type="button"
            className="camera-modal-close-btn"
            onClick={handleClose}
            aria-label="Close camera modal"
          >
            ✕
          </button>
        </div>

        <div className="camera-modal-body">
          {error ? (
            <div className="camera-error-container">
              <div className="camera-error-icon">📷⚠️</div>
              <p className="camera-error-message">{error}</p>
              <p className="camera-fallback-hint">
                You can still attach existing files or scanned documents using the regular file upload button.
              </p>
            </div>
          ) : capturedImage ? (
            <img
              src={capturedImage}
              alt="Captured document snapshot"
              className="camera-captured-image"
            />
          ) : (
            <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isInitializing && (
                <div className="camera-error-container" style={{ position: 'absolute', zIndex: 10 }}>
                  <p>Initializing camera device...</p>
                </div>
              )}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={() => {
                  videoRef.current?.play().catch(() => {});
                }}
                className="camera-video-preview"
              />
            </div>
          )}

          <canvas ref={canvasRef} className="camera-canvas-hidden" />
        </div>

        <div className="camera-modal-footer">
          <button
            type="button"
            className="camera-btn camera-btn-secondary"
            onClick={handleClose}
          >
            Cancel
          </button>

          {!error && !capturedImage && (
            <button
              type="button"
              className="camera-btn camera-snap-button"
              onClick={handleCaptureSnapshot}
              disabled={isInitializing || !stream}
            >
              📸 Take Snapshot
            </button>
          )}

          {capturedImage && (
            <>
              <button
                type="button"
                className="camera-btn camera-btn-secondary"
                onClick={handleRetake}
              >
                🔄 Retake
              </button>
              <button
                type="button"
                className="camera-btn camera-btn-primary"
                onClick={handleConfirmUpload}
              >
                ✓ Use Photo & Upload
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

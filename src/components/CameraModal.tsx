import React, { useRef, useEffect, useState } from 'react';

interface CameraModalProps {
  open: boolean;
  onClose: () => void;
  onVideoCaptured: (videoFile: File, previewUrl: string) => void;
}

const CameraModal: React.FC<CameraModalProps> = ({ open, onClose, onVideoCaptured }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasTriggeredInput, setHasTriggeredInput] = useState(false);

  useEffect(() => {
    if (open && fileInputRef.current && !hasTriggeredInput) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
      setHasTriggeredInput(true);
    }
    if (!open) {
      setHasTriggeredInput(false);
    }
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onVideoCaptured(file, URL.createObjectURL(file));
      onClose();
    } else {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <input
      ref={fileInputRef}
      type="file"
      accept="video/*"
      capture="environment"
      style={{ display: 'none' }}
      onChange={handleFileChange}
    />
  );
};

export default CameraModal;
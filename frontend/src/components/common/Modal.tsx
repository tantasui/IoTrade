import { useState } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  children?: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, message, type = 'info', children }: ModalProps) {
  if (!isOpen) return null;

  const bgColor = type === 'success' ? 'bg-[#56c214]' : type === 'error' ? 'bg-[#e90d1]' : 'bg-[#2d2d2d]';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className={`text-xl font-bold ${bgColor} text-white px-3 py-1 rounded-[4px]`}>
              {title}
            </h2>
            <button
              onClick={onClose}
              className="text-[#333333] hover:text-[#2d2d2d] transition-colors p-1 hover:bg-[#f5f5f5] rounded-[4px]"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-[#333333] mb-4">{message}</p>
          {children}
          <div className="flex justify-end mt-6">
            <button onClick={onClose} className="btn-primary">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


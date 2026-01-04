"use client";

import { useEffect } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export default function Modal({ isOpen, onClose, children, className = "" }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
      <div
        className={`w-full max-w-[340px] sm:max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl flex flex-col items-center p-6 sm:p-8 relative border border-white/20 dark:border-slate-700/50 ${className}`}
      >
        {children}
      </div>
    </div>
  );
}


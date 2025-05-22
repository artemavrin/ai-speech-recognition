import React from 'react';

interface AlertProps {
  message: string;
  type: 'error' | 'success' | 'info';
  onClose?: () => void;
}

export const Alert: React.FC<AlertProps> = ({ message, type, onClose }) => {
  const baseClasses = "p-4 rounded-lg shadow-lg flex items-center justify-between text-sm sm:text-base";
  const typeClasses = {
    error: "bg-rose-600/80 border border-rose-500 text-rose-100", // Сделал темнее для лучшего контраста
    success: "bg-green-600/80 border border-green-500 text-green-100", // Сделал темнее
    info: "bg-sky-600/80 border border-sky-500 text-sky-100", // Более насыщенный синий
  };

  const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );

  return (
    <div className={`${baseClasses} ${typeClasses[type]}`} role="alert">
      <span>{message}</span>
      {onClose && (
        <button 
          onClick={onClose} 
          className="ml-4 p-1 rounded-full hover:bg-black/30 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
          aria-label="Закрыть предупреждение"
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
};

import React, { useRef, useCallback } from 'react';
import { CloudUpIcon } from './icons/CloudUpIcon'; // Updated Icon

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  showDropzone?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ 
  onFileSelect, 
  disabled,
  showDropzone = true 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      onFileSelect(event.target.files[0]);
    }
  }, [onFileSelect]);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  if (!showDropzone) {
    return (
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="audio/*,video/*"
        className="hidden"
        disabled={disabled}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      onClick={!disabled ? handleClick : undefined}
      className={`
        border-2 border-dashed border-slate-600 rounded-xl p-8 text-center 
        hover:border-sky-500 transition-colors duration-200 
        ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-700' : 'cursor-pointer bg-slate-700/50 hover:bg-slate-700'}
      `}
      role="button"
      aria-label="Загрузить файл"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { if (!disabled) handleClick(); } }}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="audio/*,video/*"
        className="hidden"
        disabled={disabled}
        aria-hidden="true"
      />
      <CloudUpIcon className="h-12 w-12 mx-auto text-slate-400 mb-3 group-hover:text-sky-400 transition-colors" />
      <p className="text-slate-300 font-semibold">
        Нажмите, чтобы выбрать, или перетащите аудио/видео файл
      </p>
      <p className="text-xs text-slate-500 mt-1">
        Поддерживаемые форматы: MP3, WAV, MP4, MOV и т.д.
      </p>
    </div>
  );
};

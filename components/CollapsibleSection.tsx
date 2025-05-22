import React, { ReactNode } from 'react';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { MaximizeIcon } from './icons/MaximizeIcon'; // New Icon
import { MinimizeIcon } from './icons/MinimizeIcon'; // New Icon

interface CollapsibleSectionProps {
  stepNumber?: string | number;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
  className?: string;
  contentClassName?: string;
  headerButtons?: ReactNode;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  stepNumber,
  title,
  icon,
  children,
  isOpen,
  onToggle,
  isFullScreen,
  onToggleFullScreen,
  className = '',
  contentClassName = 'p-4 md:p-6',
  headerButtons,
}) => {
  const headerId = `collapsible-header-${title.replace(/\s+/g, '-').toLowerCase()}`;
  const contentId = `collapsible-content-${title.replace(/\s+/g, '-').toLowerCase()}`;

  const baseContentClasses = "overflow-hidden transition-all duration-300 ease-in-out";
  let dynamicContentClasses = "";

  if (isOpen) {
    dynamicContentClasses += `${contentClassName} opacity-100 `; // Apply provided contentClassName (paddings etc.)
    if (isFullScreen) {
      dynamicContentClasses += 'flex-grow flex flex-col overflow-y-auto'; // Ensure it's a flex container and can grow
    } else {
      dynamicContentClasses += 'max-h-[2000px]'; // Arbitrary large max-height for transition
    }
  } else {
    dynamicContentClasses += 'max-h-0 opacity-0';
    // Ensure padding is not applied when closed to prevent layout shifts or residual space
    // If contentClassName includes padding, it might be better to apply it conditionally or ensure it's margin for spacing.
    // For now, assuming contentClassName is primarily for padding when open.
  }


  return (
    <section
      className={`
        ${className}
        transition-all duration-300 ease-in-out
        ${isFullScreen
          ? 'fixed top-0 left-0 w-screen h-screen z-50 bg-slate-900 rounded-none flex flex-col'
          : 'relative bg-slate-800/70 backdrop-blur-md shadow-xl rounded-xl overflow-hidden'
        }
      `}
      role="region"
      aria-labelledby={headerId}
    >
      <div
        id={headerId}
        className={`flex items-center justify-between p-4 ${isFullScreen ? '' : 'hover:bg-slate-700/50 focus-within:ring-2 focus-within:ring-sky-500 focus-within:ring-inset'} transition-colors duration-150`}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={contentId}
          className="flex items-center space-x-3 group focus:outline-none flex-grow mr-2"
          disabled={isFullScreen} // Disable toggle when in fullscreen as it's always open
        >
          {stepNumber && (
            <span className="flex items-center justify-center h-7 w-7 bg-sky-500 text-white text-sm font-bold rounded-full group-hover:bg-sky-600 transition-colors">
              {stepNumber}
            </span>
          )}
          {icon && <span className="text-sky-400 group-hover:text-sky-300 transition-colors">{icon}</span>}
          <h2 className="text-lg sm:text-xl font-semibold text-sky-300 group-hover:text-sky-200 transition-colors text-left">
            {title}
          </h2>
        </button>
        
        <div className="flex items-center space-x-2">
          {headerButtons}
          <button
            type="button"
            onClick={onToggleFullScreen}
            aria-label={isFullScreen ? "Свернуть из полноэкранного режима" : "Развернуть на весь экран"}
            className="p-1.5 text-slate-400 hover:text-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-md transition-colors"
          >
            {isFullScreen 
              ? <MinimizeIcon className="h-5 w-5 sm:h-6 sm:w-6" /> 
              : <MaximizeIcon className="h-5 w-5 sm:h-6 sm:w-6" />}
          </button>
          {!isFullScreen && (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={isOpen}
              aria-controls={contentId}
              aria-label={isOpen ? "Свернуть секцию" : "Развернуть секцию"}
              className="p-1.5 text-slate-400 hover:text-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-md transition-colors"
            >
              <ChevronDownIcon
                className={`h-6 w-6 transition-transform duration-300 ${
                  isOpen ? 'transform rotate-180' : ''
                }`}
              />
            </button>
          )}
        </div>
      </div>
      <div
        id={contentId}
        aria-labelledby={headerId}
        className={`${baseContentClasses} ${dynamicContentClasses}`}
      >
        {isOpen && children}
      </div>
    </section>
  );
};

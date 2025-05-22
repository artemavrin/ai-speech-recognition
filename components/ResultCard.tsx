import React, { useState, useRef } from 'react';
import { Spinner } from './Spinner';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface ResultCardProps {
  title: string;
  content: string | null;
  isLoading: boolean;
  placeholder?: string;
  actionButton?: React.ReactNode;
  isFullScreen?: boolean;
  onCopyButtonRender?: (button: React.ReactNode) => void;
}

export const ResultCard: React.FC<ResultCardProps> = ({ 
  title, 
  content, 
  isLoading, 
  placeholder, 
  actionButton, 
  isFullScreen,
  onCopyButtonRender 
}) => {
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  
  const handleCopy = () => {
    if (content) {
      const isSummary = title === "3. Резюме" || title === "Резюме" || title === "4. Резюме" || title === "";
      
      let contentToCopy = content;
      if (!isSummary && contentRef.current) {
        contentToCopy = contentRef.current.innerText;
      }

      navigator.clipboard.writeText(contentToCopy)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(err => console.error('Не удалось скопировать: ', err));
    }
  };

  const copyButton = content && !isLoading ? (
    <button
      onClick={handleCopy}
      title={copied ? "Скопировано!" : "Копировать в буфер обмена"}
      aria-label={copied ? "Содержимое скопировано" : "Копировать содержимое в буфер обмена"}
      className="p-1.5 text-slate-400 hover:text-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-md transition-colors"
    >
      {copied ? <CheckCircleIcon className="h-5 w-5 text-green-400" /> : <ClipboardIcon className="h-5 w-5" />}
    </button>
  ) : null;

  React.useEffect(() => {
    if (onCopyButtonRender) {
      onCopyButtonRender(copyButton);
    }
  }, [copyButton, onCopyButtonRender]);

  const cardId = `result-card-content-${title.replace(/\s+/g, '-').toLowerCase() || 'generic'}`;
  const isSummaryCard = title.includes("Резюме") || (title === "" && content && content.startsWith("#"));

  const rootClasses = `bg-slate-800/50 rounded-b-xl ${isFullScreen ? 'flex flex-col flex-grow h-full' : 'p-4'}`;
  const contentContainerClasses = isSummaryCard 
    ? `prose prose-sm sm:prose-base prose-invert max-w-none bg-slate-900/50 p-3 rounded-lg ${isFullScreen ? 'flex-grow overflow-y-auto' : 'max-h-80 overflow-y-auto'}`
    : `prose prose-sm sm:prose-base prose-invert max-w-none bg-slate-900/50 p-3 rounded-lg whitespace-pre-wrap ${isFullScreen ? 'flex-grow overflow-y-auto' : 'max-h-80 overflow-y-auto'}`;
  const placeholderHeight = isFullScreen ? 'flex-grow flex items-center justify-center' : 'h-32 flex items-center justify-center';

  return (
    <div className={rootClasses} aria-labelledby={title ? cardId : undefined}>
      {title && !onCopyButtonRender && (
        <div className="flex justify-between items-center mb-4">
          <h2 id={cardId} className="text-2xl font-semibold text-sky-300">{title}</h2>
        </div>
      )}
      
      {isLoading ? (
        <div className={`flex justify-center items-center ${isFullScreen ? 'flex-grow' : 'h-32'}`} aria-live="polite" aria-busy="true">
          <Spinner />
        </div>
      ) : content ? (
         isSummaryCard ? (
            <div
              ref={contentRef}
              className={contentContainerClasses}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(content) as string) }}
            />
          ) : ( 
            <div 
              ref={contentRef}
              className={contentContainerClasses}
            >
              {content}
            </div>
          )
      ) : (
        <p className={`text-slate-500 italic ${placeholderHeight}`}>
          {placeholder || 'Содержимое отсутствует.'}
        </p>
      )}
      {actionButton && <div className="mt-4">{actionButton}</div>}
    </div>
  );
};

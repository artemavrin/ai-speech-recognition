import React, { useState, useCallback, useEffect, useRef, useMemo, createContext, useContext } from 'react';
import { FileUpload } from './components/FileUpload';
import { ResultCard } from './components/ResultCard';
import { Alert } from './components/Alert';
import { CollapsibleSection } from './components/CollapsibleSection';
import { ChatSection } from './components/ChatSection';
import { transcribeAudioOrVideo, summarizeText, inferSpeakerNames, chatWithTranscriptContext } from './services/geminiService';
import { MicrophoneIcon } from './components/icons/MicrophoneIcon';
import { DocumentMagnifyingGlassIcon } from './components/icons/DocumentMagnifyingGlassIcon';
// import { SparklesIcon } from './components/icons/SparklesIcon'; // Not used currently
import { UserGroupIcon } from './components/icons/UserGroupIcon';
import { InformationCircleIcon } from './components/icons/InformationCircleIcon';
import { CloudUpIcon } from './components/icons/CloudUpIcon'; // New Upload Icon
import { FileDescriptionFilledIcon } from './components/icons/FileDescriptionFilledIcon'; // New Transcription Icon
import { Message2FilledIcon } from './components/icons/Message2FilledIcon'; 
import { EyeTableIcon } from './components/icons/EyeTableIcon';
import { AudioWaveform } from './components/AudioWaveform';
import WaveSurfer from 'wavesurfer.js';

// Тип для хранения сопоставления идентификаторов дикторов с именами
type SpeakerAssignments = { [key: string]: string };
type AutoNameSuggestionStatus = 'idle' | 'pending' | 'success' | 'error' | 'partial';
type SectionKeys = 'upload' | 'transcription' | 'speakers' | 'chat' | 'summary';

// Вспомогательная функция для применения имен к транскрипции
const applyNamesToTranscript = (baseTranscript: string | null, assignments: SpeakerAssignments): string => {
  if (!baseTranscript) return "";
  let updatedTranscript = baseTranscript;
  
  const sortedSpeakerIds = Object.keys(assignments).sort((a, b) => {
    if (b.length !== a.length) {
      return b.length - a.length;
    }
    return a.localeCompare(b);
  });

  for (const id of sortedSpeakerIds) {
    const assignedName = assignments[id] || id;
    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
    const findRegex = new RegExp(`((\\[\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?\\]\\s*)?${escapedId}:)`, "g");
    
    updatedTranscript = updatedTranscript.replace(findRegex, (match, _fullMatch, timestampGroup) => {
      return `${timestampGroup || ''}${assignedName}:`;
    });
  }
  return updatedTranscript;
};

// Создаем контекст для аудио плеера
interface AudioPlayerContextType {
  pause: () => void;
  play: () => void;
  isPlaying: boolean;
  setWaveSurfer: (ws: WaveSurfer | null) => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null);

const useAudioPlayer = () => {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayer must be used within AudioPlayerProvider');
  }
  return context;
};

// Выносим AudioPlayer в отдельный компонент
const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  const setWaveSurfer = useCallback((ws: WaveSurfer | null) => {
    wavesurferRef.current = ws;
  }, []);

  const pause = useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const play = useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.play();
      setIsPlaying(true);
    }
  }, []);

  const value = useMemo(() => ({
    pause,
    play,
    isPlaying,
    setWaveSurfer
  }), [pause, play, isPlaying, setWaveSurfer]);

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
};

// Отдельный компонент для отображения аудио волны
const AudioWaveformPlayer: React.FC<{
  file: File | null;
}> = React.memo(({ file }) => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const { setWaveSurfer } = useAudioPlayer();

  // Очистка URL при размонтировании
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Создание URL для аудио при изменении файла
  useEffect(() => {
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setAudioUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
  }, [file]);

  const handleWaveSurferInit = useCallback((ws: WaveSurfer) => {
    setWaveSurfer(ws);
  }, [setWaveSurfer]);

  if (!file || !audioUrl) return null;

  return (
    <div className="mt-4">
      <AudioWaveform 
        audioUrl={audioUrl}
        className="w-full"
        isVideo={file.type.startsWith('video/')}
        onWaveSurferInit={handleWaveSurferInit}
      />
    </div>
  );
});

AudioWaveformPlayer.displayName = 'AudioWaveformPlayer';

// Компонент для основного контента приложения
const AppContent: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null);
  const [transcriptFromServer, setTranscriptFromServer] = useState<string | null>(null);
  const [editableTranscript, setEditableTranscript] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [isInferringNames, setIsInferringNames] = useState<boolean>(false);
  const [autoNameSuggestionStatus, setAutoNameSuggestionStatus] = useState<AutoNameSuggestionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [videoProcessingWarning, setVideoProcessingWarning] = useState<string | null>(null);
  const [uniqueSpeakerIds, setUniqueSpeakerIds] = useState<string[]>([]);
  const [speakerAssignments, setSpeakerAssignments] = useState<SpeakerAssignments>({});
  const [openSections, setOpenSections] = useState<Record<SectionKeys, boolean>>({
    upload: true,
    transcription: false,
    speakers: false,
    chat: false,
    summary: false,
  });
  const [fullscreenSectionKey, setFullscreenSectionKey] = useState<SectionKeys | null>(null);

  const { pause } = useAudioPlayer();

  const toggleSection = (sectionKey: SectionKeys) => {
    setOpenSections((prev: Record<SectionKeys, boolean>) => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  };

  const openSection = useCallback((sectionKey: SectionKeys, isOpen = true) => {
    setOpenSections((prev: Record<SectionKeys, boolean>) => ({ ...prev, [sectionKey]: isOpen }));
  }, []);

  const handleToggleFullScreen = (sectionKey: SectionKeys) => {
    setFullscreenSectionKey((prev: SectionKeys | null) => (prev === sectionKey ? null : sectionKey));
  };

  useEffect(() => {
    if (fullscreenSectionKey) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [fullscreenSectionKey]);


  const resetAppState = useCallback(() => {
    pause();
    setFile(null);
    setFileName(null);
    setFileDataUrl(null);
    setTranscriptFromServer(null);
    setEditableTranscript(null);
    setSummary(null);
    setError(null);
    setVideoProcessingWarning(null);
    setIsTranscribing(false);
    setIsSummarizing(false);
    setIsInferringNames(false);
    setAutoNameSuggestionStatus('idle');
    setUniqueSpeakerIds([]);
    setSpeakerAssignments({});
    setOpenSections({
      upload: true,
      transcription: false,
      speakers: false,
      chat: false,
      summary: false,
    });
    setFullscreenSectionKey(null);
  }, [pause]);
  
  const extractSpeakerIds = useCallback((text: string): string[] => {
    if (!text) return [];
    const speakerRegex = /(?:\\[\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?\\]\\s*)?(Диктор\\s*[A-ZА-Я0-9]+):/gi;
    const matches = text.matchAll(speakerRegex);
    const ids = new Set<string>();
    for (const match of matches) {
      if (match[1]) { 
        ids.add(match[1].trim());
      }
    }
    return Array.from(ids);
  }, []);

  useEffect(() => {
    const processTranscription = async () => {
      if (transcriptFromServer) {
        const ids = extractSpeakerIds(transcriptFromServer);
        setUniqueSpeakerIds(ids);
        
        let initialAssignments: SpeakerAssignments = {};
        ids.forEach((id: string) => {
          initialAssignments[id] = id; 
        });

        if (ids.length > 0) {
          setIsInferringNames(true);
          setAutoNameSuggestionStatus('pending');
          openSection('speakers', true);
          try {
            const inferredNames = await inferSpeakerNames(transcriptFromServer);
            let allNamesFound = true;
            let someNamesFound = false;
            ids.forEach((id: string) => {
              if (inferredNames[id] && inferredNames[id] !== id) {
                initialAssignments[id] = inferredNames[id];
                someNamesFound = true;
              } else {
                allNamesFound = false; 
              }
            });
             setAutoNameSuggestionStatus(allNamesFound ? 'success' : (someNamesFound ? 'partial' : 'error'));
          } catch (e) {
            console.error("Ошибка при автоматическом определении имен:", e);
            setAutoNameSuggestionStatus('error');
            setError("Не удалось автоматически предложить имена дикторов. Пожалуйста, проверьте консоль для деталей.");
          } finally {
            setIsInferringNames(false);
          }
        } else {
           setAutoNameSuggestionStatus('idle');
           openSection('speakers', false); 
        }
        
        setSpeakerAssignments(initialAssignments);
        const newEditableTranscript = applyNamesToTranscript(transcriptFromServer, initialAssignments);
        setEditableTranscript(newEditableTranscript);
        openSection('transcription', true);
        openSection('chat', true); 
      } else {
        setUniqueSpeakerIds([]);
        setSpeakerAssignments({});
        setEditableTranscript(null);
        setAutoNameSuggestionStatus('idle');
        openSection('transcription', false);
        openSection('speakers', false);
        openSection('chat', false);
      }
    };

    processTranscription();
  }, [transcriptFromServer, extractSpeakerIds, openSection]); 

  const handleFileSelect = useCallback((selectedFile: File) => {
    resetAppState(); 
    setFile(selectedFile);
    setFileName(selectedFile.name);

    const isVideo = selectedFile.type.startsWith('video/');
    if (isVideo) {
      setVideoProcessingWarning("Обработка видеофайлов может занять больше времени, особенно для больших файлов. Мы оптимизируем его для транскрипции аудио.");
    } else {
      setVideoProcessingWarning(null);
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setFileDataUrl(objectUrl);

    openSection('upload', true);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [openSection, resetAppState]);

  const fileToBase64 = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleTranscription = useCallback(async () => {
    if (!file) {
      setError("Файл не выбран или данные файла отсутствуют.");
      return;
    }
    setIsTranscribing(true);
    setAutoNameSuggestionStatus('idle');
    setError(null); 
    setTranscriptFromServer(null);
    setEditableTranscript(null);
    setSummary(null);
    setUniqueSpeakerIds([]);
    setSpeakerAssignments({});
    openSection('transcription', true);
    openSection('speakers', false);
    openSection('chat', false);
    openSection('summary', false);

    try {
      const base64Data = await fileToBase64(file);
      const result = await transcribeAudioOrVideo(base64Data);
      setTranscriptFromServer(result); 
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Во время транскрипции произошла неизвестная ошибка.";
      setError(errorMessage);
      console.error("Ошибка транскрипции:", e);
      openSection('transcription', false);
    } finally {
      setIsTranscribing(false);
    }
  }, [file, openSection]);

  const handleSpeakerNameChange = (id: string, newName: string) => {
    const updatedAssignments = { ...speakerAssignments, [id]: newName.trim() || id };
    setSpeakerAssignments(updatedAssignments);

    if (transcriptFromServer) {
      const newEditableTranscript = applyNamesToTranscript(transcriptFromServer, updatedAssignments);
      setEditableTranscript(newEditableTranscript);
      setSummary(null); 
      setError(null);
      openSection('summary', false);
    }
  };

  const handleSummarization = async () => {
    if (!editableTranscript) { 
      setError("Нет доступной транскрипции для создания резюме.");
      return;
    }
    setIsSummarizing(true);
    setError(null);
    setSummary(null);
    openSection('summary', true);

    try {
      const result = await summarizeText(editableTranscript);
      setSummary(result);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Во время создания резюме произошла неизвестная ошибка.";
      setError(errorMessage);
      console.error("Ошибка создания резюме:", e);
      openSection('summary', false);
    } finally {
      setIsSummarizing(false);
    }
  };

  const clearAll = () => {
    resetAppState();
  };

  const suggestionMessage = useMemo(() => {
    if (isInferringNames || autoNameSuggestionStatus === 'pending') {
      return { text: "Анализ имен дикторов...", type: "info" as AlertProps['type'] };
    }
    switch (autoNameSuggestionStatus) {
      case 'success':
        return { text: "Имена дикторов предложены автоматически.", type: "success" as AlertProps['type'] };
      case 'partial':
        return { text: "Некоторые имена дикторов предложены автоматически. Проверьте и дополните.", type: "info" as AlertProps['type']};
      case 'error':
         if (uniqueSpeakerIds.length > 0) { 
            return { text: "Не удалось автоматически предложить имена. Пожалуйста, введите их вручную.", type: "info" as AlertProps['type'] }; 
         }
         return null; 
      case 'idle':
      default:
        return null;
    }
  }, [isInferringNames, autoNameSuggestionStatus, uniqueSpeakerIds.length]);
  
  const renderSection = (key: SectionKeys, stepNumber: string | undefined, title: string, icon: React.ReactNode, condition: boolean, content: React.ReactNode) => {
    if (!condition && fullscreenSectionKey !== key) return null;
    if (fullscreenSectionKey && fullscreenSectionKey !== key) return null;

    return (
        <CollapsibleSection 
            key={key}
            stepNumber={stepNumber}
            title={title}
            icon={icon}
            isOpen={openSections[key]}
            onToggle={() => toggleSection(key)}
            isFullScreen={fullscreenSectionKey === key}
            onToggleFullScreen={() => handleToggleFullScreen(key)}
            contentClassName={`p-4 md:p-6 ${fullscreenSectionKey === key ? 'flex-grow flex flex-col' : ''}`}
        >
            {content}
        </CollapsibleSection>
    );
  };


  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4 sm:p-6 lg:p-8 flex flex-col items-center ${fullscreenSectionKey ? 'overflow-hidden' : ''}`}>
      <main className="w-full max-w-4xl space-y-6">
        {error && (!fullscreenSectionKey || (fullscreenSectionKey && openSections[fullscreenSectionKey])) &&  (
            <Alert message={error} type="error" onClose={() => setError(null)} />
        )}
        
        {renderSection('upload', '1', "Загрузка файла", <CloudUpIcon className="h-6 w-6 text-sky-400"/>, true, 
            <>
                <FileUpload 
                    onFileSelect={handleFileSelect} 
                    disabled={isTranscribing || isSummarizing || isInferringNames}
                    showDropzone={!fileDataUrl}
                />
                {fileName && (
                    <div className="mt-4 p-3 bg-slate-700/80 rounded-lg text-slate-300">
                    Выбрано: <span className="font-medium text-sky-400">{fileName}</span>
                    </div>
                )}
                {videoProcessingWarning && (
                    <div className="mt-2 p-3 bg-amber-500/20 rounded-lg text-amber-300 text-sm flex items-center">
                        <InformationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0" />
                        {videoProcessingWarning}
                    </div>
                )}
                <AudioWaveformPlayer 
                    file={file}
                />
                {fileDataUrl && (
                    <div className="mt-6 flex flex-col sm:flex-row sm:space-x-4 space-y-3 sm:space-y-0">
                    <button
                        onClick={handleTranscription}
                        disabled={isTranscribing || isSummarizing || isInferringNames}
                        className="w-full sm:w-auto flex items-center justify-center px-6 py-3 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-lg shadow-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-live="polite"
                    >
                        <MicrophoneIcon className="h-5 w-5 mr-2" />
                        {isTranscribing ? 'Транскрипция...' : (isInferringNames ? 'Анализ...' : 'Транскрибировать')}
                    </button>
                    <button
                        onClick={resetAppState}
                        disabled={isTranscribing || isSummarizing || isInferringNames}
                        className="w-full sm:w-auto px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-lg shadow-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Очистить все
                    </button>
                    </div>
                )}
            </>
        )}

        {renderSection('transcription', "2", "Транскрипция", <FileDescriptionFilledIcon className="h-6 w-6 text-sky-400" />, isTranscribing || editableTranscript !== null,
            <ResultCard
                title="" 
                content={editableTranscript}
                isLoading={isTranscribing && !transcriptFromServer} 
                placeholder={isTranscribing ? "Загрузка транскрипции..." : "Транскрипция появится здесь..."}
                isFullScreen={fullscreenSectionKey === 'transcription'}
            />
        )}
        
        {renderSection('speakers', undefined, "Имена дикторов", <UserGroupIcon className="h-6 w-6 text-sky-400" />, uniqueSpeakerIds.length > 0 && !isTranscribing && editableTranscript !== null,
            <>
                {suggestionMessage && (
                    <div className={`flex items-center text-sm mb-3 p-2 rounded-md ${
                    suggestionMessage.type === 'success' ? 'bg-green-500/20 text-green-300' : 
                    suggestionMessage.type === 'info' ? 'bg-sky-500/20 text-sky-300' :
                    'bg-amber-500/20 text-amber-300'
                    }`}>
                        <InformationCircleIcon className={`h-5 w-5 mr-2 ${
                        suggestionMessage.type === 'success' ? 'text-green-400' :
                        suggestionMessage.type === 'info' ? 'text-sky-400' :
                        'text-amber-400'
                        }`} />
                        {suggestionMessage.text}
                    </div>
                )}
                <div className="space-y-3">
                {uniqueSpeakerIds.map(id => (
                    <div key={id} className="flex items-center space-x-3">
                    <label htmlFor={`speaker-${id}`} className="text-slate-300 w-1/3 sm:w-1/4 truncate" title={id}>
                        {id}:
                    </label>
                    <input
                        type="text"
                        id={`speaker-${id}`}
                        value={speakerAssignments[id] || ''}
                        onChange={(e) => handleSpeakerNameChange(id, e.target.value)}
                        className="flex-grow p-2 bg-slate-700 border border-slate-600 rounded-md text-slate-100 focus:ring-sky-500 focus:border-sky-500 transition-shadow"
                        placeholder="Введите имя диктора"
                        disabled={isInferringNames || isTranscribing} 
                    />
                    </div>
                ))}
                </div>
            </>
        )}

        {renderSection('chat', "3", "Диалог по контексту", <Message2FilledIcon className="h-6 w-6 text-sky-400" />, editableTranscript !== null && !isTranscribing,
            <ChatSection 
                transcriptContext={editableTranscript} 
                geminiChatFunction={chatWithTranscriptContext}
                onChatError={(message) => setError(`Ошибка чата: ${message}`)}
                isFullScreen={fullscreenSectionKey === 'chat'}
            />
        )}
        
        {editableTranscript !== null && !isTranscribing && (!fullscreenSectionKey || fullscreenSectionKey === 'summary' || !fullscreenSectionKey) && (
             <div className="my-6 flex justify-start">
                <button
                    onClick={handleSummarization}
                    disabled={isSummarizing || !editableTranscript || isTranscribing || isInferringNames}
                    className="flex items-center justify-center px-6 py-3 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-lg shadow-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-live="polite"
                    >
                    <EyeTableIcon className="h-5 w-5 mr-2" />
                    {isSummarizing ? 'Создание резюме...' : 'Создать резюме (Шаг 4)'}
                </button>
            </div>
        )}

        {renderSection('summary', "4", "Резюме", <EyeTableIcon className="h-6 w-6 text-sky-400" />, isSummarizing || summary !== null,
            <ResultCard
                title=""
                content={summary}
                isLoading={isSummarizing}
                placeholder="Резюме появится здесь..."
                isFullScreen={fullscreenSectionKey === 'summary'}
            />
        )}
      </main>
    </div>
  );
};

// Основной компонент приложения
const App: React.FC = () => {
  return (
    <AudioPlayerProvider>
      <AppContent />
    </AudioPlayerProvider>
  );
};

export default App;

interface AlertProps {
  message: string;
  type: 'error' | 'success' | 'info';
  onClose?: () => void;
}

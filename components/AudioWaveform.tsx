import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

interface AudioWaveformProps {
  audioUrl: string;
  onTimeUpdate?: (currentTime: number) => void;
  className?: string;
  isVideo?: boolean;
  onWaveSurferInit?: (wavesurfer: WaveSurfer) => void;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  audioUrl,
  onTimeUpdate,
  className = '',
  isVideo = false,
  onWaveSurferInit,
}) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const previousVolumeRef = useRef(1);

  useEffect(() => {
    const container = waveformRef.current;
    if (!container) return;

    // Создаем временный медиа элемент
    const mediaElement = document.createElement(isVideo ? 'video' : 'audio');
    mediaElement.src = audioUrl;
    mediaElement.crossOrigin = 'anonymous';
    mediaElement.preload = 'metadata';

    // Инициализация WaveSurfer
    const wavesurfer = WaveSurfer.create({
      container,
      waveColor: '#94a3b8', // slate-400
      progressColor: '#38bdf8', // sky-400
      cursorColor: '#38bdf8', // sky-400
      barWidth: 2,
      barRadius: 3,
      cursorWidth: 2,
      height: 80,
      barGap: 2,
      autoCenter: true,
      hideScrollbar: true,
      interact: true,
      fillParent: true,
      minPxPerSec: 1,
      normalize: false,
      media: mediaElement,
      plugins: []
    });

    wavesurferRef.current = wavesurfer;
    onWaveSurferInit?.(wavesurfer);

    // Функция для обновления масштаба
    const updateZoom = () => {
      const containerWidth = container.clientWidth;
      const duration = wavesurfer.getDuration();
      
      if (duration && containerWidth) {
        const zoom = containerWidth / duration;
        wavesurfer.zoom(zoom);
      }
    };

    // Обработчики событий WaveSurfer
    wavesurfer.on('ready', () => {
      setDuration(wavesurfer.getDuration());
      updateZoom();
      setIsLoading(false);
    });

    wavesurfer.on('audioprocess', () => {
      const time = wavesurfer.getCurrentTime();
      setCurrentTime(time);
      onTimeUpdate?.(time);
    });

    wavesurfer.on('play', () => setIsPlaying(true));
    wavesurfer.on('pause', () => setIsPlaying(false));

    // Обработчики событий мыши
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;
      
      const time = (x / width) * wavesurfer.getDuration();
      setHoverTime(time);
      setHoverPosition(x);
    };

    const handleMouseLeave = () => {
      setHoverTime(null);
      setHoverPosition(null);
    };

    // Наблюдатель за размером контейнера
    const resizeObserver = new ResizeObserver(updateZoom);
    resizeObserver.observe(container);

    // Добавляем обработчики событий
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    // Загружаем аудио
    wavesurfer.load(audioUrl);

    return () => {
      wavesurfer.destroy();
      resizeObserver.disconnect();
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [audioUrl, onTimeUpdate, isVideo, onWaveSurferInit]);

  const handlePlayPause = () => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.playPause();
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const handleMuteToggle = () => {
    if (!wavesurferRef.current) return;
    
    if (isMuted) {
      // Восстанавливаем предыдущую громкость
      wavesurferRef.current.setVolume(previousVolumeRef.current);
      setVolume(previousVolumeRef.current);
      setIsMuted(false);
    } else {
      // Сохраняем текущую громкость и отключаем звук
      previousVolumeRef.current = volume;
      wavesurferRef.current.setVolume(0);
      setVolume(0);
      setIsMuted(true);
    }
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isLoading || !wavesurferRef.current) return;

    const wavesurfer = wavesurferRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const progress = x / width;

    // Если аудио не играет, начинаем воспроизведение с новой позиции
    if (!isPlaying) {
      wavesurfer.seekTo(progress);
      wavesurfer.play();
    } else {
      // Если уже играет, просто меняем позицию
      wavesurfer.seekTo(progress);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div 
        ref={waveformRef}
        onClick={handleWaveformClick}
        className={`relative w-full h-20 bg-slate-800/50 rounded-lg overflow-hidden cursor-pointer isolate ${isLoading ? 'opacity-50' : ''}`}
        role="slider"
        aria-label="Позиция воспроизведения"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
        tabIndex={0}
      />
      
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePlayPause}
            disabled={isLoading}
            className="p-2 text-sky-400 hover:text-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={isPlaying ? "Пауза" : "Воспроизвести"}
          >
            {isLoading ? (
              <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : isPlaying ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>
          <button
            onClick={handleMuteToggle}
            disabled={isLoading}
            className="p-2 text-sky-400 hover:text-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={isMuted ? "Включить звук" : "Отключить звук"}
          >
            {isMuted ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>
          <div className="flex items-center space-x-2 w-24 group">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              disabled={isLoading}
              className="w-full h-1 bg-slate-600/50 rounded-lg appearance-none cursor-pointer 
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-3
                [&::-webkit-slider-thumb]:h-3
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-sky-400
                [&::-webkit-slider-thumb]:transition-all
                [&::-webkit-slider-thumb]:duration-150
                [&::-webkit-slider-thumb]:hover:scale-125
                [&::-webkit-slider-thumb]:hover:bg-sky-300
                [&::-webkit-slider-thumb]:focus:outline-none
                [&::-webkit-slider-thumb]:focus:ring-2
                [&::-webkit-slider-thumb]:focus:ring-sky-500/50
                [&::-moz-range-thumb]:appearance-none
                [&::-moz-range-thumb]:w-3
                [&::-moz-range-thumb]:h-3
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-sky-400
                [&::-moz-range-thumb]:border-0
                [&::-moz-range-thumb]:transition-all
                [&::-moz-range-thumb]:duration-150
                [&::-moz-range-thumb]:hover:scale-125
                [&::-moz-range-thumb]:hover:bg-sky-300
                [&::-moz-range-thumb]:focus:outline-none
                [&::-moz-range-thumb]:focus:ring-2
                [&::-moz-range-thumb]:focus:ring-sky-500/50
                [&::-moz-range-track]:bg-slate-600/50
                [&::-moz-range-track]:rounded-lg
                [&::-moz-range-track]:h-1
                [&::-moz-range-progress]:bg-sky-400/50
                [&::-moz-range-progress]:rounded-lg
                [&::-moz-range-progress]:h-1
                disabled:opacity-50
                disabled:cursor-not-allowed
                group-hover:[&::-webkit-slider-thumb]:scale-110
                group-hover:[&::-moz-range-thumb]:scale-110
                group-hover:[&::-moz-range-progress]:bg-sky-400/70
                group-hover:bg-slate-600/70
                transition-colors
                duration-150"
              style={{
                background: `linear-gradient(to right, rgb(56 189 248 / ${volume * 0.5}) 0%, rgb(56 189 248 / ${volume * 0.5}) ${volume * 100}%, rgb(148 163 184 / 0.3) ${volume * 100}%, rgb(148 163 184 / 0.3) 100%)`
              }}
              aria-label="Громкость"
            />
          </div>
        </div>
        <div className="text-sm text-slate-400">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
      {hoverTime !== null && hoverPosition !== null && !isLoading && (
        <>
          <div 
            className="absolute top-0 bottom-10 w-0.5 pointer-events-none border-dashed border-sky-400/30"
            style={{ 
              left: `${hoverPosition}px`,
              borderLeft: '1px dashed',
              borderColor: 'rgb(56 189 248 / 0.3)' // sky-400/30
            }}
          />
          <div 
            className="absolute bottom-full mb-2 px-2 py-1 bg-slate-900 text-sky-400 text-sm rounded shadow-lg transform -translate-x-1/2 pointer-events-none whitespace-nowrap"
            style={{ left: `${hoverPosition}px` }}
          >
            {formatTime(hoverTime)}
          </div>
        </>
      )}
    </div>
  );
}; 
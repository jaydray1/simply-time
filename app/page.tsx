'use client';

import { useState, useEffect, useRef } from 'react';

type TimerMode = 'work' | 'break';

export default function Home() {
  const [workMinutes, setWorkMinutes] = useState(52);
  const [breakMinutes, setBreakMinutes] = useState(18);
  const [mode, setMode] = useState<TimerMode>('work');
  const [timeLeft, setTimeLeft] = useState(52 * 60); // in seconds
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [breathingPhase, setBreathingPhase] = useState<'inhale' | 'hold1' | 'exhale' | 'hold2'>('inhale');
  const [breathingProgress, setBreathingProgress] = useState(0);
  const [testBreathing, setTestBreathing] = useState(false);
  const [breathCount, setBreathCount] = useState(0);
  const breathCountIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const breathingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const modeRef = useRef<TimerMode>(mode);
  const workMinutesRef = useRef(workMinutes);
  const breakMinutesRef = useRef(breakMinutes);

  // Keep refs in sync
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    workMinutesRef.current = workMinutes;
  }, [workMinutes]);

  useEffect(() => {
    breakMinutesRef.current = breakMinutes;
  }, [breakMinutes]);

  // Initialize time left based on current mode
  useEffect(() => {
    if (!isRunning) {
      const minutes = mode === 'work' ? workMinutes : breakMinutes;
      setTimeLeft(minutes * 60);
    }
  }, [mode, workMinutes, breakMinutes, isRunning]);

  // Timer countdown logic
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Auto-switch mode and continue running
            const currentMode = modeRef.current;
            const newMode = currentMode === 'work' ? 'break' : 'work';
            const newMinutes = newMode === 'work' ? workMinutesRef.current : breakMinutesRef.current;
            setMode(newMode);
            return newMinutes * 60;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Update browser tab title and favicon
  useEffect(() => {
    const updateFavicon = (color: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(16, 16, 14, 0, 2 * Math.PI);
        ctx.fill();
      }
      const favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link');
      favicon.type = 'image/png';
      favicon.rel = 'icon';
      favicon.href = canvas.toDataURL();
      if (!document.querySelector("link[rel*='icon']")) {
        document.getElementsByTagName('head')[0].appendChild(favicon);
      }
    };

    if (isRunning) {
      const timeString = formatTime(timeLeft);
      const modeEmoji = mode === 'work' ? '⏱️' : '☕';
      document.title = `${timeString} - ${modeEmoji} Simply Time`;
      updateFavicon(mode === 'work' ? '#2563eb' : '#16a34a'); // blue for work, green for break
    } else {
      document.title = 'Simply Time - Focus Timer';
      updateFavicon('#64748b'); // gray when stopped
    }
  }, [timeLeft, mode, isRunning]);

  // Box breathing animation during break mode or test mode
  useEffect(() => {
    if ((isRunning && mode === 'break') || testBreathing) {
      let phase: 'inhale' | 'hold1' | 'exhale' | 'hold2' = 'inhale';
      let progress = 0;
      const phaseDuration = 4000; // 4 seconds per phase
      const updateInterval = 50; // Update every 50ms for smooth animation

      breathingIntervalRef.current = setInterval(() => {
        progress += updateInterval;
        const phaseProgress = Math.min(progress / phaseDuration, 1);
        setBreathingProgress(phaseProgress);
        setBreathingPhase(phase);

        if (progress >= phaseDuration) {
          progress = 0;
          // Move to next phase
          if (phase === 'inhale') phase = 'hold1';
          else if (phase === 'hold1') phase = 'exhale';
          else if (phase === 'exhale') phase = 'hold2';
          else phase = 'inhale'; // hold2 -> inhale (loop)
          setBreathingPhase(phase);
        }
      }, updateInterval);
    } else {
      if (breathingIntervalRef.current) {
        clearInterval(breathingIntervalRef.current);
        breathingIntervalRef.current = null;
      }
      setBreathingPhase('inhale');
      setBreathingProgress(0);
    }

    return () => {
      if (breathingIntervalRef.current) {
        clearInterval(breathingIntervalRef.current);
      }
    };
  }, [isRunning, mode, testBreathing]);

  // Breath counter - increments every 16 seconds (one full cycle)
  useEffect(() => {
    if ((isRunning && mode === 'break') || testBreathing) {
      // Reset counter when starting
      setBreathCount(0);
      
      breathCountIntervalRef.current = setInterval(() => {
        setBreathCount((prev) => {
          if (prev < 10) {
            return prev + 1;
          }
          return prev; // Stop at 10
        });
      }, 16000); // 16 seconds per cycle
    } else {
      if (breathCountIntervalRef.current) {
        clearInterval(breathCountIntervalRef.current);
        breathCountIntervalRef.current = null;
      }
      setBreathCount(0); // Reset when stopped
    }

    return () => {
      if (breathCountIntervalRef.current) {
        clearInterval(breathCountIntervalRef.current);
      }
    };
  }, [isRunning, mode, testBreathing]);

  const handleStart = () => {
    setIsRunning(true);
  };

  const handleStop = () => {
    setIsRunning(false);
    // Reset to work mode when stopped
    setMode('work');
    setTimeLeft(workMinutes * 60);
  };

  const handleReset = () => {
    setIsRunning(false);
    setMode('work');
    setTimeLeft(workMinutes * 60);
  };

  const handleWorkTimeChange = (minutes: number) => {
    if (minutes > 0 && minutes <= 120) {
      setWorkMinutes(minutes);
      if (!isRunning && mode === 'work') {
        setTimeLeft(minutes * 60);
      }
    }
  };

  const handleBreakTimeChange = (minutes: number) => {
    if (minutes > 0 && minutes <= 60) {
      setBreakMinutes(minutes);
      if (!isRunning && mode === 'break') {
        setTimeLeft(minutes * 60);
      }
    }
  };

  const progress = mode === 'work'
    ? ((workMinutes * 60 - timeLeft) / (workMinutes * 60)) * 100
    : ((breakMinutes * 60 - timeLeft) / (breakMinutes * 60)) * 100;

  // Fullscreen breathing view - automatically shown when breathing is active
  if (testBreathing || (isRunning && mode === 'break')) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center z-50 transition-opacity duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]">
        <div className="relative w-full h-full flex items-center justify-center p-8">
          {/* Close button */}
          <button
            onClick={() => {
              setTestBreathing(false);
              if (isRunning && mode === 'break') {
                setIsRunning(false);
              }
            }}
            className="absolute top-4 right-4 p-3 rounded-full bg-white dark:bg-slate-800 shadow-lg hover:shadow-xl transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white opacity-0 animate-[fadeIn_0.8s_cubic-bezier(0.4,0,0.2,1)_0.4s_forwards]"
            aria-label="Exit breathing mode"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {/* Fullscreen breathing visualization */}
          <div className="relative w-full max-w-2xl aspect-square opacity-0 animate-[fadeInZoom_1s_cubic-bezier(0.4,0,0.2,1)_forwards]">
            <svg 
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Single path for both snake line and dot - rounded rectangle */}
              <path
                id="breathing-path-fullscreen"
                d="M 15,10 L 85,10 A 5,5 0 0,1 90,15 L 90,85 A 5,5 0 0,1 85,90 L 15,90 A 5,5 0 0,1 10,85 L 10,15 A 5,5 0 0,1 15,10 Z"
                fill="none"
                stroke="transparent"
                pathLength="100"
              />
              {/* Background square track */}
              <path
                d="M 15,10 L 85,10 A 5,5 0 0,1 90,15 L 90,85 A 5,5 0 0,1 85,90 L 15,90 A 5,5 0 0,1 10,85 L 10,15 A 5,5 0 0,1 15,10 Z"
                fill="none"
                stroke="#16a34a"
                strokeWidth="4"
                opacity="0.2"
                pathLength="100"
              />
              {/* Snake line - animated */}
              <path
                d="M 15,10 L 85,10 A 5,5 0 0,1 90,15 L 90,85 A 5,5 0 0,1 85,90 L 15,90 A 5,5 0 0,1 10,85 L 10,15 A 5,5 0 0,1 15,10 Z"
                fill="none"
                stroke="#22c55e"
                strokeWidth="8"
                strokeLinecap="round"
                pathLength="100"
                className="snake-line"
              />
              {/* Dot at the front of the snake */}
              <circle
                r="8"
                fill="#22c55e"
                className="snake-dot"
                style={{
                  offsetPath: 'path("M 15,10 L 85,10 A 5,5 0 0,1 90,15 L 90,85 A 5,5 0 0,1 85,90 L 15,90 A 5,5 0 0,1 10,85 L 10,15 A 5,5 0 0,1 15,10 Z")',
                }}
              />
            </svg>
            {/* Phase text - centered */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl font-bold mb-2 text-green-600 dark:text-green-400">
                  {breathingPhase === 'inhale' && 'Breathe In'}
                  {breathingPhase === 'hold1' && 'Hold'}
                  {breathingPhase === 'exhale' && 'Breathe Out'}
                  {breathingPhase === 'hold2' && 'Hold'}
                </div>
                <div className="text-xl text-slate-500 dark:text-slate-400 mb-4">
                  {Math.ceil(4 * (1 - breathingProgress))}s
                </div>
                {/* Breath counter */}
                <div className={`text-3xl font-semibold transition-colors ${
                  breathCount >= 10
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-slate-600 dark:text-slate-400'
                }`}>
                  {breathCount} / 10
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <main className="w-full max-w-6xl">
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
              Simply Time
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Focus on what matters
            </p>
            <p className="text-base text-slate-700 dark:text-slate-300 max-w-2xl mx-auto mb-4">
              <strong>How it works:</strong> Set your work and break times, then click Start. The timer will automatically cycle between work and break sessions until you click Stop.
            </p>
            <div className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg p-3 max-w-2xl mx-auto">
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                💡 Default times based on productivity research: A <a href="https://time.com/3518053/perfect-break/" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-900 dark:hover:text-slate-200">DeskTime study</a> found that the most productive people work in 52-minute bursts followed by 17-minute breaks. This ratio has been cited in <a href="https://hbr.org/" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-900 dark:hover:text-slate-200">Harvard Business Review</a> and <a href="https://time.com/3518053/perfect-break/" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-900 dark:hover:text-slate-200">Time magazine</a>.
              </p>
            </div>
          </div>

          {/* Three Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Settings */}
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                  Timer Settings
                </h2>

                {isRunning && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    Stop the timer to edit times
                  </p>
                )}

                {/* Work Time */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Work Time (minutes)
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleWorkTimeChange(workMinutes - 1)}
                      className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={workMinutes <= 1 || isRunning}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={workMinutes}
                      onChange={(e) => handleWorkTimeChange(parseInt(e.target.value) || 1)}
                      disabled={isRunning}
                      className="flex-1 text-center py-3 px-4 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold text-lg focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <button
                      onClick={() => handleWorkTimeChange(workMinutes + 1)}
                      className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={workMinutes >= 120 || isRunning}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Break Time */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Break Time (minutes)
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleBreakTimeChange(breakMinutes - 1)}
                      className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={breakMinutes <= 1 || isRunning}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={breakMinutes}
                      onChange={(e) => handleBreakTimeChange(parseInt(e.target.value) || 1)}
                      disabled={isRunning}
                      className="flex-1 text-center py-3 px-4 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold text-lg focus:outline-none focus:border-green-500 dark:focus:border-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <button
                      onClick={() => handleBreakTimeChange(breakMinutes + 1)}
                      className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={breakMinutes >= 60 || isRunning}
                    >
                      +
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Right Column - Timer */}
            <div className="space-y-6 flex flex-col items-center">
              {/* Current Mode Indicator */}
              <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl w-full max-w-sm">
                <div className={`flex-1 py-3 px-4 rounded-lg font-semibold text-center ${
                  mode === 'work'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400'
                }`}>
                  {mode === 'work' ? '⏱️ Work Time' : 'Work'}
                </div>
                <div className={`flex-1 py-3 px-4 rounded-lg font-semibold text-center ${
                  mode === 'break'
                    ? 'bg-green-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400'
                }`}>
                  {mode === 'break' ? '☕ Break Time' : 'Break'}
                </div>
              </div>

              {/* Timer Display */}
              <div className="relative w-full max-w-sm">
                <div className="aspect-square">
                  {/* Progress Circle */}
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-slate-200 dark:text-slate-700"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 45}`}
                      strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
                      className={`transition-all duration-1000 ${
                        mode === 'work' ? 'text-blue-600' : 'text-green-600'
                      }`}
                      strokeLinecap="round"
                    />
                  </svg>
                  {/* Time Display */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className={`text-6xl lg:text-7xl font-bold font-mono ${
                        mode === 'work' ? 'text-blue-600' : 'text-green-600'
                      }`}>
                        {formatTime(timeLeft)}
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400 mt-2 uppercase tracking-wide">
                        {mode === 'work' ? 'Focus Time' : 'Break Time'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex gap-3 w-full max-w-sm">
                {!isRunning ? (
                  <button
                    onClick={handleStart}
                    className={`flex-1 py-4 px-6 rounded-xl font-semibold text-white shadow-lg hover:shadow-xl transition-all ${
                      mode === 'work'
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    Start
                  </button>
                ) : (
                  <button
                    onClick={handleStop}
                    className="flex-1 py-4 px-6 rounded-xl font-semibold bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl transition-all"
                  >
                    Stop
                  </button>
                )}
                <button
                  onClick={handleReset}
                  className="py-4 px-6 rounded-xl font-semibold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 transition-all"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Third Column - Box Breathing */}
            <div className={`space-y-6 flex flex-col items-center transition-opacity duration-300 ${
              (isRunning && mode === 'break') || testBreathing ? 'opacity-100' : 'opacity-30'
            }`}>
              {/* Title with inline button */}
              <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl w-full max-w-sm">
                <div className="flex-1 py-3 px-4 rounded-lg font-semibold text-center text-slate-600 dark:text-slate-400">
                  Box Breathing
                </div>
                <button
                  onClick={() => setTestBreathing(!testBreathing)}
                  className={`py-3 px-6 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${
                    testBreathing
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-green-500 hover:bg-green-600 text-white shadow-lg hover:shadow-xl'
                  }`}
                >
                  {testBreathing ? 'Stop' : 'Breathe'}
                </button>
              </div>

              {/* Breathing snake animation */}
              <div className="relative w-full max-w-sm aspect-square">
                <svg 
                  className="absolute inset-0 w-full h-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="xMidYMid meet"
                >
                  {/* Single path for both snake line and dot - rounded rectangle */}
                  <path
                    id="breathing-path"
                    d="M 15,10 L 85,10 A 5,5 0 0,1 90,15 L 90,85 A 5,5 0 0,1 85,90 L 15,90 A 5,5 0 0,1 10,85 L 10,15 A 5,5 0 0,1 15,10 Z"
                    fill="none"
                    stroke="transparent"
                    pathLength="100"
                  />
                  {/* Background square track */}
                  <path
                    d="M 15,10 L 85,10 A 5,5 0 0,1 90,15 L 90,85 A 5,5 0 0,1 85,90 L 15,90 A 5,5 0 0,1 10,85 L 10,15 A 5,5 0 0,1 15,10 Z"
                    fill="none"
                    stroke={isRunning && mode === 'break' || testBreathing ? '#16a34a' : '#64748b'}
                    strokeWidth="4"
                    opacity="0.2"
                    pathLength="100"
                  />
                  {/* Snake line - animated, uses same path */}
                  {(isRunning && mode === 'break') || testBreathing ? (
                    <>
                      <path
                        d="M 15,10 L 85,10 A 5,5 0 0,1 90,15 L 90,85 A 5,5 0 0,1 85,90 L 15,90 A 5,5 0 0,1 10,85 L 10,15 A 5,5 0 0,1 15,10 Z"
                        fill="none"
                        stroke={isRunning && mode === 'break' || testBreathing ? '#22c55e' : '#94a3b8'}
                        strokeWidth="6"
                        strokeLinecap="round"
                        pathLength="100"
                        className="snake-line"
                      />
                      {/* Dot at the front of the snake - uses same path via offset-path */}
                      <circle
                        r="6"
                        fill={isRunning && mode === 'break' || testBreathing ? '#22c55e' : '#94a3b8'}
                        className="snake-dot"
                        style={{
                          offsetPath: 'path("M 15,10 L 85,10 A 5,5 0 0,1 90,15 L 90,85 A 5,5 0 0,1 85,90 L 15,90 A 5,5 0 0,1 10,85 L 10,15 A 5,5 0 0,1 15,10 Z")',
                        }}
                      />
                    </>
                  ) : (
                    <path
                      d="M 15,10 L 85,10 A 5,5 0 0,1 90,15 L 90,85 A 5,5 0 0,1 85,90 L 15,90 A 5,5 0 0,1 10,85 L 10,15 A 5,5 0 0,1 15,10 Z"
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="4"
                      opacity="0.3"
                      pathLength="100"
                    />
                  )}
                </svg>
                {/* Phase text - centered like timer */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className={`text-xl font-bold mb-1 transition-colors ${
                      (isRunning && mode === 'break') || testBreathing
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}>
                      {(isRunning && mode === 'break') || testBreathing ? (
                        <>
                          {breathingPhase === 'inhale' && 'Breathe In'}
                          {breathingPhase === 'hold1' && 'Hold'}
                          {breathingPhase === 'exhale' && 'Breathe Out'}
                          {breathingPhase === 'hold2' && 'Hold'}
                        </>
                      ) : (
                        'Paused'
                      )}
                    </div>
                    {((isRunning && mode === 'break') || testBreathing) && (
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {Math.ceil(4 * (1 - breathingProgress))}s
                      </div>
                    )}
                    {/* Breath counter */}
                    {((isRunning && mode === 'break') || testBreathing) && (
                      <div className={`mt-3 text-lg font-semibold transition-colors ${
                        breathCount >= 10
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}>
                        {breathCount} / 10
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

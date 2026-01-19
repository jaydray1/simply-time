'use client';

import { useState, useEffect, useRef } from 'react';

type TimerMode = 'work' | 'break';

export default function Home() {
  const [workMinutes, setWorkMinutes] = useState(52);
  const [breakMinutes, setBreakMinutes] = useState(17);
  const [mode, setMode] = useState<TimerMode>('work');
  const [timeLeft, setTimeLeft] = useState(52 * 60); // in seconds
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [breathingPhase, setBreathingPhase] = useState<'inhale' | 'hold1' | 'exhale' | 'hold2'>('inhale');
  const [breathingProgress, setBreathingProgress] = useState(0);
  const [testBreathing, setTestBreathing] = useState(false);
  const [breathCount, setBreathCount] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editTimeValue, setEditTimeValue] = useState('');
  const [isPulsing, setIsPulsing] = useState(false);
  const [showBreakTransition, setShowBreakTransition] = useState(false);
  const [canSkipBreak, setCanSkipBreak] = useState(false);
  const [breathingDismissed, setBreathingDismissed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const breathCountIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pulseIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const breathingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const modeRef = useRef<TimerMode>(mode);
  const workMinutesRef = useRef(workMinutes);
  const breakMinutesRef = useRef(breakMinutes);
  const workTimerSvgRef = useRef<SVGSVGElement | null>(null);
  const breakTimerSvgRef = useRef<SVGSVGElement | null>(null);

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
            
            // If transitioning from work to break, show the ripple transition
            // Commented out - auto-opening breathing screen on break start
            // if (currentMode === 'work' && newMode === 'break') {
            //   setShowBreakTransition(true);
            //   setBreathingDismissed(false); // Reset dismissed state for new break
            //   // Allow skipping after 0.5s
            //   setTimeout(() => setCanSkipBreak(true), 500);
            //   // Complete transition after animation (1.2s) - breathing view continues
            //   setTimeout(() => {
            //     setShowBreakTransition(false);
            //   }, 1200);
            // }
            
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
        setBreathCount((prev) => prev + 1);
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

  // Pulse animation every 30 seconds to remind user about breathing
  useEffect(() => {
    if (!testBreathing && !(isRunning && mode === 'break')) {
      pulseIntervalRef.current = setInterval(() => {
        setIsPulsing(true);
        setTimeout(() => setIsPulsing(false), 2000); // Animation duration
      }, 30000); // 30 seconds
    } else {
      if (pulseIntervalRef.current) {
        clearInterval(pulseIntervalRef.current);
        pulseIntervalRef.current = null;
      }
    }

    return () => {
      if (pulseIntervalRef.current) {
        clearInterval(pulseIntervalRef.current);
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
    setBreathingDismissed(false); // Reset dismissed state
  };

  const handleReset = () => {
    setIsRunning(false);
    setMode('work');
    setTimeLeft(workMinutes * 60);
    setBreathingDismissed(false); // Reset dismissed state
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

  const handleTimeClick = () => {
    if (!isRunning && !isEditingTime) {
      // Toggle between work and break mode
      const newMode = mode === 'work' ? 'break' : 'work';
      setMode(newMode);
    }
  };

  const handleEditTimeClick = () => {
    if (!isRunning) {
      const currentMinutes = mode === 'work' ? workMinutes : breakMinutes;
      setEditTimeValue(`${currentMinutes}:00`);
      setIsEditingTime(true);
    }
  };


  const handleTimeEdit = (value: string) => {
    setEditTimeValue(value);
  };

  const handleTimeSave = () => {
    if (isEditingTime) {
      // Parse input: handle formats like "52:00", "52", "52m", "1:30", etc.
      let minutes = 0;
      const value = editTimeValue.trim();
      
      if (value.includes(':')) {
        // Format: "MM:SS" or "H:MM:SS"
        const parts = value.split(':');
        if (parts.length === 2) {
          minutes = parseInt(parts[0]) || 0;
          const seconds = parseInt(parts[1]) || 0;
          minutes = minutes + Math.floor(seconds / 60);
        } else if (parts.length === 3) {
          const hours = parseInt(parts[0]) || 0;
          minutes = parseInt(parts[1]) || 0;
          minutes = hours * 60 + minutes;
        }
      } else {
        // Format: "52" or "52m"
        const numValue = parseInt(value.replace(/[^0-9]/g, '')) || 0;
        minutes = numValue;
      }

      // Validate and apply based on current mode
      if (mode === 'work') {
        if (minutes > 0 && minutes <= 120) {
          handleWorkTimeChange(minutes);
        }
      } else {
        if (minutes > 0 && minutes <= 60) {
          handleBreakTimeChange(minutes);
        }
      }
      
      setIsEditingTime(false);
      setEditTimeValue('');
    }
  };

  const handleTimeCancel = () => {
    setIsEditingTime(false);
    setEditTimeValue('');
  };

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingTime && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditingTime]);

  const workProgress = mode === 'work'
    ? ((workMinutes * 60 - timeLeft) / (workMinutes * 60)) * 100
    : 0;
  const breakProgress = mode === 'break'
    ? ((breakMinutes * 60 - timeLeft) / (breakMinutes * 60)) * 100
    : 0;

  // Calculate angle from mouse position relative to circle center
  const getAngleFromEvent = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>, svg: SVGSVGElement) => {
    const rect = svg.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    let clientX: number;
    let clientY: number;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const x = clientX - centerX;
    const y = clientY - centerY;
    
    // Calculate angle from top (12 o'clock) going clockwise
    // atan2(y, x) gives angle from right (3 o'clock), counter-clockwise
    // Range: -π to π, where 0 = right, π/2 = top, -π/2 = bottom
    
    // Get angle from right
    let angle = Math.atan2(y, x);
    
    // Normalize to 0-2π (0 = right, π/2 = top, π = left, 3π/2 = bottom)
    if (angle < 0) {
      angle = angle + 2 * Math.PI;
    }
    
    // Rotate so 0 is at top: subtract π/2
    // After: 0 = top, π/2 = left, π = bottom, 3π/2 = right
    angle = angle - Math.PI / 2;
    if (angle < 0) {
      angle = angle + 2 * Math.PI;
    }
    
    // Flip to go clockwise instead of counter-clockwise
    // After: 0 = top, π/2 = right, π = bottom, 3π/2 = left (clockwise from top)
    angle = 2 * Math.PI - angle;
    if (angle >= 2 * Math.PI) {
      angle = angle - 2 * Math.PI;
    }
    if (angle < 0) {
      angle = angle + 2 * Math.PI;
    }
    
    return angle;
  };

  // Convert angle to time based on current mode
  const angleToTime = (angle: number, currentMode: TimerMode) => {
    // Convert angle (0-2π) to progress (0-1)
    const progress = angle / (2 * Math.PI);
    const totalMinutes = currentMode === 'work' ? workMinutes : breakMinutes;
    const totalSeconds = totalMinutes * 60;
    const newTimeLeft = Math.round(totalSeconds * (1 - progress));
    return Math.max(0, Math.min(totalSeconds, newTimeLeft));
  };

  const handleCircleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isEditingTime) return;
    e.preventDefault();
    setIsDragging(true);
    const svg = e.currentTarget;
    const angle = getAngleFromEvent(e, svg);
    const newTime = angleToTime(angle, mode);
    setTimeLeft(newTime);
  };

  const handleCircleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging || isEditingTime) return;
    e.preventDefault();
    const svg = e.currentTarget;
    const angle = getAngleFromEvent(e, svg);
    const newTime = angleToTime(angle, mode);
    setTimeLeft(newTime);
  };

  const handleCircleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCircleTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    if (isEditingTime) return;
    e.preventDefault();
    setIsDragging(true);
    const svg = e.currentTarget;
    const angle = getAngleFromEvent(e, svg);
    const newTime = angleToTime(angle, mode);
    setTimeLeft(newTime);
  };

  const handleCircleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!isDragging || isEditingTime) return;
    e.preventDefault();
    const svg = e.currentTarget;
    const angle = getAngleFromEvent(e, svg);
    const newTime = angleToTime(angle, mode);
    setTimeLeft(newTime);
  };

  const handleCircleTouchEnd = () => {
    setIsDragging(false);
  };

  // Global mouse/touch handlers for dragging outside the circle
  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isEditingTime) {
        setIsDragging(false);
        return;
      }
      const currentMode = modeRef.current;
      const svg = currentMode === 'work' ? workTimerSvgRef.current : breakTimerSvgRef.current;
      if (!svg) return;
      
      const rect = svg.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const x = e.clientX - centerX;
      const y = e.clientY - centerY;
      let angle = Math.atan2(y, x);
      angle = (angle + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
      const newTime = angleToTime(angle, currentMode);
      setTimeLeft(newTime);
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (isEditingTime) {
        setIsDragging(false);
        return;
      }
      const currentMode = modeRef.current;
      const svg = currentMode === 'work' ? workTimerSvgRef.current : breakTimerSvgRef.current;
      if (!svg) return;
      
      const rect = svg.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const x = e.touches[0].clientX - centerX;
      const y = e.touches[0].clientY - centerY;
      let angle = Math.atan2(y, x);
      angle = (angle + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
      const newTime = angleToTime(angle, currentMode);
      setTimeLeft(newTime);
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, [isDragging, isEditingTime]);

  const handleCloseFocus = () => {
    setIsClosing(true);
    setShowBreakTransition(false);
    // Wait for animation to complete before actually closing
    setTimeout(() => {
      setTestBreathing(false);
      // Mark breathing as dismissed so it doesn't reopen during this break
      if (isRunning && mode === 'break') {
        setBreathingDismissed(true);
      }
      // Don't stop the timer - just close the breathing view
      // The break timer will continue running in the background
      setIsClosing(false);
    }, 1000); // Match the animation duration
  };

  const handleSkipBreak = () => {
    setShowBreakTransition(false);
    setCanSkipBreak(false);
    setIsRunning(false);
    setMode('work');
    setTimeLeft(workMinutes * 60);
  };

  const handleBreatheClick = () => {
    setTestBreathing(true);
  };

  // Fullscreen breathing view - automatically shown when breathing is active
  // Don't show if user has dismissed it for the current break session
  // Commented out auto-opening on break: (isRunning && mode === 'break' && !breathingDismissed)
  // Commented out showBreakTransition - no auto-opening on break start
  if (testBreathing) {
    return (
      <div className={`fixed inset-0 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center z-50 ${
        isClosing 
          ? 'animate-[fadeOut_1s_cubic-bezier(0.4,0,0.2,1)_forwards]' 
          : 'transition-opacity duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]'
      }`}>
        {/* Ripple animation overlay - only during transition */}
        {showBreakTransition && !isClosing && (
          <div 
            className="fixed top-6 right-6 w-12 h-12 bg-green-500/80 dark:bg-green-500/60 pointer-events-none z-40"
            style={{
              animation: 'rippleExpand 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards',
              transformOrigin: 'top right',
              boxShadow: '0 0 0 0 rgba(34, 197, 94, 0.4)',
            }}
          />
        )}
        
        <div className="relative w-full h-full flex items-center justify-center p-8">
          {/* Skip to Break button - shown during transition */}
          {showBreakTransition && canSkipBreak && !isClosing && (
            <button
              onClick={handleSkipBreak}
              className="absolute top-4 left-4 px-4 py-2 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium z-50 animate-[fadeIn_0.5s_ease-out_forwards]"
              aria-label="Skip to break"
            >
              Skip to Break
            </button>
          )}
          
          {/* Close button - prominent "I'm Done" button */}
          <button
            onClick={handleCloseFocus}
            className={`absolute top-6 right-6 px-6 py-3 rounded-full bg-white dark:bg-slate-800 shadow-xl hover:shadow-2xl transition-all text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white z-50 font-medium flex items-center gap-2 ${
              isClosing || showBreakTransition
                ? 'opacity-0' 
                : 'opacity-0 animate-[fadeIn_0.8s_cubic-bezier(0.4,0,0.2,1)_0.4s_forwards]'
            }`}
            aria-label="I'm done, exit breathing mode"
          >
            <span>I'm Done</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {/* Fullscreen breathing visualization */}
          <div className={`relative w-full max-w-2xl aspect-square ${
            isClosing 
              ? 'animate-[fadeOutZoom_1s_cubic-bezier(0.4,0,0.2,1)_forwards]' 
              : showBreakTransition
              ? 'opacity-0 animate-[fadeInZoom_1.2s_cubic-bezier(0.4,0,0.2,1)_0.3s_forwards]'
              : 'opacity-0 animate-[fadeInZoom_1s_cubic-bezier(0.4,0,0.2,1)_forwards]'
          }`}>
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
                <div 
                  key={`phase-${breathingPhase}`}
                  className="text-4xl font-bold mb-2 text-green-600 dark:text-green-400"
                  style={{
                    animation: 'textFadeIn 0.5s ease-out',
                  }}
                >
                  {breathingPhase === 'inhale' && 'Breathe In'}
                  {breathingPhase === 'hold1' && 'Hold'}
                  {breathingPhase === 'exhale' && 'Breathe Out'}
                  {breathingPhase === 'hold2' && 'Hold'}
                </div>
                <div 
                  key={`timer-${breathingPhase}-${Math.floor(breathingProgress * 4)}`}
                  className="text-xl text-slate-500 dark:text-slate-400 mb-4"
                  style={{
                    animation: 'textFadeIn 0.3s ease-out',
                  }}
                >
                  {Math.ceil(4 * (1 - breathingProgress))}s
                </div>
                {/* Progress pips - visual indicator at bottom */}
                <div className="flex items-center justify-center gap-2 mt-8">
                  {[1, 2, 3, 4, 5].map((pip) => (
                    <div
                      key={pip}
                      className={`rounded-full transition-all duration-500 ${
                        breathCount >= pip
                          ? pip === 3 && breathCount === 3
                            ? 'w-3 h-3 bg-green-500 shadow-lg shadow-green-500/50'
                            : 'w-2 h-2 bg-green-400 dark:bg-green-500'
                          : 'w-2 h-2 bg-slate-300 dark:bg-slate-600'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
            
            {/* Completion glow effect - gentle glow around square at 3 breaths */}
            {breathCount >= 3 && (
              <div 
                className="absolute inset-0 pointer-events-none z-0 rounded-2xl"
                style={{
                  animation: breathCount === 3 ? 'gentleGlow 2s ease-in-out' : 'none',
                  boxShadow: breathCount >= 3 ? '0 0 60px 30px rgba(34, 197, 94, 0.15)' : 'none',
                }}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Settings Sidebar */}
      <div className={`fixed left-0 top-0 h-full bg-white dark:bg-slate-800 shadow-2xl z-40 transition-transform duration-300 ease-in-out ${
        showSettings ? 'translate-x-0' : '-translate-x-full'
      } ${isRunning ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="w-80 h-full overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Timer Settings
            </h2>
            <button
              onClick={() => setShowSettings(false)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
              aria-label="Close settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Work Time */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Work Time (minutes)
            </label>
            <div className="flex items-center gap-3 mb-3">
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
            {/* Quick Select Presets */}
            <div className="flex flex-wrap gap-2">
              {[25, 50, 52, 90].map((preset) => (
                <button
                  key={preset}
                  onClick={() => handleWorkTimeChange(preset)}
                  disabled={isRunning}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    workMinutes === preset
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {preset}m
                </button>
              ))}
            </div>
          </div>

          {/* Break Time */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Break Time (minutes)
            </label>
            <div className="flex items-center gap-3 mb-3">
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
            {/* Quick Select Presets */}
            <div className="flex flex-wrap gap-2">
              {[5, 10, 15, 17].map((preset) => (
                <button
                  key={preset}
                  onClick={() => handleBreakTimeChange(preset)}
                  disabled={isRunning}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    breakMinutes === preset
                      ? 'bg-green-600 text-white shadow-md'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {preset}m
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Overlay when sidebar is open */}
      {showSettings && !isRunning && (
        <div
          className="fixed inset-0 bg-black/20 dark:bg-black/40 z-30"
          onClick={() => setShowSettings(false)}
        />
      )}

      <main className={`w-full transition-all duration-300 ${showSettings && !isRunning ? 'lg:ml-80' : ''}`}>
        <div className="relative p-8">
          {/* Breathe Pill Button - Top Right */}
          {/* Removed from UI - keeping code for future use */}
          {/* {!testBreathing && !(isRunning && mode === 'break') && (
            <button
              onClick={handleBreatheClick}
              className="fixed top-6 right-6 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full bg-green-500/20 dark:bg-green-500/30 backdrop-blur-sm border border-green-500/30 text-green-700 dark:text-green-400 hover:bg-green-500/30 dark:hover:bg-green-500/40 transition-all shadow-lg hover:shadow-xl"
              style={{
                animation: isPulsing ? 'breathePulse 2s ease-in-out' : 'none',
              }}
              aria-label="Start breathing exercise"
              title="Breathe"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-sm font-medium">Breathe</span>
            </button>
          )} */}
          {/* Centered Timer Layout */}
          <div className="flex flex-col items-center space-y-6">
            {/* Timer Display with Bubbles */}
            <div className="relative w-full max-w-md aspect-square">
              {/* Main Timer (Large) */}
              <div className={`absolute inset-0 aspect-square transition-opacity duration-[3000ms] ease-in-out ${
                mode === 'work' ? 'opacity-100 delay-[3100ms]' : 'opacity-0 pointer-events-none delay-0'
              }`}>
                {/* Progress Circle */}
                <svg 
                  ref={workTimerSvgRef}
                  className="w-full h-full transform -rotate-90"
                  style={{
                    cursor: !isEditingTime ? (isDragging ? 'grabbing' : 'grab') : 'default',
                  }}
                  viewBox="0 0 100 100"
                  onMouseDown={handleCircleMouseDown}
                  onMouseMove={handleCircleMouseMove}
                  onMouseUp={handleCircleMouseUp}
                  onMouseLeave={handleCircleMouseUp}
                  onTouchStart={handleCircleTouchStart}
                  onTouchMove={handleCircleTouchMove}
                  onTouchEnd={handleCircleTouchEnd}
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-slate-200 dark:text-slate-700"
                    style={{ pointerEvents: 'none' }}
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 45}`}
                    strokeDashoffset={`${2 * Math.PI * 45 * (1 - workProgress / 100)}`}
                    className={`text-blue-600 ${isDragging ? '' : 'transition-all duration-1000'}`}
                    strokeLinecap="round"
                    style={{ pointerEvents: 'none' }}
                  />
                  {/* Invisible circle for dragging - covers entire viewBox */}
                  <circle
                    cx="50"
                    cy="50"
                    r="50"
                    fill="transparent"
                    stroke="none"
                    style={{ 
                      pointerEvents: !isEditingTime ? 'all' : 'none',
                      cursor: isDragging ? 'grabbing' : 'grab',
                    }}
                  />
                </svg>
                {/* Time Display */}
                <div className={`absolute inset-0 flex items-center justify-center ${!isRunning && !isEditingTime ? 'pointer-events-none' : ''}`}>
                  <div className={`text-center w-full px-4 ${!isRunning && !isEditingTime ? 'pointer-events-auto' : ''}`}>
                    {isEditingTime && !isRunning && mode === 'work' ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editTimeValue}
                        onChange={(e) => handleTimeEdit(e.target.value)}
                        onBlur={handleTimeSave}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleTimeSave();
                          } else if (e.key === 'Escape') {
                            handleTimeCancel();
                          }
                        }}
                        className="w-full text-6xl lg:text-7xl font-bold font-mono text-center bg-transparent border-2 border-blue-500 dark:border-blue-400 rounded-lg py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                        placeholder="52:00"
                      />
                    ) : (
                      <div
                        onClick={(e) => {
                          if (!isDragging) {
                            handleTimeClick();
                          }
                        }}
                        className={`text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-light tracking-tight transition-all font-[var(--font-inter)] mx-auto text-blue-600 ${
                          !isRunning && !isDragging ? 'cursor-pointer' : 'cursor-default'
                        }`}
                        style={{
                          fontVariationSettings: '"wght" 300, "slnt" 0',
                          maxWidth: '85%',
                          userSelect: isDragging ? 'none' : 'auto',
                        }}
                        title={!isRunning ? 'Click to toggle between work and break mode' : ''}
                      >
                        {timeLeft === 0 && !isRunning && mode === 'work' ? 'Simply Time' : formatTime(timeLeft)}
                      </div>
                    )}
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <div className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        ⏱️ Focus Time
                      </div>
                      {!isRunning && !isEditingTime && mode === 'work' && (
                        <button
                          onClick={handleEditTimeClick}
                          className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-all"
                          title="Edit time"
                          aria-label="Edit time"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Break Timer (Large) */}
              <div className={`absolute inset-0 aspect-square transition-opacity duration-[3000ms] ease-in-out ${
                mode === 'break' ? 'opacity-100 delay-[3100ms]' : 'opacity-0 pointer-events-none delay-0'
              }`}>
                {/* Progress Circle */}
                <svg 
                  ref={breakTimerSvgRef}
                  className="w-full h-full transform -rotate-90"
                  style={{
                    cursor: !isEditingTime ? (isDragging ? 'grabbing' : 'grab') : 'default',
                  }}
                  viewBox="0 0 100 100"
                  onMouseDown={handleCircleMouseDown}
                  onMouseMove={handleCircleMouseMove}
                  onMouseUp={handleCircleMouseUp}
                  onMouseLeave={handleCircleMouseUp}
                  onTouchStart={handleCircleTouchStart}
                  onTouchMove={handleCircleTouchMove}
                  onTouchEnd={handleCircleTouchEnd}
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-slate-200 dark:text-slate-700"
                    style={{ pointerEvents: 'none' }}
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 45}`}
                    strokeDashoffset={`${2 * Math.PI * 45 * (1 - breakProgress / 100)}`}
                    className={`text-green-600 ${isDragging ? '' : 'transition-all duration-1000'}`}
                    strokeLinecap="round"
                    style={{ pointerEvents: 'none' }}
                  />
                  {/* Invisible circle for dragging - covers entire viewBox */}
                  <circle
                    cx="50"
                    cy="50"
                    r="50"
                    fill="transparent"
                    stroke="none"
                    style={{ 
                      pointerEvents: !isEditingTime ? 'all' : 'none',
                      cursor: isDragging ? 'grabbing' : 'grab',
                    }}
                  />
                </svg>
                {/* Time Display */}
                <div className={`absolute inset-0 flex items-center justify-center ${!isRunning && !isEditingTime ? 'pointer-events-none' : ''}`}>
                  <div className={`text-center w-full px-4 ${!isRunning && !isEditingTime ? 'pointer-events-auto' : ''}`}>
                    {isEditingTime && !isRunning && mode === 'break' ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editTimeValue}
                        onChange={(e) => handleTimeEdit(e.target.value)}
                        onBlur={handleTimeSave}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleTimeSave();
                          } else if (e.key === 'Escape') {
                            handleTimeCancel();
                          }
                        }}
                        className="w-full text-6xl lg:text-7xl font-bold font-mono text-center bg-transparent border-2 border-green-500 dark:border-green-400 rounded-lg py-2 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400"
                        placeholder="17:00"
                      />
                    ) : (
                      <div
                        onClick={(e) => {
                          if (!isDragging) {
                            handleTimeClick();
                          }
                        }}
                        className={`text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-light tracking-tight transition-all font-[var(--font-inter)] mx-auto text-green-600 ${
                          !isRunning && !isDragging ? 'cursor-pointer' : 'cursor-default'
                        }`}
                        style={{
                          fontVariationSettings: '"wght" 300, "slnt" 0',
                          maxWidth: '85%',
                          userSelect: isDragging ? 'none' : 'auto',
                        }}
                        title={!isRunning ? 'Click to toggle between work and break mode' : ''}
                      >
                        {timeLeft === 0 && !isRunning && mode === 'break' ? 'Simply Time' : formatTime(timeLeft)}
                      </div>
                    )}
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <div className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        ☕ Break Time
                      </div>
                      {!isRunning && !isEditingTime && mode === 'break' && (
                        <button
                          onClick={handleEditTimeClick}
                          className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-all"
                          title="Edit time"
                          aria-label="Edit time"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Work Bubble (Small) - Bottom Right */}
              <div className={`absolute bottom-0 right-0 transition-opacity duration-[3000ms] ease-in-out ${
                mode === 'work' 
                  ? 'opacity-0 pointer-events-none delay-0' 
                  : 'opacity-100 delay-[3100ms] w-20 h-20 -mb-4 -mr-4'
              }`}>
                <div className="w-full h-full rounded-full bg-blue-500/20 dark:bg-blue-500/30 border-2 border-blue-500/50 dark:border-blue-500/50 flex items-center justify-center backdrop-blur-sm shadow-lg">
                  <div className="text-2xl font-light text-blue-600 dark:text-blue-400 font-[var(--font-inter)]">
                    {workMinutes}
                  </div>
                </div>
              </div>

              {/* Break Bubble (Small) - Bottom Right */}
              <div className={`absolute bottom-0 right-0 transition-opacity duration-[3000ms] ease-in-out ${
                mode === 'break' 
                  ? 'opacity-0 pointer-events-none delay-0' 
                  : 'opacity-100 delay-[3100ms] w-20 h-20 -mb-4 -mr-4'
              }`}>
                <div className="w-full h-full rounded-full bg-green-500/20 dark:bg-green-500/30 border-2 border-green-500/50 dark:border-green-500/50 flex items-center justify-center backdrop-blur-sm shadow-lg">
                  <div className="text-2xl font-light text-green-600 dark:text-green-400 font-[var(--font-inter)]">
                    {breakMinutes}
                  </div>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className={`flex gap-3 w-full max-w-md ${isRunning ? 'justify-center' : ''}`}>
              {!isRunning ? (
                <>
                  <button
                    onClick={handleStart}
                    className={`flex-1 py-5 px-8 rounded-xl font-bold text-lg text-white shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 ${
                      mode === 'work'
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    Start
                  </button>
                  <button
                    onClick={handleReset}
                    className="py-5 px-6 rounded-xl font-semibold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 transition-all"
                  >
                    Reset
                  </button>
                </>
              ) : (
                <button
                  onClick={handleStop}
                  className="w-full max-w-md py-5 px-8 rounded-xl font-bold text-lg bg-red-400 hover:bg-red-500 text-white shadow-xl hover:shadow-2xl transition-all transform hover:scale-105"
                >
                  Stop
                </button>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';

type TimerMode = 'work' | 'break';

export default function Home() {
  const [workMinutes, setWorkMinutes] = useState(52);
  const [breakMinutes, setBreakMinutes] = useState(17);
  const [mode, setMode] = useState<TimerMode>('work');
  const [timeLeft, setTimeLeft] = useState(5); // Start with 5 second initialization
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
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showAudioPrompt, setShowAudioPrompt] = useState(true);
  const [synthWaveCountdown, setSynthWaveCountdown] = useState(0);
  const [synthWaveActive, setSynthWaveActive] = useState(false);
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioEnabledRef = useRef(false);
  const backgroundNoiseRef = useRef<AudioBufferSourceNode | null>(null);
  const backgroundNoiseGainRef = useRef<GainNode | null>(null);
  const synthWaveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const synthWaveAnimationRef = useRef<number | null>(null);
  const synthWaveCountdownRef = useRef<NodeJS.Timeout | null>(null);

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

  // Auto-start initialization timer on page load
  useEffect(() => {
    setIsRunning(true);
    setIsInitializing(true);
  }, []);

  // Initialize time left based on current mode (only when mode or duration changes, not when pausing)
  useEffect(() => {
    // Only reset time when mode or duration changes, not when pausing/resuming
    if (!isInitializing && hasInitialized) {
      const minutes = mode === 'work' ? workMinutes : breakMinutes;
      // Only set if we're not running (to avoid resetting during active timer)
      // This will reset when mode changes or duration changes while paused
      if (!isRunning) {
        setTimeLeft(minutes * 60);
      }
    }
    if (!hasInitialized) {
      setHasInitialized(true);
    }
  }, [mode, workMinutes, breakMinutes, isInitializing, hasInitialized]); // Removed isRunning from dependencies

  // Timer countdown logic
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Handle initialization completion
            if (isInitializing) {
              setIsInitializing(false);
              // Transition to actual work time
              const workSeconds = workMinutesRef.current * 60;
              setMode('work');
              // Play work start sound when transitioning from initialization to work
              // Use setTimeout to ensure state updates complete first
              setTimeout(() => {
                playWorkStartSound().catch(console.error);
                startBackgroundNoise(); // Start the audio bridge
                startSynthWaveCountdown(); // Start synth wave countdown
              }, 100);
              return workSeconds;
            }
            
            // Auto-switch mode and continue running (normal work/break cycle)
            const currentMode = modeRef.current;
            const newMode = currentMode === 'work' ? 'break' : 'work';
            const newMinutes = newMode === 'work' ? workMinutesRef.current : breakMinutesRef.current;
            
            // Play sounds on transitions (only after initialization)
            if (currentMode === 'work' && newMode === 'break') {
              // Tibetan singing bowl sound when work time ends
              stopBackgroundNoise(); // Stop background noise when work ends
              stopSynthWaveCountdown(); // Stop synth wave when work ends
              playTibetanBowlSound().catch(console.error);
            } else if (currentMode === 'break' && newMode === 'work') {
              // Different sound when work time starts
              playWorkStartSound().catch(console.error);
              startBackgroundNoise(); // Start the audio bridge
              startSynthWaveCountdown(); // Start synth wave countdown
            }
            
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
  }, [isRunning, isInitializing]);

  // Initialize audio context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Resume audio context on user interaction (required by browsers)
    const resumeAudio = async () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        try {
          await audioContextRef.current.resume();
          audioEnabledRef.current = true;
          setShowAudioPrompt(false); // Hide prompt once audio is enabled
          console.log('Audio context resumed and enabled');
        } catch (error) {
          console.error('Error resuming audio context:', error);
        }
      } else if (audioContextRef.current && audioContextRef.current.state === 'running') {
        audioEnabledRef.current = true;
        setShowAudioPrompt(false);
      }
    };
    
    // Try to resume on any user interaction - keep trying until it works
    const handleInteraction = () => {
      resumeAudio();
    };
    
    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);
    document.addEventListener('keydown', handleInteraction);
    
    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Play Tibetan singing bowl sound
  const playTibetanBowlSound = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const audioContext = audioContextRef.current;
      
      // Resume audio context if suspended (required by browsers)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
        audioEnabledRef.current = true;
        console.log('Audio context resumed for Tibetan bowl');
      }
      
      // Only play if audio is enabled
      if (!audioEnabledRef.current) {
        console.log('Audio not enabled yet, skipping Tibetan bowl sound');
        return;
      }
      
      console.log('Playing Tibetan bowl sound, context state:', audioContext.state);
    
    // Create oscillator for Tibetan bowl sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Tibetan bowl characteristics: low frequency, long decay
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(220, audioContext.currentTime); // A3 note
    
    // Envelope: quick attack, long decay
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 3);
    
    // Add a second harmonic for richer sound
    const oscillator2 = audioContext.createOscillator();
    const gainNode2 = audioContext.createGain();
    oscillator2.connect(gainNode2);
    gainNode2.connect(audioContext.destination);
    
    oscillator2.type = 'sine';
    oscillator2.frequency.setValueAtTime(440, audioContext.currentTime); // A4 (octave)
    
    gainNode2.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode2.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.1);
    gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 3);
    
    oscillator2.start(audioContext.currentTime);
    oscillator2.stop(audioContext.currentTime + 3);
    } catch (error) {
      console.error('Error playing Tibetan bowl sound:', error);
    }
  };

  // Play work start sound (1.5-second ascending sine swell, 440Hz peak, 200ms attack)
  const playWorkStartSound = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const audioContext = audioContextRef.current;
      
      // Resume audio context if suspended (required by browsers)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
        audioEnabledRef.current = true;
        console.log('Audio context resumed for work start');
      }
      
      // Only play if audio is enabled
      if (!audioEnabledRef.current) {
        console.log('Audio not enabled yet, skipping work start sound');
        return;
      }
      
      console.log('Playing work start sound, context state:', audioContext.state);
    
      // Create oscillator for work start sound - ascending sine swell
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Standard A (440Hz) peak, ascending from lower frequency for warmth
      oscillator.type = 'sine';
      const startFreq = 330; // Start lower for warmth
      const peakFreq = 440; // Standard A
      const duration = 1.5; // 1.5 seconds
      const attackTime = 0.2; // 200ms attack
      
      // Frequency sweep: ascend from 330Hz to 440Hz
      oscillator.frequency.setValueAtTime(startFreq, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(peakFreq, audioContext.currentTime + duration);
      
      // Gain envelope: 200ms attack, then sustain and fade
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.25, audioContext.currentTime + attackTime); // Gentle attack
      gainNode.gain.setValueAtTime(0.25, audioContext.currentTime + attackTime);
      gainNode.gain.exponentialRampToValueAtTime(0.15, audioContext.currentTime + duration * 0.7); // Slight sustain
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration); // Gentle fade out
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
      
      // Add subtle harmonics for "organic digital" warmth (not tinny)
      const harmonic2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      harmonic2.connect(gain2);
      gain2.connect(audioContext.destination);
      
      harmonic2.type = 'sine';
      harmonic2.frequency.setValueAtTime(startFreq * 2, audioContext.currentTime);
      harmonic2.frequency.exponentialRampToValueAtTime(peakFreq * 2, audioContext.currentTime + duration);
      
      gain2.gain.setValueAtTime(0, audioContext.currentTime);
      gain2.gain.linearRampToValueAtTime(0.08, audioContext.currentTime + attackTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
      
      harmonic2.start(audioContext.currentTime);
      harmonic2.stop(audioContext.currentTime + duration);
      
    } catch (error) {
      console.error('Error playing work start sound:', error);
    }
  };

  // Generate pink noise (for audio bridge)
  const generatePinkNoise = (audioContext: AudioContext, duration: number): AudioBuffer => {
    const sampleRate = audioContext.sampleRate;
    const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);
    
    // Pink noise generation (simplified)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      data[i] *= 0.11; // Normalize
      b6 = white * 0.115926;
    }
    
    return buffer;
  };

  // Start background noise (audio bridge) for first 60 seconds of work
  const startBackgroundNoise = async () => {
    try {
      if (!audioEnabledRef.current || !audioContextRef.current) return;
      
      // Stop any existing background noise
      stopBackgroundNoise();
      
      const audioContext = audioContextRef.current;
      const duration = 60; // 60 seconds
      
      // Generate pink noise buffer
      const noiseBuffer = generatePinkNoise(audioContext, duration);
      
      // Create source and gain nodes
      const source = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();
      
      source.buffer = noiseBuffer;
      source.loop = false;
      
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Set volume to 5% (0.05)
      gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
      
      // Store refs for cleanup
      backgroundNoiseRef.current = source;
      backgroundNoiseGainRef.current = gainNode;
      
      source.start(audioContext.currentTime);
      source.onended = () => {
        backgroundNoiseRef.current = null;
        backgroundNoiseGainRef.current = null;
      };
      
      console.log('Background noise (audio bridge) started');
    } catch (error) {
      console.error('Error starting background noise:', error);
    }
  };

  // Stop background noise
  const stopBackgroundNoise = () => {
    if (backgroundNoiseRef.current) {
      try {
        backgroundNoiseRef.current.stop();
        backgroundNoiseRef.current.disconnect();
      } catch (e) {
        // Already stopped or disconnected
      }
      backgroundNoiseRef.current = null;
    }
    if (backgroundNoiseGainRef.current) {
      try {
        backgroundNoiseGainRef.current.disconnect();
      } catch (e) {
        // Already disconnected
      }
      backgroundNoiseGainRef.current = null;
    }
  };

  // Synth wave visualization and countdown
  const drawSynthWave = (ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => {
    ctx.clearRect(0, 0, width, height);
    
    // Gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.1)'); // blue-500
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Draw multiple wave layers for depth
    ctx.strokeStyle = '#3b82f6'; // blue-500
    ctx.lineWidth = 2;
    
    // Main wave
    ctx.beginPath();
    const centerY = height / 2;
    const amplitude = height * 0.3;
    const frequency = 0.02;
    
    for (let x = 0; x < width; x++) {
      const y = centerY + Math.sin((x * frequency) + (time * 0.1)) * amplitude;
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    // Secondary wave (slightly offset)
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
    ctx.beginPath();
    for (let x = 0; x < width; x++) {
      const y = centerY + Math.sin((x * frequency * 1.5) + (time * 0.15) + Math.PI / 4) * (amplitude * 0.6);
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    // Tertiary wave (subtle)
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
    ctx.beginPath();
    for (let x = 0; x < width; x++) {
      const y = centerY + Math.sin((x * frequency * 2) + (time * 0.2) + Math.PI / 2) * (amplitude * 0.4);
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    // Grid lines for synth aesthetic
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = (height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  };

  const animateSynthWave = () => {
    const canvas = synthWaveCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let animationTime = 0;
    
    const animate = () => {
      drawSynthWave(ctx, canvas.width, canvas.height, animationTime);
      animationTime += 0.1;
      synthWaveAnimationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
  };

  const startSynthWaveCountdown = () => {
    // Stop any existing countdown first
    if (synthWaveCountdownRef.current) {
      clearInterval(synthWaveCountdownRef.current);
      synthWaveCountdownRef.current = null;
    }
    
    // Reset countdown to 60
    setSynthWaveCountdown(60);
    setSynthWaveActive(true);
    
    // Start countdown
    synthWaveCountdownRef.current = setInterval(() => {
      setSynthWaveCountdown((prev) => {
        if (prev <= 1) {
          if (synthWaveCountdownRef.current) {
            clearInterval(synthWaveCountdownRef.current);
            synthWaveCountdownRef.current = null;
          }
          setSynthWaveActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Start animation when synth wave becomes active and canvas is ready
  useEffect(() => {
    if (synthWaveActive && synthWaveCanvasRef.current) {
      animateSynthWave();
    }
    
    return () => {
      if (synthWaveAnimationRef.current) {
        cancelAnimationFrame(synthWaveAnimationRef.current);
        synthWaveAnimationRef.current = null;
      }
    };
  }, [synthWaveActive]);

  const stopSynthWaveCountdown = () => {
    // Stop animation
    if (synthWaveAnimationRef.current) {
      cancelAnimationFrame(synthWaveAnimationRef.current);
      synthWaveAnimationRef.current = null;
    }
    
    // Stop countdown
    if (synthWaveCountdownRef.current) {
      clearInterval(synthWaveCountdownRef.current);
      synthWaveCountdownRef.current = null;
    }
    
    setSynthWaveActive(false);
    
    // Clear canvas
    const canvas = synthWaveCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

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
    // Start synth wave if in work mode
    if (mode === 'work') {
      startSynthWaveCountdown();
    }
  };

  const handleStop = () => {
    setIsRunning(false);
    stopBackgroundNoise(); // Stop background noise when paused
    stopSynthWaveCountdown(); // Stop synth wave countdown when paused
    // Just pause - don't reset time or mode
  };

  const handleReset = () => {
    setIsRunning(false);
    stopBackgroundNoise(); // Stop background noise when reset
    stopSynthWaveCountdown(); // Stop synth wave when reset
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
    if (isRunning) {
      // Stop the timer when running
      handleStop();
    } else if (!isEditingTime) {
      // Start the timer when not running
      handleStart();
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

  // Calculate progress - use initialization progress if initializing, otherwise normal progress
  const workProgress = isInitializing
    ? ((5 - timeLeft) / 5) * 100
    : mode === 'work' && workMinutes > 0
    ? ((workMinutes * 60 - timeLeft) / (workMinutes * 60)) * 100
    : 0;
  const breakProgress = mode === 'break' && breakMinutes > 0 && !isInitializing
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
    // Ensure we have valid values
    if (totalSeconds <= 0) return 0;
    const newTimeLeft = Math.round(totalSeconds * (1 - progress));
    return Math.max(0, Math.min(totalSeconds, newTimeLeft));
  };

  const handleCircleMouseDown = (e: React.MouseEvent<SVGCircleElement>) => {
    if (isEditingTime) return;
    e.preventDefault();
    setIsDragging(true);
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const angle = getAngleFromEvent(e as any, svg);
    const newTime = angleToTime(angle, mode);
    setTimeLeft(newTime);
  };

  const handleCircleMouseMove = (e: React.MouseEvent<SVGCircleElement>) => {
    if (!isDragging || isEditingTime) return;
    e.preventDefault();
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const angle = getAngleFromEvent(e as any, svg);
    const newTime = angleToTime(angle, mode);
    setTimeLeft(newTime);
  };

  const handleCircleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCircleTouchStart = (e: React.TouchEvent<SVGCircleElement>) => {
    if (isEditingTime) return;
    e.preventDefault();
    setIsDragging(true);
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const angle = getAngleFromEvent(e as any, svg);
    const newTime = angleToTime(angle, mode);
    setTimeLeft(newTime);
  };

  const handleCircleTouchMove = (e: React.TouchEvent<SVGCircleElement>) => {
    if (!isDragging || isEditingTime) return;
    e.preventDefault();
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const angle = getAngleFromEvent(e as any, svg);
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
    <div className="flex min-h-screen items-start justify-center pt-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
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
        <div className="relative pt-8 px-8 pb-8">
          {/* Audio Enable Prompt */}
          {showAudioPrompt && !audioEnabledRef.current && (
            <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-sm mx-4 shadow-2xl text-center">
                <div className="text-4xl mb-4">🔔</div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                  Enable Sounds
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-2">
                  Click anywhere to enable timer sounds
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-500 mb-6">
                  or press <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs font-mono">Space</kbd> to enable
                </p>
                <button
                  onClick={() => {
                    if (audioContextRef.current) {
                      audioContextRef.current.resume().then(() => {
                        audioEnabledRef.current = true;
                        setShowAudioPrompt(false);
                      }).catch(console.error);
                    }
                  }}
                  className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all shadow-lg hover:shadow-xl"
                >
                  Enable Sounds
                </button>
              </div>
            </div>
          )}
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
            {/* Synth Wave Visual - Reserved Space */}
            <div className="w-full max-w-md relative" style={{ minHeight: '80px' }}>
              {synthWaveActive && (
                <>
                  <canvas
                    ref={synthWaveCanvasRef}
                    width={400}
                    height={80}
                    className="w-full h-20 rounded-lg"
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-2xl font-mono font-bold text-blue-500 dark:text-blue-400 drop-shadow-lg">
                      {synthWaveCountdown}s
                    </div>
                  </div>
                </>
              )}
            </div>
            
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
                  viewBox="0 0 100 100"
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
                <div className={`absolute inset-0 flex items-center justify-center ${!isEditingTime ? 'pointer-events-none' : ''}`}>
                  <div className={`text-center w-full px-4 ${!isEditingTime ? 'pointer-events-auto' : ''}`}>
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
                    {synthWaveActive && (
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <div className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                          Focus Time
                        </div>
                      </div>
                    )}
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
                  viewBox="0 0 100 100"
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
                    onMouseDown={handleCircleMouseDown}
                    onMouseMove={handleCircleMouseMove}
                    onMouseUp={handleCircleMouseUp}
                    onMouseLeave={handleCircleMouseUp}
                    onTouchStart={handleCircleTouchStart}
                    onTouchMove={handleCircleTouchMove}
                    onTouchEnd={handleCircleTouchEnd}
                  />
                </svg>
                {/* Time Display */}
                <div className={`absolute inset-0 flex items-center justify-center ${!isEditingTime ? 'pointer-events-none' : ''}`}>
                  <div className={`text-center w-full px-4 ${!isEditingTime ? 'pointer-events-auto' : ''}`}>
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


          </div>
        </div>
      </main>
    </div>
  );
}

import React, { useState, useMemo, useEffect, useRef } from 'react';

type FanSpeed = 0 | 1 | 2 | 3;

export const Fan: React.FC = () => {
  const [speed, setSpeed] = useState<FanSpeed>(0);
  
  // Refs for Web Audio API
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  // Initialize Audio Context (must be triggered by user interaction)
  const initAudio = () => {
    if (audioCtxRef.current) return;

    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    // Create a noise buffer for fan sound (White noise)
    const bufferSize = ctx.sampleRate * 2; // 2 seconds buffer
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // White noise generation
      data[i] = Math.random() * 2 - 1;
    }

    // Create audio nodes
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // Lowpass filter to make white noise sound like air/fan hum
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800; // Muffle the static

    const gainNode = ctx.createGain();
    gainNode.gain.value = 0; // Start silent

    // Connect graph: Source -> Filter -> Gain -> Destination
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    source.start();
    
    sourceNodeRef.current = source;
    gainNodeRef.current = gainNode;
  };

  // Handle speed changes and update audio
  const handleSpeedChange = (newSpeed: FanSpeed) => {
    // Initialize audio engine on first interaction
    if (!audioCtxRef.current) {
      initAudio();
    }
    
    // Resume context if suspended (browser policy)
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    setSpeed(newSpeed);
  };

  // Effect to modulate sound based on speed
  useEffect(() => {
    const ctx = audioCtxRef.current;
    const gain = gainNodeRef.current;
    const source = sourceNodeRef.current;

    if (!ctx || !gain || !source) return;

    const now = ctx.currentTime;
    // Smooth transition time
    const rampTime = 1.0;

    if (speed === 0) {
      // Fade out
      gain.gain.setTargetAtTime(0, now, 0.2);
    } else {
      // Define volume and pitch for each speed
      // Speed 1: Quiet, lower pitch
      // Speed 2: Medium
      // Speed 3: Loud, higher pitch
      const settings = {
        1: { vol: 0.05, rate: 0.8 },
        2: { vol: 0.15, rate: 1.0 },
        3: { vol: 0.4, rate: 1.3 }
      };

      const { vol, rate } = settings[speed];

      gain.gain.setTargetAtTime(vol, now, 0.5);
      source.playbackRate.setTargetAtTime(rate, now, 0.5);
    }
  }, [speed]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, []);

  // Calculate animation duration based on speed
  const animationStyle = useMemo(() => {
    if (speed === 0) {
      return {};
    }
    let duration = '0s';
    switch (speed) {
      case 1: duration = '0.8s'; break;
      case 2: duration = '0.4s'; break;
      case 3: duration = '0.15s'; break;
    }
    return {
      animationName: 'fan-spin',
      animationDuration: duration,
      animationTimingFunction: 'linear',
      animationIterationCount: 'infinite',
      transformOrigin: '150px 120px',
    };
  }, [speed]);

  return (
    <div className="relative w-full max-w-[300px] select-none">
      <svg 
        viewBox="0 0 300 450" 
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto drop-shadow-xl"
        role="img"
        aria-label={`Electric fan currently set to speed ${speed}`}
      >
        <defs>
          <linearGradient id="bladeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6ba4e9" stopOpacity="1" />
            <stop offset="100%" stopColor="#3b7bc9" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="standGrad" x1="0%" y1="0%" x2="100%" y2="0%">
             <stop offset="0%" stopColor="#4b5563" /> 
             <stop offset="50%" stopColor="#6b7280" />
             <stop offset="100%" stopColor="#4b5563" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* --- Stand & Base --- */}
        <rect x="135" y="220" width="30" height="180" fill="url(#standGrad)" rx="4" />
        <ellipse cx="150" cy="410" rx="80" ry="20" fill="#374151" />
        
        {/* --- Fan Head Structure --- */}
        <circle cx="150" cy="120" r="110" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />

        {/* --- Spinning Blades (Modified for larger size) --- */}
        {/* 
           Old Path: M150 120 C 120 60, 180 20, 150 120 
           New Path uses wider control points (90,10 and 210,10) to make blades fatter and longer
        */}
        <g id="fanBlades" style={animationStyle}>
          <path d="M150 120 C 90 10, 210 10, 150 120" fill="url(#bladeGrad)" className="opacity-90" />
          <path d="M150 120 C 90 10, 210 10, 150 120" fill="url(#bladeGrad)" transform="rotate(120 150 120)" className="opacity-90" />
          <path d="M150 120 C 90 10, 210 10, 150 120" fill="url(#bladeGrad)" transform="rotate(240 150 120)" className="opacity-90" />
          <circle cx="150" cy="120" r="18" fill="#1e293b" />
        </g>

        {/* --- Protective Cage --- */}
        <circle cx="150" cy="120" r="110" fill="none" stroke="#cbd5e1" strokeWidth="4" opacity="0.6"/>
        <circle cx="150" cy="120" r="100" fill="none" stroke="#cbd5e1" strokeWidth="1" opacity="0.4"/>
        {[0, 45, 90, 135].map((deg) => (
            <rect 
                key={deg}
                x="149" 
                y="10" 
                width="2" 
                height="220" 
                fill="#cbd5e1" 
                opacity="0.5"
                transform={`rotate(${deg} 150 120)`}
            />
        ))}

        {/* --- Control Panel (Moved to Top Right) --- */}
        {/* Previous position: translate(110, 340). New Position: translate(205, 20) */}
        <g transform="translate(205, 20)">
          {/* Control Panel Box */}
          <rect x="0" y="0" width="80" height="35" rx="6" fill="#1f2937" stroke="#374151" strokeWidth="1" className="shadow-sm" />
          
          {/* OFF Button (0) */}
          <g 
            className="cursor-pointer hover:brightness-110 transition-all" 
            onClick={() => handleSpeedChange(0)}
            role="button"
            aria-label="Turn fan off"
          >
            <circle 
                cx="20" 
                cy="17" 
                r="8" 
                fill="#ef4444" 
                stroke={speed === 0 ? "#fca5a5" : "none"}
                strokeWidth={speed === 0 ? "2" : "0"}
                className="transition-all duration-200"
            />
            <text x="20" y="45" fontSize="9" textAnchor="middle" fill="#6b7280" fontWeight="600" className="select-none">OFF</text>
          </g>

          {/* Speed 1 Button */}
          <g 
            className="cursor-pointer hover:brightness-110 transition-all"
            onClick={() => handleSpeedChange(1)}
            role="button"
            aria-label="Set speed to low"
          >
             <rect 
                x="35" 
                y="10" 
                width="10" 
                height="14" 
                rx="2" 
                fill={speed === 1 ? "#60a5fa" : "#9ca3af"} 
                className="transition-colors duration-200"
            />
          </g>
          
          {/* Speed 2 Button */}
          <g 
            className="cursor-pointer hover:brightness-110 transition-all"
            onClick={() => handleSpeedChange(2)}
            role="button"
            aria-label="Set speed to medium"
          >
            <rect 
                x="50" 
                y="10" 
                width="10" 
                height="14" 
                rx="2" 
                fill={speed === 2 ? "#3b82f6" : "#9ca3af"} 
                className="transition-colors duration-200"
            />
          </g>

          {/* Speed 3 Button */}
          <g 
            className="cursor-pointer hover:brightness-110 transition-all"
            onClick={() => handleSpeedChange(3)}
            role="button"
            aria-label="Set speed to high"
          >
            <rect 
                x="65" 
                y="10" 
                width="10" 
                height="14" 
                rx="2" 
                fill={speed === 3 ? "#2563eb" : "#9ca3af"} 
                className="transition-colors duration-200"
            />
          </g>
          
          {/* Status LED */}
          <circle 
            cx="40" 
            cy="-8" 
            r="3" 
            fill={speed > 0 ? "#22c55e" : "#374151"}
            filter={speed > 0 ? "url(#glow)" : "none"}
            className="transition-all duration-300"
          />
        </g>
        
        {/* Speed Labels - Removed from bottom as they might look odd without the panel */}
      </svg>
    </div>
  );
};

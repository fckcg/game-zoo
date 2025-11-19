import React, { useState, useEffect, useRef, useMemo } from 'react';

// --- Types ---
type EngineState = 'OFF' | 'STARTING' | 'RUNNING';
type CyclePhase = 'INTAKE' | 'COMPRESSION' | 'POWER' | 'EXHAUST';

interface PartInfo {
  id: string;
  name: string;
  description: string;
}

// --- Constants ---
// Standard Cross-plane V8 firing order: 1-8-4-3-6-5-7-2
// Mapping cylinders 0-7 to visual positions (Left Bank: 0,2,4,6 | Right Bank: 1,3,5,7)
const FIRING_ORDER = [0, 7, 3, 2, 5, 4, 6, 1];
const CYLINDER_OFFSETS = [0, 90, 180, 270, 360, 450, 540, 630]; // Placeholder offsets, adjusted in logic

const PARTS_INFO: Record<string, PartInfo> = {
  piston: {
    id: 'piston',
    name: '活塞 (Piston)',
    description: '承受燃烧压力并向下运动，将热能转化为机械能。它在气缸内往复运动。',
  },
  crankshaft: {
    id: 'crankshaft',
    name: '曲轴 (Crankshaft)',
    description: '将活塞的往复直线运动转化为旋转运动，输出动力至变速箱。',
  },
  sparkplug: {
    id: 'sparkplug',
    name: '火花塞 (Spark Plug)',
    description: '在压缩冲程末端产生高压电火花，点燃混合气体，引发爆炸推动活塞。',
  },
  valve: {
    id: 'valve',
    name: '气门 (Valves)',
    description: '控制气体进出。进气门打开吸入混合气，排气门打开排出燃烧废气。',
  },
  conrod: {
    id: 'conrod',
    name: '连杆 (Connecting Rod)',
    description: '连接活塞与曲轴，传递力量。',
  },
};

export const V8Engine: React.FC = () => {
  const [engineState, setEngineState] = useState<EngineState>('OFF');
  const [rpm, setRpm] = useState(0);
  const [throttle, setThrottle] = useState(20); // 0-100
  const [crankAngle, setCrankAngle] = useState(0);
  const [hoveredPart, setHoveredPart] = useState<PartInfo | null>(null);

  const requestRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const noiseNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const lowPassRef = useRef<BiquadFilterNode | null>(null);

  // --- Sound Engine ---
  const initAudio = () => {
    if (audioCtxRef.current) return;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    audioCtxRef.current = new Ctx();
    
    const ctx = audioCtxRef.current!;

    // Master Gain
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    gainNodeRef.current = masterGain;

    // 1. Low frequency oscillator for the "rumble"
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 0;
    const oscFilter = ctx.createBiquadFilter();
    oscFilter.type = 'lowpass';
    oscFilter.frequency.value = 400;
    osc.connect(oscFilter).connect(masterGain);
    osc.start();
    oscRef.current = osc;

    // 2. White noise for "air/combustion" texture
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 800;
    lowPassRef.current = noiseFilter;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.3;

    noise.connect(noiseFilter).connect(noiseGain).connect(masterGain);
    noise.start();
    noiseNodeRef.current = noise;
  };

  const updateSound = (currentRpm: number, isOn: boolean) => {
    if (!audioCtxRef.current || !oscRef.current || !gainNodeRef.current || !lowPassRef.current) return;

    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;

    if (!isOn) {
      gainNodeRef.current.gain.setTargetAtTime(0, now, 0.5);
      return;
    }

    // Volume Logic
    gainNodeRef.current.gain.setTargetAtTime(0.4, now, 0.1);

    // Pitch Logic based on RPM
    // Idle (~800 RPM) -> ~30Hz base tone
    // Redline (~6000 RPM) -> ~200Hz base tone
    const baseFreq = 20 + (currentRpm / 6000) * 150;
    oscRef.current.frequency.setTargetAtTime(baseFreq, now, 0.1);

    // Noise filter opens up as RPM increases (more air)
    const filterFreq = 400 + (currentRpm / 6000) * 2000;
    lowPassRef.current.frequency.setTargetAtTime(filterFreq, now, 0.1);
  };

  // --- Animation Loop ---
  const animate = (time: number) => {
    setRpm((prevRpm) => {
      let targetRpm = 0;
      if (engineState === 'STARTING') targetRpm = 400; // Starter motor speed
      if (engineState === 'RUNNING') targetRpm = 800 + (throttle * 60); // Idle + Throttle

      // Smooth RPM transition (inertia)
      const newRpm = prevRpm + (targetRpm - prevRpm) * 0.05;
      
      // Update Crank Angle
      // RPM = Revolutions Per Minute. 
      // Deg per frame (at 60fps) = (RPM * 360) / (60 * 60) = RPM / 10
      const degPerFrame = newRpm / 10; 
      setCrankAngle(prevAngle => (prevAngle + degPerFrame) % 720); // 720 degrees for 4-stroke cycle

      updateSound(newRpm, engineState !== 'OFF');
      
      return newRpm;
    });

    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [engineState, throttle]);

  const toggleEngine = () => {
    initAudio();
    if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();

    if (engineState === 'OFF') {
      setEngineState('STARTING');
      setTimeout(() => {
        setEngineState((prev) => prev === 'OFF' ? 'OFF' : 'RUNNING');
      }, 1200); // 1.2s cranking time
    } else {
      setEngineState('OFF');
    }
  };

  // --- Render Helpers ---
  
  // Calculate piston height (y) based on crank angle
  // angle: 0-720. 0 is TDC (Top Dead Center).
  const getPistonY = (angle: number, offset: number) => {
    // Simple harmonic motion approximation
    // cos(0) = 1 (Top), cos(180) = -1 (Bottom)
    const rad = ((angle + offset) % 360) * (Math.PI / 180);
    const normalizedPos = Math.cos(rad); // 1 to -1
    // Map to pixel coordinates: Top=20, Bottom=70
    return 45 - (normalizedPos * 25);
  };

  const getCyclePhase = (angle: number, offset: number): CyclePhase => {
    const cycleAngle = (angle + offset) % 720;
    if (cycleAngle < 180) return 'POWER'; // 0-180: Piston goes down (Combustion pushes it)
    if (cycleAngle < 360) return 'EXHAUST'; // 180-360: Piston goes up (Pushing gas out)
    if (cycleAngle < 540) return 'INTAKE'; // 360-540: Piston goes down (Sucking air in)
    return 'COMPRESSION'; // 540-720: Piston goes up (Squeezing air)
  };

  const getChamberColor = (phase: CyclePhase, pct: number) => {
    switch (phase) {
      case 'INTAKE': return `rgba(59, 130, 246, ${0.3 + pct * 0.2})`; // Blue
      case 'COMPRESSION': return `rgba(255, 255, 255, ${0.3 + pct * 0.4})`; // White getting denser
      case 'POWER': return `rgba(239, 68, 68, ${0.8 - pct * 0.6})`; // Red explosion fading
      case 'EXHAUST': return `rgba(107, 114, 128, ${0.6 - pct * 0.3})`; // Grey smoke
    }
  };

  // V8 Offset Calculation
  // Standard Cross-plane V8: 90 degree offsets between crank pins.
  // Cylinder banks are usually 90 degrees apart.
  // Let's simulate visual positions.
  // Left Bank: Cyl 0, 1, 2, 3. Right Bank: Cyl 4, 5, 6, 7.
  const renderCylinders = () => {
    const cylinders = [];
    
    // Visual Layout: 2 Rows of 4
    // Firing Order: 1-8-4-3-6-5-7-2
    // We map logical firing offsets to the 8 visual cylinders.
    // To visualize "V" shape in 2D, we just do 2 banks.
    // Offsets need to match the firing order for smooth visual rhythm.
    
    // Assign offsets based on standard GM firing order relative to crank angle
    // Cyl 1 (Idx 0): 0 deg
    // Cyl 8 (Idx 7): 90 deg
    // Cyl 4 (Idx 3): 180 deg
    // Cyl 3 (Idx 2): 270 deg
    // Cyl 6 (Idx 5): 360 deg
    // Cyl 5 (Idx 4): 450 deg
    // Cyl 7 (Idx 6): 540 deg
    // Cyl 2 (Idx 1): 630 deg
    const crankOffsets = [0, 630, 270, 180, 450, 360, 540, 90]; 

    for (let i = 0; i < 8; i++) {
      const isLeftBank = i < 4;
      const row = i % 4;
      
      const offsetX = isLeftBank ? 60 : 260;
      const offsetY = 60 + (row * 90);
      
      const phaseOffset = crankOffsets[i];
      const pistonY = getPistonY(crankAngle, phaseOffset);
      const phase = getCyclePhase(crankAngle, phaseOffset);
      
      // Calculate animation percentage within phase (0 to 1)
      const phaseAngle = (crankAngle + phaseOffset) % 180;
      const pct = phaseAngle / 180;

      // Spark Logic: Flash at the very beginning of POWER phase (approx angle 0-20)
      const cyclePos = (crankAngle + phaseOffset) % 720;
      const isSparking = cyclePos >= 0 && cyclePos < 15 && engineState !== 'OFF';

      cylinders.push(
        <g key={i} transform={`translate(${offsetX}, ${offsetY})`}>
          {/* Cylinder Wall */}
          <rect x="-40" y="0" width="80" height="90" fill="#1f2937" stroke="#374151" strokeWidth="2" rx="4" />
          
          {/* Combustion Chamber Background (Dynamic Color) */}
          <rect 
            x="-38" 
            y="2" 
            width="76" 
            height={pistonY - 2} 
            fill={getChamberColor(phase, pct)} 
            className="transition-colors duration-75"
          />

          {/* Spark Plug */}
          <g 
            onMouseEnter={() => setHoveredPart(PARTS_INFO.sparkplug)}
            onMouseLeave={() => setHoveredPart(null)}
            className="cursor-help"
          >
            <rect x="-2" y="-5" width="4" height="10" fill="#9ca3af" />
            <circle 
              cx="0" 
              cy="4" 
              r={isSparking ? 6 : 2} 
              fill={isSparking ? "#fbbf24" : "#4b5563"} 
              filter={isSparking ? "url(#glow)" : ""}
            />
          </g>

          {/* Valves (Simplified Visuals) */}
          <g 
            transform="translate(-20, 2)"
            onMouseEnter={() => setHoveredPart(PARTS_INFO.valve)}
            onMouseLeave={() => setHoveredPart(null)}
            className="cursor-help"
          >
             <circle cx="0" cy="0" r="4" fill={phase === 'INTAKE' ? "#60a5fa" : "#4b5563"} />
             <line x1="0" y1="0" x2="0" y2="-10" stroke="#9ca3af" strokeWidth="2" />
          </g>
          <g 
            transform="translate(20, 2)"
            onMouseEnter={() => setHoveredPart(PARTS_INFO.valve)}
            onMouseLeave={() => setHoveredPart(null)}
          >
             <circle cx="0" cy="0" r="4" fill={phase === 'EXHAUST' ? "#9ca3af" : "#4b5563"} />
             <line x1="0" y1="0" x2="0" y2="-10" stroke="#9ca3af" strokeWidth="2" />
          </g>

          {/* Piston */}
          <g transform={`translate(0, ${pistonY})`}>
            <rect 
              x="-36" y="0" width="72" height="40" 
              fill="#d1d5db" rx="2"
              onMouseEnter={() => setHoveredPart(PARTS_INFO.piston)}
              onMouseLeave={() => setHoveredPart(null)}
              className="cursor-help hover:fill-white"
            />
            {/* Connecting Rod Pin */}
            <circle cx="0" cy="20" r="5" fill="#4b5563" />
            {/* Connecting Rod (Visual approximation) */}
            <line 
              x1="0" y1="20" x2={isLeftBank ? 40 : -40} y2="100" 
              stroke="#6b7280" strokeWidth="8" strokeLinecap="round" 
              onMouseEnter={() => setHoveredPart(PARTS_INFO.conrod)}
              onMouseLeave={() => setHoveredPart(null)}
              className="cursor-help hover:stroke-gray-400"
            />
          </g>

          {/* Cylinder Number Label */}
          <text x="-50" y="50" fill="#6b7280" fontSize="10" fontWeight="bold">{i + 1}</text>
        </g>
      );
    }
    return cylinders;
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 w-full justify-center">
      
      {/* --- Controls Dashboard --- */}
      <div className="flex flex-col gap-6 bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-2xl w-full md:w-80 h-fit">
        <div className="flex justify-between items-center border-b border-gray-700 pb-4">
            <div>
                <div className="text-gray-400 text-xs font-mono">STATUS</div>
                <div className={`font-bold ${engineState === 'RUNNING' ? 'text-green-500' : engineState === 'STARTING' ? 'text-yellow-500' : 'text-red-500'}`}>
                    {engineState}
                </div>
            </div>
            <div>
                <div className="text-gray-400 text-xs font-mono text-right">RPM</div>
                <div className="font-mono text-2xl text-white">{Math.round(rpm)}</div>
            </div>
        </div>

        {/* Start Button */}
        <button
            onClick={toggleEngine}
            className={`
                w-full py-4 rounded-lg font-bold text-lg tracking-wider transition-all shadow-lg
                ${engineState === 'OFF' 
                    ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white' 
                    : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white'}
            `}
        >
            {engineState === 'OFF' ? 'START ENGINE' : 'STOP ENGINE'}
        </button>

        {/* Throttle Slider */}
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
            <label className="flex justify-between text-sm text-gray-300 mb-2">
                <span>Throttle</span>
                <span>{throttle}%</span>
            </label>
            <input 
                type="range" 
                min="0" 
                max="100" 
                value={throttle} 
                onChange={(e) => setThrottle(Number(e.target.value))}
                disabled={engineState === 'OFF'}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50"
            />
        </div>

        {/* Info Box */}
        <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-600 min-h-[140px]">
            <h3 className="text-blue-400 font-bold text-sm mb-2 uppercase">
                {hoveredPart ? hoveredPart.name : "System Info"}
            </h3>
            <p className="text-gray-300 text-sm leading-relaxed">
                {hoveredPart 
                    ? hoveredPart.description 
                    : "Hover over parts of the engine (Piston, Spark Plug, Valves) to learn how they work."}
            </p>
        </div>
        
        {/* Legend */}
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mt-2">
            <div className="flex items-center"><div className="w-2 h-2 rounded-full bg-blue-500/50 mr-2"></div>Intake</div>
            <div className="flex items-center"><div className="w-2 h-2 rounded-full bg-white/50 mr-2"></div>Compression</div>
            <div className="flex items-center"><div className="w-2 h-2 rounded-full bg-red-500/80 mr-2"></div>Power</div>
            <div className="flex items-center"><div className="w-2 h-2 rounded-full bg-gray-500/50 mr-2"></div>Exhaust</div>
        </div>
      </div>

      {/* --- SVG Engine View --- */}
      <div className="flex-1 flex justify-center items-center bg-gray-800/50 rounded-xl border border-gray-700 p-4 overflow-hidden shadow-inner">
        <svg 
            viewBox="0 0 400 450" 
            className="w-full max-w-[500px] h-auto"
            style={{ filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.5))' }}
        >
            <defs>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
                <linearGradient id="metal" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#374151" />
                    <stop offset="50%" stopColor="#4b5563" />
                    <stop offset="100%" stopColor="#374151" />
                </linearGradient>
            </defs>

            {/* Engine Block Background */}
            <path d="M 40 40 L 160 40 L 160 420 L 40 420 Z" fill="none" stroke="#374151" strokeWidth="1" strokeDasharray="4 4" />
            <path d="M 240 40 L 360 40 L 360 420 L 240 420 Z" fill="none" stroke="#374151" strokeWidth="1" strokeDasharray="4 4" />

            {/* Central Crankshaft Area */}
            <rect 
                x="160" y="20" width="80" height="410" 
                fill="#111827" stroke="#1f2937" 
                onMouseEnter={() => setHoveredPart(PARTS_INFO.crankshaft)}
                onMouseLeave={() => setHoveredPart(null)}
                className="cursor-help"
            />
            <line x1="200" y1="20" x2="200" y2="430" stroke="#374151" strokeWidth="2" strokeDasharray="5 5" />
            
            {/* Render Cylinders */}
            {renderCylinders()}

            {/* Labels */}
            <text x="100" y="30" fill="#4b5563" textAnchor="middle" fontSize="10" fontWeight="bold">LEFT BANK</text>
            <text x="300" y="30" fill="#4b5563" textAnchor="middle" fontSize="10" fontWeight="bold">RIGHT BANK</text>

        </svg>
      </div>

    </div>
  );
};

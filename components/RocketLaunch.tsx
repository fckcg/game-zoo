
import React, { useState, useEffect, useRef } from 'react';

type MissionPhase = 'IDLE' | 'COUNTDOWN' | 'LIFTOFF' | 'MAX_Q' | 'SEPARATION' | 'STAGE2' | 'ORBIT';

interface RocketPart {
  id: string;
  name: string;
  techName: string;
  desc: string;
}

const PARTS: Record<string, RocketPart> = {
  payload: { 
    id: 'payload', 
    name: '整流罩 & 卫星', 
    techName: 'PAYLOAD FAIRING',
    desc: '火箭的“帽子”。里面装着珍贵的卫星。在冲出大气层后，因为没有空气阻力了，为了减轻重量，它会像花瓣一样打开并扔掉。'
  },
  stage2: { 
    id: 'stage2', 
    name: '二级火箭', 
    techName: 'SECOND STAGE',
    desc: '接力棒的第二棒。当一级火箭掉落后，它开始工作，在真空中加速，把卫星最终推到每小时 27,000 公里的速度，让卫星绕着地球转。'
  },
  stage1: { 
    id: 'stage1', 
    name: '一级火箭 (助推器)', 
    techName: 'FIRST STAGE BOOSTER',
    desc: '大力士。它负责最艰难的任务：把火箭从地面推起来，对抗地球引力和浓密的空气。燃料用完后它会脱落，减轻重量。'
  },
  engine: { 
    id: 'engine', 
    name: '猛禽/梅林引擎', 
    techName: 'MAIN ENGINES',
    desc: '向下喷火，产生巨大的反作用力推着火箭向上飞。这叫“牛顿第三定律”。'
  }
};

// Atmosphere layers for educational visualization
const ATMOSPHERE_LAYERS = [
    { name: '外太空 (Space)', height: 1000, color: '#020617', icon: '✨' },
    { name: '热层 (Thermosphere)', height: 800, color: '#172554', icon: '🛰️' },
    { name: '中间层 (Mesosphere)', height: 500, color: '#1e3a8a', icon: '🌠' },
    { name: '平流层 (Stratosphere)', height: 200, color: '#3b82f6', icon: '🎈' },
    { name: '对流层 (Troposphere)', height: 0, color: '#60a5fa', icon: '✈️' },
];

export const RocketLaunch: React.FC = () => {
  const [phase, setPhase] = useState<MissionPhase>('IDLE');
  const [altitude, setAltitude] = useState(0); // Visual altitude units
  const [velocity, setVelocity] = useState(0); // Visual speed units
  const [fuel, setFuel] = useState(100);
  const [countdown, setCountdown] = useState(10);
  const [hoveredPart, setHoveredPart] = useState<RocketPart | null>(null);
  
  // Refs
  const reqRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // --- Audio System ---
  const initAudio = () => {
    if (audioCtxRef.current) return;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    audioCtxRef.current = new Ctx();
    const ctx = audioCtxRef.current!;
    
    // Pink Noise Generator
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5; 
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 100; 
    
    const gain = ctx.createGain();
    gain.gain.value = 0;
    
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start();
    
    gainNodeRef.current = gain;
  };

  const playSoundEvent = (type: 'BEEP' | 'SEPARATION' | 'ORBIT') => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g).connect(ctx.destination);

    if (type === 'BEEP') {
        osc.frequency.setValueAtTime(1200, t);
        osc.type = 'sine';
        g.gain.setValueAtTime(0.05, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.1);
    } else if (type === 'SEPARATION') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, t);
        osc.frequency.exponentialRampToValueAtTime(10, t + 0.8);
        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
        osc.start(t);
        osc.stop(t + 0.8);
    } else if (type === 'ORBIT') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.linearRampToValueAtTime(880, t + 2);
        g.gain.setValueAtTime(0.05, t);
        g.gain.linearRampToValueAtTime(0, t + 3);
        osc.start(t);
        osc.stop(t + 3);
    }
  };

  const updateEngineAudio = (active: boolean, intensity: number = 1) => {
    if (!gainNodeRef.current || !audioCtxRef.current) return;
    const now = audioCtxRef.current.currentTime;
    const targetVol = active ? 0.5 * intensity : 0;
    gainNodeRef.current.gain.setTargetAtTime(targetVol, now, 0.8);
  };

  // --- Logic ---
  const startSequence = () => {
    initAudio();
    if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
    if (phase !== 'IDLE') return;
    setPhase('COUNTDOWN');
    setCountdown(10);
  };

  const resetSimulator = () => {
    setPhase('IDLE');
    setAltitude(0);
    setVelocity(0);
    setFuel(100);
    setCountdown(10);
    updateEngineAudio(false);
  };

  // Countdown
  useEffect(() => {
    if (phase === 'COUNTDOWN') {
      if (countdown > 0) {
        const timer = setTimeout(() => {
            setCountdown(c => c - 1);
            playSoundEvent('BEEP');
        }, 1000);
        return () => clearTimeout(timer);
      } else {
        setPhase('LIFTOFF');
      }
    }
  }, [phase, countdown]);

  // Physics Loop
  useEffect(() => {
    const loop = () => {
      if (phase === 'LIFTOFF' || phase === 'MAX_Q') {
        updateEngineAudio(true, 1);
        setAltitude(prev => {
            const next = prev + (velocity / 800); 
            if (next > 250 && phase === 'LIFTOFF') setPhase('MAX_Q');
            if (next > 500) {
                setPhase('SEPARATION');
                playSoundEvent('SEPARATION');
                updateEngineAudio(true, 0.1); 
            }
            return next;
        });
        setVelocity(v => v + 12);
        setFuel(f => Math.max(f - 0.25, 0));
      } 
      else if (phase === 'SEPARATION') {
         setTimeout(() => {
            if (phase === 'SEPARATION') setPhase('STAGE2');
         }, 2000);
      }
      else if (phase === 'STAGE2') {
        updateEngineAudio(true, 0.6); 
        setAltitude(prev => {
            if (prev > 1100) {
                setPhase('ORBIT');
                playSoundEvent('ORBIT');
                updateEngineAudio(false);
                return prev;
            }
            return prev + (velocity / 800);
        });
        setVelocity(v => v + 20);
        setFuel(f => Math.max(f - 0.1, 0));
      }

      reqRef.current = requestAnimationFrame(loop);
    };
    reqRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(reqRef.current);
  }, [phase, velocity]);

  // --- Visual Calculations ---
  
  const getEnvironmentStyle = () => {
    if (phase === 'ORBIT') {
        return { background: '#000' };
    }
    const pct = Math.min(altitude / 1000, 1);
    const r = Math.max(96 - (96 * pct * 1.2), 0);
    const g = Math.max(165 - (165 * pct * 1.2), 0);
    const b = Math.max(250 - (250 * pct * 0.8), 10); 
    return { background: `rgb(${r},${g},${b})` };
  };

  const groundY = Math.min(altitude * 2, 800); 
  const shakeIntensity = (phase === 'LIFTOFF' || phase === 'MAX_Q') ? 3 : (phase === 'STAGE2' ? 0.5 : 0);
  const shake = `translate(${Math.random() * shakeIntensity - shakeIntensity/2}px, ${Math.random() * shakeIntensity - shakeIntensity/2}px)`;

  return (
    <div className="flex flex-col-reverse lg:flex-row h-full bg-slate-950 overflow-hidden font-sans">
      
      {/* --- LEFT (Mobile: Bottom): Mission Control Dashboard --- */}
      <div className="w-full lg:w-80 h-[45%] lg:h-full bg-slate-900 border-t lg:border-t-0 lg:border-r border-slate-800 p-4 flex flex-col gap-3 z-20 shadow-2xl overflow-y-auto shrink-0">
        
        {/* Main Status Monitor */}
        <div className="bg-black rounded-xl border border-slate-700 p-3 shadow-inner relative overflow-hidden group shrink-0">
            <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none opacity-20"></div>
            <div className="flex justify-between items-end mb-1">
                <span className="text-slate-500 font-mono text-[10px] tracking-widest">FLIGHT DATA</span>
                <div className={`w-2 h-2 rounded-full ${phase === 'IDLE' ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`}></div>
            </div>
            
            <div className="space-y-1">
                <div className="font-mono text-2xl md:text-3xl text-slate-100 tracking-tighter">
                    T {phase === 'IDLE' ? '-' : '+'} 
                    {phase === 'COUNTDOWN' 
                        ? `00:00:${countdown.toString().padStart(2, '0')}` 
                        : `00:00:${Math.floor(altitude/15).toString().padStart(2, '0')}`}
                </div>
                
                <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="bg-slate-900/50 p-1.5 rounded border border-slate-800">
                        <div className="text-[9px] text-slate-500 uppercase">Altitude</div>
                        <div className="text-blue-400 font-mono text-xs md:text-sm">{Math.round(altitude).toLocaleString()} <span className="text-[9px]">km</span></div>
                    </div>
                    <div className="bg-slate-900/50 p-1.5 rounded border border-slate-800">
                        <div className="text-[9px] text-slate-500 uppercase">Velocity</div>
                        <div className="text-blue-400 font-mono text-xs md:text-sm">{Math.round(velocity).toLocaleString()} <span className="text-[9px]">km/h</span></div>
                    </div>
                </div>
            </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 shrink-0">
             {phase === 'IDLE' ? (
                 <button 
                    onClick={startSequence}
                    className="group relative w-full h-12 md:h-14 bg-slate-800 rounded-lg border border-slate-700 overflow-hidden hover:border-green-500 transition-all"
                 >
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-green-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <span className="relative z-10 text-green-500 font-bold font-mono tracking-widest group-hover:text-green-400 transition-colors flex items-center justify-center gap-2">
                        LAUNCH
                    </span>
                    <div className="absolute bottom-0 left-0 h-1 w-full bg-slate-700">
                        <div className="h-full bg-green-600 w-0 group-hover:w-full transition-all duration-500"></div>
                    </div>
                 </button>
             ) : (
                <button 
                    onClick={resetSimulator}
                    className="w-full py-2 border border-slate-700 rounded text-slate-400 font-mono text-[10px] hover:bg-slate-800 hover:text-white transition-colors"
                >
                    RESET MISSION
                </button>
             )}
        </div>

        {/* Stage Status (Compact) */}
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 shrink-0">
             <div className={`text-xs font-mono flex items-center justify-between p-2 rounded ${phase === 'STAGE2' || phase === 'ORBIT' ? 'bg-slate-800 text-slate-500' : 'bg-green-900/20 text-green-400 border border-green-800'}`}>
                <span>STAGE 1</span>
                <span className="text-[10px]">{phase === 'SEPARATION' || phase === 'STAGE2' || phase === 'ORBIT' ? 'SEPARATED' : 'ACTIVE'}</span>
             </div>
             <div className={`text-xs font-mono flex items-center justify-between p-2 rounded ${phase === 'STAGE2' || phase === 'ORBIT' ? 'bg-green-900/20 text-green-400 border border-green-800' : 'bg-slate-800 text-slate-500'}`}>
                <span>STAGE 2</span>
                <span className="text-[10px]">{phase === 'ORBIT' ? 'COAST' : (phase === 'STAGE2' ? 'BURN' : 'STANDBY')}</span>
             </div>
        </div>

        {/* Educational Info Panel */}
        <div className="flex-1 border border-blue-500/30 bg-blue-900/10 rounded-xl p-3 md:p-4 relative overflow-y-auto custom-scrollbar">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50"></div>
            <h3 className="text-blue-400 font-bold text-[10px] md:text-xs mb-2 flex items-center gap-2 uppercase tracking-wider sticky top-0 bg-[#0f1928] py-1 z-10">
                {hoveredPart ? hoveredPart.techName : "SYSTEM DIAGNOSTIC"}
            </h3>
            <div className="text-slate-300 text-xs md:text-sm leading-relaxed">
                {hoveredPart ? (
                    <>
                        <strong className="block text-white text-sm md:text-base mb-1">{hoveredPart.name}</strong>
                        {hoveredPart.desc}
                    </>
                ) : (
                    <div className="space-y-2 opacity-80 text-xs">
                        <p>准备发射！点击火箭部位学习。</p>
                        <ul className="list-disc pl-4 space-y-1 mt-2 text-slate-400">
                            <li>一级火箭提供初始推力</li>
                            <li>二级火箭进入轨道</li>
                            <li>整流罩保护卫星</li>
                        </ul>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* --- RIGHT (Mobile: Top): Simulation Viewport --- */}
      <div className="flex-1 relative overflow-hidden transition-all duration-[2000ms]" style={getEnvironmentStyle()}>
        
        {/* Atmosphere Layer Indicator (Hidden on small screens) */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 h-[80%] w-16 z-30 hidden md:flex flex-col justify-between pointer-events-none">
            <div className="absolute right-0 top-0 w-1 h-full bg-slate-700/50 rounded-full"></div>
            <div 
                className="absolute right-[-6px] w-4 h-4 bg-white rounded-full shadow-[0_0_10px_white] transition-all duration-500 ease-out"
                style={{ bottom: `${Math.min((altitude / 1100) * 100, 100)}%` }}
            >
                <div className="absolute right-6 top-1/2 -translate-y-1/2 bg-black/60 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap backdrop-blur-sm">
                    {Math.round(altitude)}km
                </div>
            </div>

            {ATMOSPHERE_LAYERS.slice().reverse().map((layer) => (
                <div key={layer.name} className="flex items-center justify-end gap-2 relative h-full">
                   <div className="text-[9px] text-right text-white/70 font-mono leading-tight">
                      <span className="block opacity-50">{layer.icon}</span>
                      {layer.name}
                   </div>
                   <div className="w-2 h-[1px] bg-slate-500"></div>
                </div>
            ))}
        </div>

        {/* Stars */}
        <div className="absolute inset-0 transition-opacity duration-1000" style={{opacity: Math.max((altitude-50)/500, 0)}}>
            {[...Array(50)].map((_, i) => (
                <div key={i} className="absolute bg-white rounded-full animate-pulse" style={{
                    left: `${Math.random()*100}%`, 
                    top: `${Math.random()*100}%`,
                    width: Math.random() > 0.8 ? '3px' : '1px',
                    height: Math.random() > 0.8 ? '3px' : '1px',
                    opacity: Math.random(),
                    animationDuration: `${1 + Math.random() * 3}s`
                }} />
            ))}
        </div>

        {/* Earth View */}
        <div 
            className="absolute bottom-[-800px] left-1/2 -translate-x-1/2 w-[2000px] h-[1000px] rounded-[50%] bg-blue-900 shadow-[0_0_100px_rgba(59,130,246,0.5)] transition-all duration-[3000ms] z-0"
            style={{ 
                transform: phase === 'ORBIT' ? 'translateY(-500px)' : 'translateY(800px)',
                background: 'radial-gradient(circle at 50% 0%, #2563eb, #1e3a8a, #000)'
            }}
        >
             <div className="absolute inset-0 opacity-40 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48ZmlsdGVyIGlkPSJmIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iMC42NSIgbbnVtT2N0YXZlcz0iMyIgc3RpdGNoVGlsZXM9InN0aXRjaCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNmKSIgb3BhY2l0eT0iMC41Ii8+PC9zdmc+')]"></div>
        </div>

        {/* Clouds */}
        {phase !== 'IDLE' && phase !== 'ORBIT' && (
             <div className="absolute inset-0 opacity-20 pointer-events-none">
                {[...Array(8)].map((_, i) => (
                    <div 
                        key={i} 
                        className="absolute bg-white/30 rounded-full blur-2xl"
                        style={{
                            width: '400px',
                            height: '80px',
                            left: `${Math.random() * 100}%`,
                            top: '-20%',
                            animation: `cloudPass ${0.2 + Math.random() * 0.5}s linear infinite`,
                            animationDelay: `${Math.random() * 2}s`
                        }}
                    />
                ))}
             </div>
        )}

        {/* Ground/Launchpad */}
        <div 
            className="absolute bottom-0 left-0 w-full h-screen flex justify-center items-end pointer-events-none"
            style={{ transform: `translateY(${groundY}px)` }}
        >
             <div className="absolute bottom-0 w-full h-48 bg-gradient-to-t from-slate-900 via-slate-800 to-transparent"></div>
             <div className="relative mb-[120px] ml-[130px] w-20 h-[500px] flex flex-col items-center opacity-80">
                  <div className="w-6 h-full bg-slate-700 border-l-2 border-r-2 border-slate-900 relative">
                        {[...Array(15)].map((_,i) => (
                            <div key={i} className="absolute w-16 h-2 bg-slate-600 -left-5 border-b border-slate-800" style={{top: `${i*7}%`}}></div>
                        ))}
                  </div>
                  <div className="absolute top-20 -left-12 w-32 h-6 bg-slate-600 rounded-l shadow-lg"></div>
             </div>
             {phase === 'LIFTOFF' && altitude < 80 && (
                 <div className="absolute bottom-0 w-[600px] h-[400px] bg-gradient-to-t from-gray-200 to-transparent blur-[80px] rounded-full animate-pulse opacity-80 translate-y-20"></div>
             )}
        </div>

        {/* The Rocket */}
        <div 
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ transform: shake }}
        >
            <svg viewBox="0 0 300 700" className="h-[70vh] md:h-[80vh] overflow-visible drop-shadow-2xl pointer-events-auto">
                <defs>
                    <linearGradient id="bodyMetallic" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#64748b" />
                        <stop offset="30%" stopColor="#f1f5f9" />
                        <stop offset="50%" stopColor="#e2e8f0" />
                        <stop offset="70%" stopColor="#cbd5e1" />
                        <stop offset="100%" stopColor="#475569" />
                    </linearGradient>
                    <linearGradient id="fairingMetallic" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#cbd5e1" />
                        <stop offset="50%" stopColor="#ffffff" />
                        <stop offset="100%" stopColor="#94a3b8" />
                    </linearGradient>
                    <linearGradient id="fireCore" x1="0.5" y1="0" x2="0.5" y2="1">
                        <stop offset="0%" stopColor="#fff" stopOpacity="1" />
                        <stop offset="40%" stopColor="#60a5fa" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="transparent" />
                    </linearGradient>
                    <linearGradient id="fireOuter" x1="0.5" y1="0" x2="0.5" y2="1">
                        <stop offset="0%" stopColor="#fef08a" stopOpacity="0.9" />
                        <stop offset="30%" stopColor="#f97316" stopOpacity="0.7" />
                        <stop offset="100%" stopColor="transparent" />
                    </linearGradient>
                    <filter id="heatBlur">
                        <feGaussianBlur stdDeviation="4" />
                    </filter>
                </defs>

                <g 
                    transform={`translate(0, ${phase === 'SEPARATION' || phase === 'STAGE2' || phase === 'ORBIT' ? 600 : 0})`}
                    className="transition-transform duration-[3000ms] ease-in"
                    style={{ opacity: (phase === 'SEPARATION' || phase === 'STAGE2' || phase === 'ORBIT') ? 0 : 1 }}
                >
                    <path d="M 110 400 L 100 390 L 100 420 Z" fill="#333" />
                    <path d="M 190 400 L 200 390 L 200 420 Z" fill="#333" />
                    <rect 
                        x="110" y="250" width="80" height="300" 
                        fill="url(#bodyMetallic)" 
                        onClick={() => setHoveredPart(PARTS.stage1)}
                        className="cursor-pointer"
                    />
                    {[0,1,2,3,4].map(i => (
                        <rect key={i} x="110" y={280 + i*60} width="80" height="1" fill="#94a3b8" opacity="0.5" />
                    ))}
                    <rect x="135" y="280" width="30" height="20" fill="#1e293b" rx="2" />
                    <text x="150" y="294" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="monospace">USA</text>
                    <rect x="148" y="250" width="4" height="300" fill="#334155" opacity="0.8" />
                    <path d="M 110 520 L 105 550 L 120 520 Z" fill="#1e293b" />
                    <path d="M 190 520 L 195 550 L 180 520 Z" fill="#1e293b" />
                    <path d="M 145 520 L 150 550 L 155 520 Z" fill="#1e293b" />
                    <path d="M 115 550 L 120 570 L 180 570 L 185 550 Z" fill="#0f172a" />
                    {(phase === 'LIFTOFF' || phase === 'MAX_Q') && (
                        <g className="animate-[firePulse_0.1s_infinite]">
                            <path d="M 120 570 L 150 750 L 180 570 Z" fill="url(#fireOuter)" filter="url(#heatBlur)" />
                            <path d="M 130 570 L 150 700 L 170 570 Z" fill="url(#fireCore)" />
                            <ellipse cx="150" cy="600" rx="10" ry="5" fill="white" opacity="0.8" />
                            <ellipse cx="150" cy="630" rx="8" ry="4" fill="white" opacity="0.6" />
                            <ellipse cx="150" cy="660" rx="6" ry="3" fill="white" opacity="0.4" />
                        </g>
                    )}
                </g>

                <g 
                    transform={`translate(0, ${phase === 'ORBIT' ? 150 : 0})`} 
                    className="transition-transform duration-[2000ms]"
                >
                    <rect x="110" y="220" width="80" height="30" fill="#0f172a" />
                    <path d="M 110 250 L 190 250 L 190 255 L 110 255 Z" fill="#000" />
                    <path d="M 130 220 L 120 250 L 180 250 L 170 220 Z" fill="#334155" />
                    <rect 
                        x="110" y="140" width="80" height="80" 
                        fill="url(#bodyMetallic)" 
                        onClick={() => setHoveredPart(PARTS.stage2)}
                        className="cursor-pointer"
                    />
                    <rect x="148" y="140" width="4" height="80" fill="#334155" opacity="0.8" />
                    <text x="150" y="180" textAnchor="middle" fill="#64748b" fontSize="12" fontWeight="bold" transform="rotate(-90 150 180)">STAGE II</text>
                    {(phase === 'STAGE2') && (
                        <g className="animate-[firePulse_0.2s_infinite]">
                             <path d="M 120 250 Q 100 350 90 450 L 210 450 Q 200 350 180 250 Z" fill="url(#fireCore)" opacity="0.6" filter="url(#heatBlur)" />
                             <path d="M 130 250 L 150 400 L 170 250 Z" fill="#fff" opacity="0.8" />
                        </g>
                    )}
                </g>

                <g 
                    transform={`translate(0, ${phase === 'ORBIT' ? -20 : 0})`} 
                    onClick={() => setHoveredPart(PARTS.payload)}
                    className="cursor-pointer"
                >
                    <g className={`transition-all duration-[2000ms] ${phase === 'ORBIT' ? 'opacity-100 delay-1000' : 'opacity-0'}`}>
                        <rect x="135" y="80" width="30" height="40" fill="gold" stroke="#b45309" strokeWidth="2" rx="2" />
                        <circle cx="150" cy="100" r="10" fill="#3b82f6" opacity="0.5" /> 
                        <g className={`transition-transform duration-[3000ms] ease-out origin-right delay-[2000ms] ${phase === 'ORBIT' ? 'scale-x-100' : 'scale-x-0'}`}>
                            <rect x="55" y="90" width="80" height="20" fill="#172554" stroke="#3b82f6" />
                            <line x1="95" y1="90" x2="95" y2="110" stroke="#3b82f6" />
                        </g>
                        <g className={`transition-transform duration-[3000ms] ease-out origin-left delay-[2000ms] ${phase === 'ORBIT' ? 'scale-x-100' : 'scale-x-0'}`}>
                            <rect x="165" y="90" width="80" height="20" fill="#172554" stroke="#3b82f6" />
                            <line x1="205" y1="90" x2="205" y2="110" stroke="#3b82f6" />
                        </g>
                        <line x1="150" y1="80" x2="150" y2="50" stroke="#cbd5e1" strokeWidth="2" className={`transition-all duration-1000 delay-[3000ms] ${phase === 'ORBIT' ? 'h-full' : 'h-0'}`}/>
                        <circle cx="150" cy="50" r="4" fill="red" className={`transition-opacity duration-500 delay-[3500ms] ${phase === 'ORBIT' ? 'opacity-100 animate-ping' : 'opacity-0'}`} />
                    </g>
                    <path 
                        d="M 110 140 L 110 90 Q 110 20 150 10 L 150 140 Z" 
                        fill="url(#fairingMetallic)" 
                        stroke="#94a3b8" strokeWidth="1"
                        className={`transition-all duration-[3000ms] ease-in-out ${phase === 'ORBIT' ? '-translate-x-40 -translate-y-20 -rotate-45 opacity-0' : ''}`}
                    />
                    <path 
                        d="M 190 140 L 190 90 Q 190 20 150 10 L 150 140 Z" 
                        fill="url(#fairingMetallic)"
                        stroke="#94a3b8" strokeWidth="1"
                        className={`transition-all duration-[3000ms] ease-in-out ${phase === 'ORBIT' ? 'translate-x-40 -translate-y-20 rotate-45 opacity-0' : ''}`}
                    />
                </g>
            </svg>
            
            {phase === 'ORBIT' && (
                <div className="absolute top-10 text-center animate-bounce w-full px-4">
                    <div className="text-4xl mb-2">🛰️</div>
                    <div className="bg-green-900/80 text-green-100 px-4 py-2 rounded-full border border-green-500 backdrop-blur-md font-mono font-bold text-sm md:text-xl shadow-lg inline-block">
                        DEPLOYMENT SUCCESSFUL
                    </div>
                </div>
            )}
            {phase === 'COUNTDOWN' && (
                <div className="absolute top-1/3 text-[8rem] md:text-[12rem] font-black text-white/10 font-mono select-none pointer-events-none animate-ping">
                    {countdown}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

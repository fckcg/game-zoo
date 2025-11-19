
import React, { useState, useEffect, useRef, useMemo } from 'react';

// --- Types ---
interface Fraction {
  n: number; // numerator
  d: number; // denominator
}

interface Level {
  id: number;
  target: Fraction;
  availableSlices: Fraction[];
  name: string;
}

interface Topping {
  id: string;
  icon: string;
  name: string;
  unlockScore: number;
}

// --- Constants ---
const TOPPINGS: Topping[] = [
  { id: 'basil', icon: '🌿', name: 'Fresh Basil', unlockScore: 20 },
  { id: 'mushroom', icon: '🍄', name: 'Mushroom', unlockScore: 50 },
  { id: 'pepperoni', icon: '🍕', name: 'Pepperoni', unlockScore: 100 },
  { id: 'olive', icon: '🫒', name: 'Black Olive', unlockScore: 150 },
  { id: 'shrimp', icon: '🍤', name: 'Shrimp', unlockScore: 200 },
  { id: 'cheese', icon: '🧀', name: 'Extra Cheese', unlockScore: 300 },
];

// Helper to simplify fractions
const gcd = (a: number, b: number): number => (!b ? a : gcd(b, a % b));
const lcm = (a: number, b: number): number => (a * b) / gcd(a, b);

const simplify = (f: Fraction): Fraction => {
  const common = gcd(f.n, f.d);
  return { n: f.n / common, d: f.d / common };
};

const addFractions = (f1: Fraction, f2: Fraction): Fraction => {
  const commonD = lcm(f1.d, f2.d);
  const newN = f1.n * (commonD / f1.d) + f2.n * (commonD / f2.d);
  return { n: newN, d: commonD };
};

const subtractFractions = (f1: Fraction, f2: Fraction): Fraction => {
  const commonD = lcm(f1.d, f2.d);
  const newN = f1.n * (commonD / f1.d) - f2.n * (commonD / f2.d);
  return { n: newN, d: commonD };
};

const formatFraction = (f: Fraction) => {
  const s = simplify(f);
  if (s.n === s.d) return "1";
  if (s.n === 0) return "0";
  return `${s.n}/${s.d}`;
};

// Generate dynamic levels
const generateLevel = (difficulty: number): Level => {
  const denominators = 
    difficulty === 1 ? [2, 4] :
    difficulty === 2 ? [2, 4, 8] :
    difficulty === 3 ? [2, 3, 6] :
    [2, 3, 4, 5, 6, 8];

  const targetD = denominators[Math.floor(Math.random() * denominators.length)];
  const targetN = Math.floor(Math.random() * (targetD - 1)) + 1;
  
  const target = simplify({ n: targetN, d: targetD });

  const available: Fraction[] = [];
  denominators.forEach(d => available.push({n: 1, d}));
  
  return {
    id: Date.now(),
    target,
    availableSlices: available,
    name: difficulty === 1 ? "Easy Peasy" : difficulty === 2 ? "Getting Specific" : "Master Chef",
  };
};

export const PizzaMaster: React.FC = () => {
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [currentOrder, setCurrentOrder] = useState<Level>(generateLevel(1));
  const [plateSlices, setPlateSlices] = useState<Fraction[]>([]);
  const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');
  const [message, setMessage] = useState("");
  const [showCelebration, setShowCelebration] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);

  // --- Audio ---
  const initAudio = () => {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new Ctx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const playSound = (type: 'pop' | 'success' | 'error' | 'clear') => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain).connect(ctx.destination);

    if (type === 'pop') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(600, t + 0.1);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.1);
      osc.start(t);
      osc.stop(t + 0.1);
    } else if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.setValueAtTime(554, t + 0.1);
      osc.frequency.setValueAtTime(659, t + 0.2);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
      osc.start(t);
      osc.stop(t + 0.6);
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.linearRampToValueAtTime(100, t + 0.3);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.3);
    } else if (type === 'clear') {
        const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for(let i=0; i<data.length; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(1000, t);
        f.frequency.exponentialRampToValueAtTime(100, t + 0.2);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.2, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        noise.connect(f).connect(g).connect(ctx.destination);
        noise.start(t);
    }
  };

  // --- Logic ---
  const currentTotal = useMemo(() => {
    return plateSlices.reduce((acc, curr) => addFractions(acc, curr), { n: 0, d: 1 });
  }, [plateSlices]);

  const isOver = currentTotal.n / currentTotal.d > 1;

  const handleAddSlice = (slice: Fraction) => {
    initAudio();
    if (isOver) {
        playSound('error');
        setMessage("Overflow! Reset.");
        return; 
    }
    playSound('pop');
    setPlateSlices(prev => [...prev, slice]);
    setMessage("");
  };

  const handleReset = () => {
    initAudio();
    playSound('clear');
    setPlateSlices([]);
    setFeedback('none');
    setMessage("");
  };

  const handleServe = () => {
    initAudio();
    const totalVal = currentTotal.n / currentTotal.d;
    const targetVal = currentOrder.target.n / currentOrder.target.d;

    if (Math.abs(totalVal - targetVal) < 0.001) {
      setFeedback('success');
      playSound('success');
      const points = 10 + (plateSlices.length * 2); 
      setScore(s => s + points);
      setShowCelebration(true);
      setMessage("Delicious! Perfect Match!");
      
      setTimeout(() => {
        setShowCelebration(false);
        setFeedback('none');
        setPlateSlices([]);
        const newDiff = Math.floor((score + points) / 300) + 1;
        setLevel(Math.min(newDiff, 4));
        setCurrentOrder(generateLevel(Math.min(newDiff, 4)));
        setMessage("");
      }, 2000);
    } else {
      setFeedback('error');
      playSound('error');
      if (totalVal > targetVal) setMessage("Too much pizza!");
      else setMessage("Not enough pizza!");
    }
  };

  // --- SVG Path Generator ---
  const getSlicePath = (startAngle: number, fractionVal: number, radius: number = 100) => {
    const degrees = fractionVal * 360;
    const endAngle = startAngle + degrees;

    const startRad = (startAngle - 90) * Math.PI / 180;
    const endRad = (endAngle - 90) * Math.PI / 180;

    const x1 = 150 + radius * Math.cos(startRad);
    const y1 = 150 + radius * Math.sin(startRad);
    const x2 = 150 + radius * Math.cos(endRad);
    const y2 = 150 + radius * Math.sin(endRad);

    const largeArc = degrees > 180 ? 1 : 0;

    return `M 150 150 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  };

  return (
    <div className="flex flex-col h-full bg-orange-50 font-sans relative overflow-hidden">
      
      {/* Top Bar: Stats & Rewards */}
      <div className="bg-white p-2 md:p-3 shadow-sm flex justify-between items-center shrink-0 z-10 border-b border-orange-200">
        <div className="flex items-center gap-2 md:gap-4 overflow-x-auto no-scrollbar">
            <div className="bg-orange-100 text-orange-800 px-2 md:px-4 py-1 rounded-full font-bold border border-orange-200 text-xs md:text-sm whitespace-nowrap">
                Level {level}
            </div>
            <div className="flex gap-1">
                {TOPPINGS.map(t => (
                    <div 
                        key={t.id} 
                        className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center border transition-all ${score >= t.unlockScore ? 'bg-white border-green-400 shadow-sm scale-100 grayscale-0' : 'bg-slate-100 border-slate-200 scale-90 grayscale opacity-50'}`}
                    >
                        <span className="text-sm md:text-base">{t.icon}</span>
                    </div>
                ))}
            </div>
        </div>
        <div className="bg-yellow-100 text-yellow-700 px-3 py-1 md:px-6 md:py-2 rounded-full font-bold text-base md:text-xl shadow-inner border border-yellow-200 whitespace-nowrap ml-2">
            ${score}
        </div>
      </div>

      {/* Game Area */}
      <div className="flex-1 flex flex-col items-center justify-between p-4 gap-4 overflow-y-auto">
        
        {/* Top: Customer Order & Status */}
        <div className="w-full flex flex-col items-center shrink-0">
             <div className="bg-white p-4 rounded-2xl shadow-lg border-b-4 border-slate-200 w-full max-w-sm relative overflow-hidden flex items-center justify-between">
                {/* Pattern background */}
                <div className="absolute top-0 left-0 w-full h-2 bg-red-500 rotate-0"></div>
                
                <div className="flex flex-col items-start z-10">
                    <h3 className="text-slate-400 font-bold uppercase tracking-wider text-xs mb-1">Target</h3>
                    <div className="text-4xl font-black text-slate-800 leading-none">
                        {formatFraction(currentOrder.target)}
                    </div>
                </div>

                <div className="text-3xl animate-bounce">👨‍🍳</div>

                <div className="flex flex-col items-end z-10">
                    <h3 className="text-slate-400 font-bold uppercase tracking-wider text-xs mb-1">Plate</h3>
                    <div className={`text-4xl font-black leading-none ${currentTotal.n/currentTotal.d > currentOrder.target.n/currentOrder.target.d ? 'text-red-500' : 'text-blue-500'}`}>
                        {formatFraction(simplify(currentTotal))}
                    </div>
                </div>
             </div>
             
             {message && (
                <div className={`text-sm font-bold mt-2 py-1 px-3 rounded-full bg-white shadow-sm ${feedback === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                    {message}
                </div>
             )}
        </div>

        {/* Center: The Pizza Pan (Responsive) */}
        <div className="relative group shrink-0 flex justify-center items-center w-full">
            <div className="w-[280px] h-[280px] md:w-[320px] md:h-[320px] bg-slate-800 rounded-full shadow-2xl border-8 border-slate-700 flex items-center justify-center relative">
                <div className="absolute inset-2 border border-slate-600 rounded-full opacity-50"></div>
                
                <svg viewBox="0 0 300 300" className="w-full h-full p-4 drop-shadow-lg">
                    {plateSlices.map((slice, i) => {
                        let prevVal = 0;
                        for(let j=0; j<i; j++) {
                            prevVal += plateSlices[j].n / plateSlices[j].d;
                        }
                        const sliceVal = slice.n / slice.d;
                        const path = getSlicePath(prevVal * 360, sliceVal, 130);
                        
                        const hue = (slice.d * 55) % 360;
                        const color = `hsl(${hue}, 80%, 60%)`;

                        return (
                            <g key={i} className="animate-[scaleIn_0.3s_ease-out_forwards] origin-center">
                                <path 
                                    d={path} 
                                    fill={color} 
                                    stroke="white" 
                                    strokeWidth="2"
                                    className="hover:brightness-110 transition-all cursor-pointer"
                                />
                                {sliceVal > 0.08 && ( 
                                    <text 
                                        x="150" 
                                        y="150" 
                                        dy="5"
                                        textAnchor="middle" 
                                        fill="white" 
                                        fontWeight="bold" 
                                        fontSize="14"
                                        style={{ 
                                            transformBox: 'fill-box', 
                                            transformOrigin: 'center', 
                                            transform: `rotate(${(prevVal * 360) + (sliceVal * 180)}deg) translate(0, -70px) rotate(-${(prevVal * 360) + (sliceVal * 180)}deg)` 
                                        }}
                                    >
                                        1/{slice.d}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                    
                    {plateSlices.map((slice, i) => {
                         let prevVal = 0;
                         for(let j=0; j<i; j++) prevVal += plateSlices[j].n / plateSlices[j].d;
                         const sliceVal = slice.n / slice.d;
                         const angle = (prevVal * 360) + (sliceVal * 180); 
                         
                         const unlocked = TOPPINGS.filter(t => score >= t.unlockScore);
                         if (unlocked.length === 0) return null;
                         const topping = unlocked[unlocked.length - 1];

                         return (
                            <g key={`top-${i}`} style={{ 
                                transformBox: 'fill-box', 
                                transformOrigin: 'center', 
                                transform: `rotate(${angle}deg) translate(0, -60px) rotate(-${angle}deg)` 
                            }}>
                                <text x="150" y="150" fontSize="20" textAnchor="middle" dominantBaseline="middle" className="pointer-events-none opacity-90">
                                    {topping.icon}
                                </text>
                            </g>
                         );
                    })}
                </svg>
            </div>

            {showCelebration && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                    <div className="text-9xl animate-ping">🌟</div>
                </div>
            )}
        </div>

        {/* Bottom: Ingredients & Serve */}
        <div className="w-full max-w-md shrink-0 flex flex-col gap-3 pb-4">
            
            <div className="w-full overflow-x-auto pb-2 no-scrollbar">
                <div className="flex md:grid md:grid-cols-3 gap-2">
                    {currentOrder.availableSlices.map((slice, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleAddSlice(slice)}
                            className="shrink-0 group relative flex items-center gap-2 bg-white p-2 pr-4 rounded-xl shadow-sm border border-orange-100 hover:border-orange-300 hover:shadow-md hover:-translate-y-1 transition-all min-w-[100px]"
                        >
                            <svg width="30" height="30" viewBox="0 0 40 40" className="shrink-0">
                                <circle cx="20" cy="20" r="18" fill="#fef3c7" stroke="#fbbf24" strokeWidth="2"/>
                                <path d={`M 20 20 L 20 2 A 18 18 0 0 1 ${20 + 18 * Math.sin(2 * Math.PI / slice.d)} ${20 - 18 * Math.cos(2 * Math.PI / slice.d)} Z`} fill="#f97316" />
                            </svg>
                            <div className="font-bold text-slate-700 text-base font-mono">
                                1/{slice.d}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex gap-2">
                 <button 
                    onClick={handleReset}
                    className="flex-1 bg-red-100 hover:bg-red-200 text-red-600 font-bold py-3 rounded-xl transition-colors"
                 >
                    🗑️
                 </button>
                 <button 
                    onClick={handleServe}
                    className="flex-[3] bg-green-500 hover:bg-green-400 text-white font-bold py-3 rounded-xl shadow-[0_4px_0_rgb(21,128,61)] active:shadow-none active:translate-y-1 transition-all"
                 >
                    SERVE ORDER
                 </button>
            </div>
        </div>

      </div>

      <style>{`
        @keyframes scaleIn {
            from { transform: scale(0); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

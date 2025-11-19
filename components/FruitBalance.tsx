
import React, { useState, useEffect, useRef, useMemo } from 'react';

// --- Types ---
type FruitType = 'blueberry' | 'cherry' | 'lemon' | 'orange' | 'apple' | 'pineapple' | 'watermelon';

interface Fruit {
  type: FruitType;
  name: string;
  weight: number; // Virtual weight units
  color: string;
  icon: string;
}

interface Level {
  id: number;
  leftItems: FruitType[];
  inventory: FruitType[]; // What the user can use
  hint: string; // "Try using Lemons!" or "1 Apple = 2 Lemons"
}

// --- Constants ---
const FRUITS: Record<FruitType, Fruit> = {
  blueberry: { type: 'blueberry', name: 'Blueberry', weight: 1, color: '#3b82f6', icon: '🫐' },
  cherry: { type: 'cherry', name: 'Cherry', weight: 2, color: '#ef4444', icon: '🍒' },
  lemon: { type: 'lemon', name: 'Lemon', weight: 5, color: '#eab308', icon: '🍋' },
  orange: { type: 'orange', name: 'Orange', weight: 7, color: '#f97316', icon: '🍊' },
  apple: { type: 'apple', name: 'Apple', weight: 10, color: '#ef4444', icon: '🍎' },
  pineapple: { type: 'pineapple', name: 'Pineapple', weight: 20, color: '#eab308', icon: '🍍' },
  watermelon: { type: 'watermelon', name: 'Watermelon', weight: 50, color: '#16a34a', icon: '🍉' },
};

const LEVELS: Level[] = [
  {
    id: 1,
    leftItems: ['apple'],
    inventory: ['apple'],
    hint: "Start simple! Make both sides equal.",
  },
  {
    id: 2,
    leftItems: ['apple'],
    inventory: ['lemon'],
    hint: "Lemons are lighter than Apples. How many do you need?",
  },
  {
    id: 3,
    leftItems: ['orange', 'blueberry'],
    inventory: ['cherry'],
    hint: "An Orange is 7, Blueberry is 1. A Cherry is 2. Do the math!",
  },
  {
    id: 4,
    leftItems: ['pineapple'],
    inventory: ['apple'],
    hint: "The Pineapple is heavy! Try stacking Apples.",
  },
  {
    id: 5,
    leftItems: ['pineapple'],
    inventory: ['lemon', 'apple'],
    hint: "You can mix fruits! Use Apples and Lemons.",
  },
  {
    id: 6,
    leftItems: ['watermelon'],
    inventory: ['pineapple', 'apple', 'lemon'],
    hint: "The Big Boss Watermelon! It weighs 50!",
  }
];

export const FruitBalance: React.FC = () => {
  const [levelIndex, setLevelIndex] = useState(0);
  const [rightItems, setRightItems] = useState<FruitType[]>([]);
  const [tilt, setTilt] = useState(0); // Degrees: negative = left heavy, positive = right heavy
  const [isBalanced, setIsBalanced] = useState(false);
  const [showWin, setShowWin] = useState(false);

  // Audio
  const audioCtxRef = useRef<AudioContext | null>(null);

  const currentLevel = LEVELS[levelIndex];

  // --- Physics Logic ---
  const leftWeight = useMemo(() => {
    return currentLevel.leftItems.reduce((acc, item) => acc + FRUITS[item].weight, 0);
  }, [currentLevel]);

  const rightWeight = useMemo(() => {
    return rightItems.reduce((acc, item) => acc + FRUITS[item].weight, 0);
  }, [rightItems]);

  // Calculate Tilt whenever weights change
  useEffect(() => {
    const diff = rightWeight - leftWeight;
    // Max tilt is +/- 20 degrees
    // Sensitivity: 1 weight unit = approx 2 degrees tilt
    let targetTilt = diff * 1.5;
    targetTilt = Math.max(-25, Math.min(25, targetTilt));
    
    setTilt(targetTilt);
    
    if (diff === 0 && leftWeight > 0) {
      setIsBalanced(true);
      if (!showWin) playSound('balance');
    } else {
      setIsBalanced(false);
    }
  }, [leftWeight, rightWeight]);

  // --- Audio Engine ---
  const initAudio = () => {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new Ctx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const playSound = (type: 'add' | 'remove' | 'balance' | 'win') => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain).connect(ctx.destination);

    if (type === 'add') {
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.linearRampToValueAtTime(200, t + 0.1);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.1);
      osc.start(t);
      osc.stop(t + 0.1);
    } else if (type === 'remove') {
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.linearRampToValueAtTime(300, t + 0.1);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.1);
      osc.start(t);
      osc.stop(t + 0.1);
    } else if (type === 'balance') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t);
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.start(t);
      osc.stop(t + 0.5);
    } else if (type === 'win') {
      // Major Chord Arpeggio
      const now = t;
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g).connect(ctx.destination);
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.1, now + i * 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.5);
        o.start(now + i * 0.1);
        o.stop(now + i * 0.1 + 0.5);
      });
    }
  };

  // --- Interaction ---
  const handleAddFruit = (fruit: FruitType) => {
    initAudio();
    if (showWin) return;
    setRightItems(prev => [...prev, fruit]);
    playSound('add');
  };

  const handleRemoveFruit = (index: number) => {
    initAudio();
    if (showWin) return;
    setRightItems(prev => prev.filter((_, i) => i !== index));
    playSound('remove');
  };

  const handleCheck = () => {
    initAudio();
    if (isBalanced) {
      setShowWin(true);
      playSound('win');
    }
  };

  const nextLevel = () => {
    setShowWin(false);
    setRightItems([]);
    if (levelIndex < LEVELS.length - 1) {
      setLevelIndex(l => l + 1);
    } else {
      // Loop or simple reset for now
      setLevelIndex(0);
    }
  };

  // --- Rendering Helpers ---
  const getRotationStyle = (deg: number) => ({
    transform: `rotate(${deg}deg)`,
    transition: 'transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)', // Springy physics
  });

  return (
    <div className="flex flex-col h-full bg-emerald-50 relative font-sans overflow-hidden select-none">
      
      {/* Header Area */}
      <div className="absolute top-0 left-0 w-full p-3 md:p-4 flex justify-between items-start z-10 pointer-events-none">
        <div className="bg-white/90 backdrop-blur p-3 md:p-4 rounded-2xl shadow-lg border border-emerald-100 max-w-[70%] md:max-w-xs pointer-events-auto">
           <h2 className="text-emerald-800 font-bold text-base md:text-lg flex items-center gap-2">
              <span>⚖️</span> Market Balance
           </h2>
           <p className="text-emerald-600 text-xs md:text-sm mt-1 leading-tight">{currentLevel.hint}</p>
        </div>
        <div className="bg-yellow-400 text-yellow-900 font-bold px-3 py-1 md:px-4 md:py-2 rounded-full shadow-lg border border-yellow-500 text-sm md:text-base">
           Level {levelIndex + 1}
        </div>
      </div>

      {/* Main Game Area - Scaled for mobile */}
      <div className="flex-1 flex items-center justify-center relative mt-12 md:mt-0 w-full overflow-hidden">
         
         {/* --- THE SCALE (Responsive Scaling) --- */}
         <div className="relative w-[600px] h-[400px] flex justify-center origin-center scale-[0.55] sm:scale-75 md:scale-100 shrink-0">
            
            {/* Scale Base (Static) */}
            <div className="absolute bottom-0 w-8 h-64 bg-gradient-to-r from-amber-700 to-amber-800 rounded-t-lg shadow-xl z-0"></div>
            <div className="absolute bottom-0 w-48 h-8 bg-amber-900 rounded-full shadow-lg z-0"></div>

            {/* Rotating Arm Group */}
            <div className="absolute top-[80px] w-[500px] h-[20px]" style={{ ...getRotationStyle(tilt), transformOrigin: 'center' }}>
                 {/* The Beam */}
                 <div className="w-full h-full bg-gradient-to-b from-amber-200 to-amber-500 rounded-full shadow-md border border-amber-600 relative">
                     {/* Center Pivot Point */}
                     <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-amber-600 border-2 border-amber-300 shadow-inner z-20"></div>
                 </div>

                 {/* Left Chain & Plate */}
                 <div className="absolute left-0 top-2 flex flex-col items-center" style={{ 
                     transform: `rotate(${-tilt}deg)`, // Counter-rotate to keep plate level
                     transformOrigin: 'top center',
                     transition: 'transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                 }}>
                     <div className="w-1 h-32 bg-amber-400/50"></div>
                     <div className="w-40 h-12 bg-gradient-to-b from-slate-200 to-slate-300 rounded-b-full border-t-4 border-slate-300 shadow-lg flex justify-center items-end pb-2 relative">
                        {/* Fruits on Left Plate */}
                        <div className="flex gap-1 items-end flex-wrap justify-center absolute bottom-2 w-full px-4">
                            {currentLevel.leftItems.map((item, i) => (
                                <div key={i} className="text-4xl animate-[bounce_0.5s_ease-out]" style={{ filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.2))' }}>
                                    {FRUITS[item].icon}
                                </div>
                            ))}
                        </div>
                     </div>
                 </div>

                 {/* Right Chain & Plate */}
                 <div className="absolute right-0 top-2 flex flex-col items-center" style={{ 
                     transform: `rotate(${-tilt}deg)`, // Counter-rotate to keep plate level
                     transformOrigin: 'top center',
                     transition: 'transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                 }}>
                     <div className="w-1 h-32 bg-amber-400/50"></div>
                     <div 
                        className="w-40 h-12 bg-gradient-to-b from-slate-200 to-slate-300 rounded-b-full border-t-4 border-slate-300 shadow-lg flex justify-center items-end pb-2 cursor-pointer hover:brightness-105 transition-all relative"
                        title="Click fruits here to remove"
                     >
                         {/* Fruits on Right Plate */}
                         <div className="flex gap-1 items-end flex-wrap justify-center absolute bottom-2 w-full px-4">
                            {rightItems.map((item, i) => (
                                <button 
                                    key={i} 
                                    onClick={(e) => { e.stopPropagation(); handleRemoveFruit(i); }}
                                    className="text-4xl hover:scale-110 transition-transform animate-[bounce_0.5s_ease-out]"
                                    style={{ filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.2))' }}
                                >
                                    {FRUITS[item].icon}
                                </button>
                            ))}
                             {rightItems.length === 0 && (
                                 <div className="text-slate-400 text-xs mb-2 font-bold opacity-50 uppercase tracking-wider pointer-events-none">Drop Here</div>
                             )}
                        </div>
                     </div>
                 </div>
            </div>

            {/* Balance Indicator Gauge (Center Top) */}
            <div className="absolute top-[40px] left-1/2 -translate-x-1/2 w-24 h-12 bg-white rounded-t-full border-2 border-slate-200 shadow-inner flex justify-center overflow-hidden">
                 {/* Green Zone */}
                 <div className="absolute bottom-0 w-2 h-4 bg-green-400 z-0"></div>
                 {/* Needle */}
                 <div 
                    className="absolute bottom-0 w-1 h-10 bg-red-500 origin-bottom transition-transform duration-700 ease-out z-10 rounded-full"
                    style={{ transform: `rotate(${tilt * 2}deg)` }} // Needle moves with tilt
                 ></div>
            </div>

         </div>

         {/* Win Overlay */}
         {showWin && (
             <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 animate-[fadeIn_0.3s_ease-out] p-4">
                 <div className="bg-white p-6 md:p-8 rounded-3xl shadow-2xl text-center transform animate-[popIn_0.5s_cubic-bezier(0.175,0.885,0.32,1.275)] w-full max-w-sm">
                     <div className="text-6xl md:text-8xl mb-4">⚖️✨</div>
                     <h3 className="text-2xl md:text-3xl font-bold text-emerald-600 mb-2">Perfect Balance!</h3>
                     <p className="text-slate-500 mb-6">You solved it!</p>
                     <button 
                        onClick={nextLevel}
                        className="bg-emerald-500 hover:bg-emerald-400 text-white text-lg md:text-xl font-bold py-3 px-8 md:py-4 md:px-12 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 w-full"
                     >
                        Next Level ➡️
                     </button>
                 </div>
             </div>
         )}

      </div>

      {/* Bottom Controls: Inventory */}
      <div className="bg-white border-t border-emerald-100 p-3 md:p-4 pb-6 md:pb-8 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] shrink-0">
         <div className="max-w-2xl mx-auto">
            <div className="flex justify-between items-end mb-2">
                <h3 className="text-emerald-900 font-bold uppercase text-xs tracking-widest">Your Basket</h3>
                <button 
                    onClick={handleCheck}
                    disabled={!isBalanced || showWin}
                    className={`
                        px-4 py-2 rounded-full font-bold text-xs md:text-sm transition-all
                        ${isBalanced 
                            ? 'bg-green-500 text-white hover:bg-green-400 shadow-lg shadow-green-500/30 animate-pulse' 
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'}
                    `}
                >
                    {isBalanced ? "CHECK!" : "Not Balanced"}
                </button>
            </div>
            
            <div className="flex gap-3 md:gap-4 overflow-x-auto no-scrollbar bg-emerald-50 p-3 md:p-4 rounded-2xl border border-emerald-100 min-h-[80px] items-center">
                {currentLevel.inventory.map((fruitType) => (
                    <button
                        key={fruitType}
                        onClick={() => handleAddFruit(fruitType)}
                        disabled={showWin}
                        className="group relative flex flex-col items-center gap-1 transition-transform active:scale-95 hover:-translate-y-1 focus:outline-none shrink-0"
                    >
                        <div className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-full shadow-sm border-2 border-emerald-100 flex items-center justify-center text-2xl md:text-4xl group-hover:shadow-md group-hover:border-emerald-300 transition-all">
                            {FRUITS[fruitType].icon}
                        </div>
                        <span className="text-[10px] md:text-xs font-bold text-emerald-700 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {FRUITS[fruitType].name}
                        </span>
                    </button>
                ))}
            </div>
         </div>
      </div>

      <style>{`
        @keyframes popIn {
            0% { transform: scale(0.5); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

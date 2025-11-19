
import React, { useState, useEffect, useRef } from 'react';

// --- Types ---
type Operator = '+' | '-' | 'x' | '/';

interface Chip {
  id: string;
  op: Operator;
  val: number;
  color: string;
}

interface Level {
  id: number;
  name: string;
  startNum: number;
  targetNum: number;
  slots: number; // How many machines in the chain
  availableChips: Chip[];
  hint: string;
}

interface RobotPart {
  id: string;
  type: 'head' | 'body' | 'arms' | 'legs';
  name: string;
  icon: string;
}

// --- Constants ---
const LEVELS: Level[] = [
  {
    id: 1,
    name: "The Beginning",
    startNum: 2,
    targetNum: 5,
    slots: 1,
    availableChips: [
      { id: 'c1', op: '+', val: 3, color: 'bg-blue-500' },
      { id: 'c2', op: '+', val: 5, color: 'bg-blue-500' },
      { id: 'c3', op: '-', val: 1, color: 'bg-red-500' },
    ],
    hint: "2 plus what equals 5?"
  },
  {
    id: 2,
    name: "Double Trouble",
    startNum: 3,
    targetNum: 6,
    slots: 1,
    availableChips: [
      { id: 'c1', op: '+', val: 2, color: 'bg-blue-500' },
      { id: 'c2', op: 'x', val: 2, color: 'bg-purple-500' },
      { id: 'c3', op: '-', val: 3, color: 'bg-red-500' },
    ],
    hint: "Which machine doubles the number?"
  },
  {
    id: 3,
    name: "Order Matters",
    startNum: 2,
    targetNum: 10,
    slots: 2,
    availableChips: [
      { id: 'c1', op: '+', val: 3, color: 'bg-blue-500' },
      { id: 'c2', op: 'x', val: 2, color: 'bg-purple-500' },
    ],
    hint: "(2 + 3) x 2 = 10, but (2 x 2) + 3 = 7. Be careful!"
  },
  {
    id: 4,
    name: "Reduction",
    startNum: 20,
    targetNum: 8,
    slots: 2,
    availableChips: [
      { id: 'c1', op: '/', val: 2, color: 'bg-orange-500' },
      { id: 'c2', op: '-', val: 2, color: 'bg-red-500' },
      { id: 'c3', op: '+', val: 5, color: 'bg-blue-500' },
    ],
    hint: "Try dividing first, then subtracting."
  },
  {
    id: 5,
    name: "Complex Chain",
    startNum: 5,
    targetNum: 16,
    slots: 3,
    availableChips: [
      { id: 'c1', op: '+', val: 3, color: 'bg-blue-500' },
      { id: 'c2', op: 'x', val: 2, color: 'bg-purple-500' },
      { id: 'c3', op: '-', val: 4, color: 'bg-red-500' },
      { id: 'c4', op: '+', val: 1, color: 'bg-blue-500' },
    ],
    hint: "Build the number up, then double it?"
  },
  {
      id: 6,
      name: "Zero Hero",
      startNum: 8,
      targetNum: 0,
      slots: 2,
      availableChips: [
          { id: 'c1', op: '-', val: 4, color: 'bg-red-500'},
          { id: 'c2', op: 'x', val: 0, color: 'bg-purple-500'}, // trick
          { id: 'c3', op: '-', val: 4, color: 'bg-red-500'}
      ],
      hint: "You can subtract twice."
  }
];

const ROBOT_PARTS: RobotPart[] = [
    { id: 'head1', type: 'head', name: 'Bot Head', icon: '🤖' },
    { id: 'body1', type: 'body', name: 'Core Unit', icon: '🎛️' },
    { id: 'arms1', type: 'arms', name: 'Clamp Arms', icon: '🦾' },
    { id: 'legs1', type: 'legs', name: 'Tracks', icon: '🚜' },
    { id: 'head2', type: 'head', name: 'Alien Head', icon: '👽' },
    { id: 'body2', type: 'body', name: 'Reactor', icon: '☢️' },
];

export const NumberFactory: React.FC = () => {
  const [levelIndex, setLevelIndex] = useState(0);
  const [placedChips, setPlacedChips] = useState<(Chip | null)[]>([]);
  const [selectedChip, setSelectedChip] = useState<Chip | null>(null);
  
  // Animation State
  const [isRunning, setIsRunning] = useState(false);
  const [turboMode, setTurboMode] = useState(false);
  const [animStep, setAnimStep] = useState(-1); // -1: Idle, 0: Start, 1..n: Slots, n+1: End
  const [currentValue, setCurrentValue] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isFail, setIsFail] = useState(false);
  
  const [unlockedParts, setUnlockedParts] = useState<string[]>([]);

  const audioCtxRef = useRef<AudioContext | null>(null);

  const level = LEVELS[levelIndex];
  const speedMult = turboMode ? 0.3 : 1;

  // Init Level
  useEffect(() => {
      setPlacedChips(new Array(level.slots).fill(null));
      setIsRunning(false);
      setAnimStep(-1);
      setCurrentValue(level.startNum);
      setIsSuccess(false);
      setIsFail(false);
      setSelectedChip(null);
  }, [levelIndex]);

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

  const playSound = (type: 'click' | 'machine' | 'conveyor' | 'win' | 'fail') => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain).connect(ctx.destination);

    if (type === 'click') {
        osc.frequency.setValueAtTime(800, t);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc.start(t);
        osc.stop(t + 0.05);
    } else if (type === 'machine') {
        // Clank
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, t);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.1);
    } else if (type === 'conveyor') {
        // Low hum
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, t);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.linearRampToValueAtTime(0, t + (0.3 * speedMult));
        osc.start(t);
        osc.stop(t + (0.3 * speedMult));
    } else if (type === 'win') {
        // Victory
        [440, 554, 659, 880].forEach((f, i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g).connect(ctx.destination);
            o.type = 'triangle';
            o.frequency.value = f;
            g.gain.setValueAtTime(0.1, t + i*0.1);
            g.gain.exponentialRampToValueAtTime(0.001, t + i*0.1 + 0.5);
            o.start(t + i*0.1);
            o.stop(t + i*0.1 + 0.5);
        });
    } else if (type === 'fail') {
        // Buzz
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.linearRampToValueAtTime(50, t + 0.4);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.4);
        osc.start(t);
        osc.stop(t + 0.4);
    }
  };

  // --- Logic ---
  const handleChipSelect = (chip: Chip) => {
      initAudio();
      playSound('click');
      setSelectedChip(chip);
  };

  const handleSlotClick = (index: number) => {
      initAudio();
      if (isRunning) return;
      
      const newChips = [...placedChips];
      if (selectedChip) {
          playSound('machine');
          newChips[index] = selectedChip;
          setSelectedChip(null); // Deselect after placement for better flow
      } else {
          // Remove if clicking empty/filled slot without selection
          if (newChips[index]) {
              playSound('click');
              newChips[index] = null;
          }
      }
      setPlacedChips(newChips);
      setIsFail(false);
      setIsSuccess(false);
      setAnimStep(-1);
      setCurrentValue(level.startNum);
  };

  const runSimulation = () => {
      initAudio();
      setIsRunning(true);
      setIsFail(false);
      setIsSuccess(false);
      setAnimStep(0); // Start pos
      setCurrentValue(level.startNum);

      processStep(0, level.startNum);
  };

  const processStep = (stepIndex: number, currentVal: number) => {
      // Step Index maps to:
      // 0: Initial Conveyor start
      // 1: Processed by Machine 1
      // 2: Processed by Machine 2...
      // n: Final Result

      if (stepIndex >= level.slots) {
          // Finished
          setTimeout(() => {
              setAnimStep(level.slots + 1); // Move to end bin
              playSound('conveyor');
              
              setTimeout(() => {
                 if (currentVal === level.targetNum) {
                     setIsSuccess(true);
                     playSound('win');
                     // Unlock part?
                     const partToUnlock = ROBOT_PARTS[levelIndex % ROBOT_PARTS.length];
                     if (!unlockedParts.includes(partToUnlock.id)) {
                         setUnlockedParts(p => [...p, partToUnlock.id]);
                     }
                 } else {
                     setIsFail(true);
                     playSound('fail');
                 }
                 setIsRunning(false);
              }, 800 * speedMult);
          }, 1000 * speedMult);
          return;
      }

      // Move into machine
      setTimeout(() => {
          setAnimStep(stepIndex + 1);
          playSound('conveyor');

          // Apply math
          setTimeout(() => {
              const chip = placedChips[stepIndex];
              let nextVal = currentVal;
              if (chip) {
                  playSound('machine');
                  if (chip.op === '+') nextVal += chip.val;
                  if (chip.op === '-') nextVal -= chip.val;
                  if (chip.op === 'x') nextVal *= chip.val;
                  if (chip.op === '/') nextVal /= chip.val;
              }
              setCurrentValue(nextVal);
              
              // Next Step
              processStep(stepIndex + 1, nextVal);

          }, 1000 * speedMult); // Time inside machine
      }, 1000 * speedMult); // Time on belt
  };

  const handleNextLevel = () => {
      if (levelIndex < LEVELS.length - 1) {
          setLevelIndex(l => l + 1);
      } else {
          setLevelIndex(0); // Loop
      }
  };

  return (
    <div className="flex flex-col h-full bg-indigo-950 text-indigo-100 font-sans relative overflow-hidden selection:bg-pink-500">
      
      {/* Header */}
      <div className="p-3 md:p-4 flex justify-between items-center z-20 bg-indigo-900/50 border-b border-indigo-800 shrink-0">
          <div>
              <h2 className="text-base md:text-2xl font-black text-pink-400 uppercase tracking-widest flex items-center gap-2">
                🏭 Num Factory
              </h2>
              <div className="text-xs text-indigo-400">Level {level.id}: {level.name}</div>
          </div>
          
          <div className="flex gap-2 bg-black/30 p-2 rounded-lg">
             {unlockedParts.slice(0,4).map(id => {
                 const p = ROBOT_PARTS.find(rp => rp.id === id);
                 return <span key={id} className="text-lg md:text-xl" title={p?.name}>{p?.icon}</span>
             })}
             {unlockedParts.length > 4 && <span className="text-xs flex items-center">+{unlockedParts.length - 4}</span>}
             {unlockedParts.length === 0 && <span className="text-xs text-indigo-500 italic hidden md:block">Build a robot...</span>}
          </div>
      </div>

      {/* Main Factory Floor - SCALED FOR MOBILE */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-0 overflow-hidden">
          
          {/* Background Elements */}
          <div className="absolute inset-0 opacity-10 pointer-events-none">
              <div className="absolute top-10 left-20 w-32 h-32 border-4 border-dashed border-indigo-500 rounded-full animate-[spin_10s_linear_infinite]"></div>
              <div className="absolute bottom-20 right-20 w-48 h-48 border-4 border-dashed border-pink-500 rounded-full animate-[spin_15s_linear_infinite_reverse]"></div>
          </div>

          {/* --- THE CONVEYOR BELT (Scaled Container) --- */}
          <div className="w-full flex items-center justify-center" style={{ transform: 'scale(0.85)', transformOrigin: 'center' }}>
              <div className="relative w-[800px] max-w-4xl h-64 flex items-center justify-center shrink-0">
                
                {/* Belt Track */}
                <div className="absolute bottom-8 w-full h-4 bg-gray-800 rounded-full overflow-hidden">
                    <div className={`w-[200%] h-full bg-[repeating-linear-gradient(90deg,transparent,transparent_20px,#4b5563_20px,#4b5563_40px)] ${isRunning ? 'animate-[slideRight_1s_linear_infinite]' : ''}`} style={{ animationDuration: turboMode ? '0.3s' : '1s' }}></div>
                </div>

                {/* Start Bin */}
                <div className="absolute left-0 bottom-10 w-24 h-32 bg-slate-700 rounded-lg border-b-4 border-slate-900 flex flex-col items-center justify-center shadow-xl z-10">
                    <div className="text-xs text-slate-400 uppercase font-bold mb-2">Input</div>
                    <div className="text-4xl font-black text-green-400 bg-black/50 px-3 py-1 rounded border border-green-500/30 font-mono">
                        {level.startNum}
                    </div>
                </div>

                {/* Machines (Slots) */}
                <div className="flex gap-8 items-end relative z-20 mb-12">
                    {placedChips.map((chip, i) => (
                        <div key={i} className="flex flex-col items-center gap-2 group">
                            {/* The Machine Housing */}
                            <button 
                                onClick={() => handleSlotClick(i)}
                                className={`
                                    w-24 h-32 rounded-xl border-4 transition-all relative overflow-hidden flex items-center justify-center
                                    ${chip ? 'bg-slate-800 border-slate-600' : 'bg-indigo-900/30 border-indigo-500/50 border-dashed hover:bg-indigo-800/50'}
                                    ${isRunning && animStep === i + 1 ? 'scale-110 ring-4 ring-yellow-400 z-30 shadow-[0_0_30px_rgba(250,204,21,0.5)]' : ''}
                                `}
                            >
                                {chip ? (
                                    <div className={`flex flex-col items-center ${chip.color} w-full h-full justify-center text-white`}>
                                        <span className="text-3xl md:text-5xl font-black drop-shadow-md">
                                            {chip.op}{chip.val}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-indigo-500/50 text-xs uppercase font-bold">Tap to Add</span>
                                )}
                                
                                {/* Machine Status Light */}
                                <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${isRunning && animStep === i + 1 ? 'bg-red-500 animate-ping' : 'bg-slate-900'}`}></div>
                            </button>
                            
                            {/* Connection Pipe */}
                            <div className="w-2 h-8 bg-slate-600"></div>
                        </div>
                    ))}
                </div>

                {/* End Bin */}
                <div className="absolute right-0 bottom-10 w-24 h-32 bg-slate-700 rounded-lg border-b-4 border-slate-900 flex flex-col items-center justify-center shadow-xl z-10">
                    <div className="text-xs text-slate-400 uppercase font-bold mb-2">Target</div>
                    <div className="text-4xl font-black text-yellow-400 bg-black/50 px-3 py-1 rounded border border-yellow-500/30 font-mono">
                        {level.targetNum}
                    </div>
                </div>

                {/* --- MOVING NUMBER (The Product) --- */}
                {/* We position this absolutely based on animStep */}
                <div 
                    className={`
                        absolute bottom-16 z-40 transition-all ease-in-out
                        ${animStep === -1 ? 'opacity-0 scale-0' : 'opacity-100 scale-100'}
                    `}
                    style={{
                        left: animStep <= 0 ? '40px' : animStep > level.slots ? '760px' : `${140 + (animStep * (540 / (level.slots + 1)))}px`,
                        // Jump up when processing inside machine
                        transform: `translateY(${animStep > 0 && animStep <= level.slots ? '-40px' : '0px'})`,
                        transitionDuration: `${turboMode ? 300 : 1000}ms`
                    }}
                >
                    <div className={`
                        w-14 h-14 rounded-lg bg-white text-indigo-900 font-black text-2xl flex items-center justify-center shadow-2xl border-4 border-indigo-200
                        ${animStep > 0 && animStep <= level.slots ? 'animate-[spin_1s_linear_infinite]' : ''}
                    `}>
                        {currentValue}
                    </div>
                </div>
            </div>
          </div>

          {/* Message Area (Below conveyor) */}
          <div className="h-16 w-full px-4 flex items-center justify-center mt-2">
              {isFail && (
                  <div className="bg-red-500 text-white px-4 py-2 rounded-full font-bold animate-bounce shadow-lg text-sm md:text-base text-center">
                      Result: {currentValue}. Needed {level.targetNum}.
                  </div>
              )}
              {isSuccess && (
                  <div className="bg-green-500 text-white px-6 py-2 rounded-full font-bold animate-bounce shadow-lg flex items-center gap-2">
                      <span>🎉</span> Perfect!
                      <button onClick={handleNextLevel} className="bg-white text-green-600 px-3 py-1 rounded-full text-xs ml-2 font-black uppercase hover:scale-105 transition-transform">Next Level</button>
                  </div>
              )}
              {!isFail && !isSuccess && (
                  <p className="text-indigo-300 text-sm md:text-base italic animate-pulse text-center">{level.hint}</p>
              )}
          </div>

      </div>

      {/* Control Panel (Bottom) */}
      <div className="bg-slate-900 border-t border-slate-800 p-4 z-30 shrink-0 safe-area-pb">
          <div className="max-w-3xl mx-auto flex flex-col gap-4">
              
              {/* Chip Inventory */}
              <div className="flex gap-3 overflow-x-auto w-full no-scrollbar pb-2">
                  {level.availableChips.map((chip) => {
                      const isUsed = placedChips.some(pc => pc?.id === chip.id);
                      const isSelected = selectedChip?.id === chip.id;
                      
                      return (
                        <button
                            key={chip.id}
                            onClick={() => handleChipSelect(chip)}
                            disabled={isUsed || isRunning}
                            className={`
                                shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg transition-all
                                ${isUsed 
                                    ? 'bg-slate-800 text-slate-600 opacity-50 scale-90 grayscale cursor-default' 
                                    : `${chip.color} text-white active:scale-95`}
                                ${isSelected ? 'ring-4 ring-white scale-110 z-10 -translate-y-2' : ''}
                            `}
                        >
                            {chip.op}{chip.val}
                        </button>
                      );
                  })}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 items-center">
                  <button 
                    onClick={() => {
                        initAudio();
                        playSound('click');
                        setPlacedChips(new Array(level.slots).fill(null));
                        setIsSuccess(false);
                        setIsFail(false);
                        setAnimStep(-1);
                    }}
                    disabled={isRunning}
                    className="w-14 h-14 rounded-2xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white font-bold flex items-center justify-center transition-colors"
                    title="Reset"
                  >
                      ↺
                  </button>

                  <div className="flex-1 flex gap-2">
                    <button 
                        onClick={runSimulation}
                        disabled={isRunning || isSuccess}
                        className={`
                            flex-1 h-14 rounded-2xl font-bold text-base uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2
                            ${isRunning 
                                ? 'bg-slate-700 text-slate-400 cursor-wait' 
                                : 'bg-green-600 text-white hover:bg-green-500 active:scale-95 active:bg-green-700'}
                        `}
                    >
                        {isRunning ? 'Processing...' : '▶ RUN'}
                    </button>
                  </div>
                  
                  <button
                    onClick={() => setTurboMode(!turboMode)}
                    className={`w-14 h-14 rounded-2xl border-2 font-bold text-xl flex items-center justify-center transition-all ${turboMode ? 'bg-yellow-500 border-yellow-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                  >
                      ⚡️
                  </button>
              </div>

          </div>
      </div>

      <style>{`
        @keyframes slideRight {
            from { background-position: 0 0; }
            to { background-position: 40px 0; }
        }
      `}</style>

    </div>
  );
};


import React, { useState, useEffect, useRef, useMemo } from 'react';

// --- Types & Constants ---
type Operator = '+' | '-';
type GameState = 'START' | 'PLAYING' | 'SHOP';

interface Problem {
  num1: number;
  num2: number;
  operator: Operator;
  answer: number;
  options: number[];
}

interface Sticker {
  id: string;
  emoji: string;
  name: string;
  cost: number;
}

const STICKERS: Sticker[] = [
  { id: 'dog', emoji: '🐶', name: 'Puppy', cost: 10 },
  { id: 'cat', emoji: '🐱', name: 'Kitten', cost: 10 },
  { id: 'mouse', emoji: '🐭', name: 'Mouse', cost: 15 },
  { id: 'hamster', emoji: '🐹', name: 'Hamster', cost: 15 },
  { id: 'fox', emoji: '🦊', name: 'Fox', cost: 20 },
  { id: 'bear', emoji: '🐻', name: 'Bear', cost: 20 },
  { id: 'panda', emoji: '🐼', name: 'Panda', cost: 25 },
  { id: 'koala', emoji: '🐨', name: 'Koala', cost: 25 },
  { id: 'tiger', emoji: '🐯', name: 'Tiger', cost: 30 },
  { id: 'lion', emoji: '🦁', name: 'Lion', cost: 30 },
  { id: 'cow', emoji: '🐮', name: 'Moo Moo', cost: 35 },
  { id: 'pig', emoji: '🐷', name: 'Piggy', cost: 35 },
  { id: 'frog', emoji: '🐸', name: 'Froggy', cost: 40 },
  { id: 'monkey', emoji: '🐵', name: 'Monkey', cost: 40 },
  { id: 'unicorn', emoji: '🦄', name: 'Unicorn', cost: 50 },
  { id: 'dragon', emoji: '🐲', name: 'Dragon', cost: 100 },
];

export const MathGame: React.FC = () => {
  const [stars, setStars] = useState(0);
  const [gameState, setGameState] = useState<GameState>('START');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [unlockedStickers, setUnlockedStickers] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');
  const [streak, setStreak] = useState(0);

  // Audio Refs
  const audioCtxRef = useRef<AudioContext | null>(null);

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

  const playSound = (type: 'correct' | 'wrong' | 'unlock' | 'click') => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain).connect(ctx.destination);

    if (type === 'correct') {
      // Happy arpeggio
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, t); // C5
      osc.frequency.setValueAtTime(659.25, t + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, t + 0.2); // G5
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
      osc.start(t);
      osc.stop(t + 0.4);
    } else if (type === 'wrong') {
      // Low buzz
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.linearRampToValueAtTime(100, t + 0.3);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.3);
    } else if (type === 'unlock') {
      // Magical chime
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.linearRampToValueAtTime(880, t + 0.5);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.linearRampToValueAtTime(0, t + 1.0);
      osc.start(t);
      osc.stop(t + 1.0);
    } else if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, t);
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.start(t);
      osc.stop(t + 0.1);
    }
  };

  // --- Game Logic ---
  const generateProblem = () => {
    const operator = Math.random() > 0.5 ? '+' : '-';
    let n1, n2, ans;

    if (operator === '+') {
      // Addition: Sum up to 20
      n1 = Math.floor(Math.random() * 11); // 0-10
      n2 = Math.floor(Math.random() * 10) + 1; // 1-10
      ans = n1 + n2;
    } else {
      // Subtraction: Result positive
      n1 = Math.floor(Math.random() * 19) + 1; // 1-20
      n2 = Math.floor(Math.random() * n1); // 0 to n1-1
      ans = n1 - n2;
    }

    // Generate Options
    const opts = new Set<number>();
    opts.add(ans);
    while (opts.size < 3) {
      const offset = Math.floor(Math.random() * 5) - 2; // -2 to +2
      const fake = ans + offset;
      if (fake >= 0 && fake !== ans) {
        opts.add(fake);
      } else {
          // Fallback for edge cases
          opts.add(ans + opts.size + 1); 
      }
    }

    setProblem({
      num1: n1,
      num2: n2,
      operator,
      answer: ans,
      options: Array.from(opts).sort(() => Math.random() - 0.5),
    });
    setFeedback('none');
  };

  const handleAnswer = (selected: number) => {
    if (!problem) return;
    initAudio();

    if (selected === problem.answer) {
      setFeedback('correct');
      playSound('correct');
      setStars((s) => s + 2 + (streak > 5 ? 1 : 0)); // Bonus star for streaks
      setStreak((s) => s + 1);
      setTimeout(generateProblem, 1000);
    } else {
      setFeedback('wrong');
      playSound('wrong');
      setStreak(0);
    }
  };

  const buySticker = (sticker: Sticker) => {
    if (unlockedStickers.includes(sticker.id)) return;
    if (stars >= sticker.cost) {
      setStars((s) => s - sticker.cost);
      setUnlockedStickers((prev) => [...prev, sticker.id]);
      playSound('unlock');
    } else {
      playSound('wrong');
    }
  };

  const startGame = () => {
    initAudio();
    setGameState('PLAYING');
    generateProblem();
  };

  // --- Rendering ---

  if (gameState === 'START') {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-yellow-50 p-6 text-center select-none">
        <div className="text-6xl mb-6 animate-bounce">🦁</div>
        <h1 className="text-4xl font-black text-yellow-600 mb-2 tracking-tight">MATH ZOO</h1>
        <p className="text-slate-500 mb-8 text-lg">Solve math problems, earn stars, and collect animals!</p>
        <button 
          onClick={startGame}
          className="bg-yellow-500 hover:bg-yellow-400 text-white text-2xl font-bold py-4 px-12 rounded-full shadow-[0_4px_0_rgb(202,138,4)] active:shadow-none active:translate-y-1 transition-all"
        >
          START PLAYING
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-yellow-50 relative select-none font-sans">
      
      {/* Top Bar */}
      <div className="bg-white p-4 shadow-sm flex justify-between items-center z-10">
        <button 
          onClick={() => setGameState(gameState === 'SHOP' ? 'PLAYING' : 'SHOP')}
          className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
        >
           {gameState === 'SHOP' ? '🔙 Back to Game' : '🛍️ Sticker Shop'}
        </button>

        <div className="flex items-center gap-2 bg-yellow-100 px-4 py-2 rounded-full border-2 border-yellow-200">
           <span className="text-2xl">⭐️</span>
           <span className="text-xl font-bold text-yellow-700">{stars}</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4">
        
        {/* --- GAME VIEW --- */}
        {gameState === 'PLAYING' && problem && (
          <div className="h-full flex flex-col items-center justify-center max-w-md mx-auto">
             
             {/* Streak Display */}
             {streak > 2 && (
                 <div className="text-orange-500 font-bold animate-pulse mb-4">
                    🔥 {streak} Streak!
                 </div>
             )}

             {/* Problem Card */}
             <div className={`bg-white w-full rounded-3xl shadow-xl p-8 mb-8 flex flex-col items-center border-b-8 border-slate-200 transition-transform ${feedback === 'wrong' ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
                <div className="flex items-center gap-4 text-6xl md:text-8xl font-black text-slate-700">
                   <div className="w-24 text-center">{problem.num1}</div>
                   <div className="text-yellow-500">{problem.operator}</div>
                   <div className="w-24 text-center">{problem.num2}</div>
                   <div className="text-slate-300">=</div>
                   <div className="w-24 text-center text-indigo-500">?</div>
                </div>
                
                {feedback === 'correct' && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-9xl animate-ping">⭐️</div>
                    </div>
                )}
             </div>

             {/* Options */}
             <div className="grid grid-cols-3 gap-4 w-full">
                {problem.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(opt)}
                    disabled={feedback === 'correct'}
                    className={`
                        py-6 rounded-2xl text-4xl font-bold text-slate-600 shadow-[0_4px_0_rgb(203,213,225)] transition-all
                        active:shadow-none active:translate-y-1 hover:brightness-105
                        ${feedback === 'correct' && opt === problem.answer ? 'bg-green-500 text-white shadow-[0_4px_0_rgb(22,163,74)]' : 'bg-white'}
                        ${feedback === 'wrong' && opt !== problem.answer ? 'opacity-50' : ''}
                    `}
                  >
                    {opt}
                  </button>
                ))}
             </div>

             {/* Collection Preview (Tiny Zoo) */}
             <div className="mt-12 flex gap-2 flex-wrap justify-center opacity-50 grayscale-[0.3]">
                {unlockedStickers.length === 0 && <span className="text-slate-400 text-sm italic">Visit the shop to buy pets!</span>}
                {unlockedStickers.slice(0, 8).map(id => {
                    const s = STICKERS.find(st => st.id === id);
                    return <span key={id} className="text-2xl" title={s?.name}>{s?.emoji}</span>
                })}
                {unlockedStickers.length > 8 && <span className="text-slate-400 text-xs self-center">+{unlockedStickers.length - 8} more</span>}
             </div>
          </div>
        )}

        {/* --- SHOP VIEW --- */}
        {gameState === 'SHOP' && (
            <div className="max-w-2xl mx-auto">
                <h2 className="text-2xl font-bold text-indigo-800 mb-6 text-center">Adopt a Pet</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {STICKERS.map((sticker) => {
                        const isUnlocked = unlockedStickers.includes(sticker.id);
                        const canAfford = stars >= sticker.cost;

                        return (
                            <div 
                                key={sticker.id}
                                onClick={() => buySticker(sticker)}
                                className={`
                                    relative bg-white p-4 rounded-xl border-b-4 transition-all cursor-pointer
                                    ${isUnlocked 
                                        ? 'border-green-200 bg-green-50' 
                                        : canAfford 
                                            ? 'border-indigo-200 hover:-translate-y-1' 
                                            : 'border-slate-200 opacity-60 cursor-not-allowed'}
                                `}
                            >
                                <div className="text-6xl text-center mb-2">
                                    {isUnlocked ? sticker.emoji : <span className="grayscale opacity-20">{sticker.emoji}</span>}
                                </div>
                                <div className="text-center font-bold text-slate-700 text-sm">{sticker.name}</div>
                                
                                {!isUnlocked && (
                                    <div className={`mt-2 text-center text-sm font-bold py-1 rounded-full ${canAfford ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-400'}`}>
                                        ⭐️ {sticker.cost}
                                    </div>
                                )}
                                
                                {isUnlocked && (
                                    <div className="absolute top-2 right-2 text-green-500">
                                        ✓
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        )}

      </div>
      
      <style>{`
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-8px); }
            75% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
};

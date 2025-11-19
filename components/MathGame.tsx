
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

const ENCOURAGEMENTS = [
  "Awesome!", 
  "Great Job!", 
  "Superb!", 
  "You're a Star!", 
  "Fantastic!", 
  "Correct!", 
  "Smart!", 
  "Keep it up!",
  "Amazing!",
  "Bingo!"
];

export const MathGame: React.FC = () => {
  const [stars, setStars] = useState(0);
  const [gameState, setGameState] = useState<GameState>('START');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [unlockedStickers, setUnlockedStickers] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');
  const [streak, setStreak] = useState(0);
  const [encouragement, setEncouragement] = useState("");

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
    while (opts.size < 4) { // Increased to 4 options for 2x2 grid
      const offset = Math.floor(Math.random() * 7) - 3; 
      const fake = ans + offset;
      if (fake >= 0 && fake !== ans) {
        opts.add(fake);
      } else {
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
    setEncouragement("");
  };

  const handleAnswer = (selected: number) => {
    if (!problem) return;
    initAudio();

    if (selected === problem.answer) {
      setFeedback('correct');
      setEncouragement(ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]);
      playSound('correct');
      setStars((s) => s + 2 + (streak > 5 ? 2 : 0)); // Bonus star for streaks
      setStreak((s) => s + 1);
      setTimeout(generateProblem, 1200); 
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
      <div className="flex flex-col items-center justify-center h-full bg-yellow-50 p-4 text-center select-none">
        <div className="text-7xl md:text-8xl mb-6 animate-bounce">🦁</div>
        <h1 className="text-4xl md:text-6xl font-black text-yellow-600 mb-3 tracking-tight">MATH ZOO</h1>
        <p className="text-slate-500 mb-8 text-base md:text-xl max-w-xs md:max-w-md mx-auto">
          Solve math problems, earn stars, and collect cute animals!
        </p>
        <button 
          onClick={startGame}
          className="bg-yellow-500 hover:bg-yellow-400 text-white text-xl md:text-3xl font-bold py-4 px-12 rounded-full shadow-[0_6px_0_rgb(202,138,4)] active:shadow-none active:translate-y-2 transition-all w-full max-w-xs"
        >
          START
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full transition-colors duration-500 relative select-none font-sans ${streak > 5 ? 'bg-orange-100' : 'bg-yellow-50'}`}>
      
      {/* Feedback Flash Overlay */}
      {feedback === 'correct' && <div className="absolute inset-0 bg-green-500/20 pointer-events-none z-50 animate-pulse" />}
      {feedback === 'wrong' && <div className="absolute inset-0 bg-red-500/20 pointer-events-none z-50 animate-[pulse_0.2s_ease-in-out]" />}

      {/* Top Bar */}
      <div className="bg-white/80 backdrop-blur p-3 shadow-sm flex justify-between items-center z-10 shrink-0 border-b border-yellow-100/50">
        <button 
          onClick={() => setGameState(gameState === 'SHOP' ? 'PLAYING' : 'SHOP')}
          className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold py-2 px-4 rounded-xl transition-colors flex items-center gap-2 text-sm md:text-base shadow-sm active:scale-95"
        >
           {gameState === 'SHOP' ? '🔙 Game' : '🛍️ Shop'}
        </button>

        <div className="flex items-center gap-2 bg-yellow-100 px-4 py-1.5 rounded-full border-2 border-yellow-200 shadow-inner">
           <span className="text-xl md:text-2xl drop-shadow-sm">⭐️</span>
           <span className="text-xl md:text-2xl font-black text-yellow-700">{stars}</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col max-w-4xl mx-auto w-full">
        
        {/* --- GAME VIEW --- */}
        {gameState === 'PLAYING' && problem && (
          <div className="flex-1 flex flex-col items-center justify-center w-full py-2">
             
             {/* Streak Display */}
             <div className="h-10 mb-2 flex items-center justify-center">
                {streak > 1 ? (
                    <div className={`font-black animate-bounce text-lg md:text-2xl flex items-center gap-2 px-4 py-1 rounded-full border-2 ${streak > 5 ? 'bg-red-100 text-red-600 border-red-200' : 'bg-orange-100 text-orange-500 border-orange-200'}`}>
                        🔥 {streak} Streak!
                        {streak > 5 && <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">x2 Stars</span>}
                    </div>
                ) : <div className="text-transparent select-none">.</div>}
             </div>

             {/* Problem Card */}
             <div className={`
                relative bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 md:p-12 mb-6 md:mb-10 flex flex-col items-center 
                border-b-[8px] border-slate-200 transition-transform 
                ${feedback === 'wrong' ? 'animate-[shake_0.4s_ease-in-out]' : ''}
             `}>
                <div className="flex items-center justify-center gap-2 md:gap-4 text-6xl sm:text-7xl md:text-8xl font-black text-slate-700 w-full tracking-tighter">
                   <div className="w-16 sm:w-24 text-center">{problem.num1}</div>
                   <div className="text-yellow-500">{problem.operator}</div>
                   <div className="w-16 sm:w-24 text-center">{problem.num2}</div>
                   <div className="text-slate-300">=</div>
                   <div className="w-16 sm:w-24 text-center text-indigo-500">?</div>
                </div>
                
                {/* Encouragement Overlay */}
                {feedback === 'correct' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 rounded-3xl z-10 animate-in fade-in duration-200 backdrop-blur-sm">
                        <div className="text-8xl md:text-9xl animate-[bounce_0.5s_infinite] mb-4">⭐️</div>
                        <div className="text-3xl md:text-5xl font-black text-yellow-500 tracking-wider animate-pulse uppercase drop-shadow-md text-center px-4">
                            {encouragement}
                        </div>
                    </div>
                )}
             </div>

             {/* Options (2x2 Grid for better Mobile tapping) */}
             <div className="grid grid-cols-2 gap-3 md:gap-6 w-full max-w-md mb-auto">
                {problem.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(opt)}
                    disabled={feedback === 'correct'}
                    className={`
                        h-24 md:h-32 rounded-2xl text-4xl md:text-6xl font-black text-slate-600 shadow-[0_6px_0_rgb(203,213,225)] transition-all
                        active:shadow-none active:translate-y-2 active:bg-slate-100 touch-manipulation border-2 border-slate-100
                        ${feedback === 'correct' && opt === problem.answer ? 'bg-green-500 text-white shadow-[0_6px_0_rgb(22,163,74)] border-green-600' : 'bg-white'}
                        ${feedback === 'wrong' && opt !== problem.answer ? 'opacity-30 scale-95 bg-slate-100' : 'hover:brightness-105'}
                    `}
                  >
                    {opt}
                  </button>
                ))}
             </div>

             {/* Collection Preview (Tiny Zoo) */}
             <div className="mt-4 flex gap-2 flex-wrap justify-center opacity-70 min-h-[40px]">
                {unlockedStickers.length === 0 && <span className="text-slate-400 text-sm italic bg-white/50 px-3 py-1 rounded-full">Earn stars to buy pets!</span>}
                {unlockedStickers.slice(0, 8).map(id => {
                    const s = STICKERS.find(st => st.id === id);
                    return <span key={id} className="text-2xl md:text-3xl animate-in zoom-in" title={s?.name}>{s?.emoji}</span>
                })}
             </div>
          </div>
        )}

        {/* --- SHOP VIEW --- */}
        {gameState === 'SHOP' && (
            <div className="w-full pb-8">
                <div className="text-center mb-6 bg-white/50 p-4 rounded-2xl">
                    <h2 className="text-2xl md:text-3xl font-black text-indigo-800">Pet Shop</h2>
                    <p className="text-slate-500 text-sm">Use your stars to adopt friends!</p>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
                    {STICKERS.map((sticker) => {
                        const isUnlocked = unlockedStickers.includes(sticker.id);
                        const canAfford = stars >= sticker.cost;

                        return (
                            <button 
                                key={sticker.id}
                                onClick={() => buySticker(sticker)}
                                disabled={isUnlocked || (!canAfford && !isUnlocked)}
                                className={`
                                    relative bg-white p-3 md:p-4 rounded-2xl border-b-4 transition-all flex flex-col items-center
                                    ${isUnlocked 
                                        ? 'border-green-200 bg-green-50 cursor-default' 
                                        : canAfford 
                                            ? 'border-indigo-200 hover:-translate-y-1 active:translate-y-0 active:shadow-none active:border-t-4 active:border-b-0' 
                                            : 'border-slate-200 opacity-50 cursor-not-allowed grayscale'}
                                `}
                            >
                                <div className="text-5xl md:text-7xl mb-2 transform transition-transform group-hover:scale-110">
                                    {isUnlocked ? sticker.emoji : sticker.emoji} 
                                </div>
                                <div className="font-bold text-slate-700 text-sm">{sticker.name}</div>
                                
                                {!isUnlocked && (
                                    <div className={`mt-2 text-center text-xs md:text-sm font-bold px-3 py-1 rounded-full ${canAfford ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-400'}`}>
                                        ⭐️ {sticker.cost}
                                    </div>
                                )}
                                
                                {isUnlocked && (
                                    <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shadow-sm">
                                        ✓
                                    </div>
                                )}
                            </button>
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

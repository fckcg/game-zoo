
import React, { useState, useEffect, useRef, useMemo } from 'react';

// --- Types ---
interface PyramidCell {
  row: number;
  col: number;
  val: number;
  userInput: number | null;
  isHidden: boolean;
  isError?: boolean;
}

interface Artifact {
  id: string;
  name: string;
  icon: string;
  desc: string;
  rarity: 'common' | 'rare' | 'legendary';
}

// --- Constants ---
const ARTIFACTS: Artifact[] = [
  { id: 'scarab', name: 'Golden Scarab', icon: '🪲', desc: 'A symbol of rebirth.', rarity: 'common' },
  { id: 'ankh', name: 'Ankh', icon: '☥', desc: 'The key of life.', rarity: 'common' },
  { id: 'eye', name: 'Eye of Horus', icon: '👁️', desc: 'Protection and royal power.', rarity: 'common' },
  { id: 'cat', name: 'Bastet Statue', icon: '🐈‍⬛', desc: 'Guardian of the home.', rarity: 'rare' },
  { id: 'mask', name: 'Pharaoh Mask', icon: '🤴', desc: 'Gold death mask of a king.', rarity: 'legendary' },
  { id: 'pyramid', name: 'Mini Pyramid', icon: '🏜️', desc: 'A tiny wonder of the world.', rarity: 'rare' },
  { id: 'scroll', name: 'Papyrus Scroll', icon: '📜', desc: 'Ancient wisdom written down.', rarity: 'common' },
  { id: 'vase', name: 'Canopic Jar', icon: '🏺', desc: 'Used in mummification.', rarity: 'rare' },
];

export const MysteryPyramid: React.FC = () => {
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(1);
  const [pyramid, setPyramid] = useState<PyramidCell[][]>([]);
  const [selectedCell, setSelectedCell] = useState<{r: number, c: number} | null>(null);
  const [inventory, setInventory] = useState<string[]>([]);
  const [showWin, setShowWin] = useState(false);
  const [lastArtifact, setLastArtifact] = useState<Artifact | null>(null);
  
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

  const playSound = (type: 'tap' | 'error' | 'win' | 'click') => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const t = ctx.currentTime;
    
    if (type === 'tap') {
        // Stone tap sound (filtered noise)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(200, t);
        osc.type = 'square';
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, t);

        osc.connect(filter).connect(gain).connect(ctx.destination);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.1);
    } else if (type === 'error') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.linearRampToValueAtTime(50, t + 0.3);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.3);
    } else if (type === 'win') {
        // Magical Chime
        [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((f, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, t + i*0.1);
            gain.gain.setValueAtTime(0.05, t + i*0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i*0.1 + 1);
            osc.connect(gain).connect(ctx.destination);
            osc.start(t + i*0.1);
            osc.stop(t + i*0.1 + 1);
        });
    } else if (type === 'click') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(800, t);
        gain.gain.setValueAtTime(0.02, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.05);
    }
  };

  // --- Game Logic ---
  const generateLevel = (diff: number) => {
    // Difficulty Settings
    const rows = diff === 3 ? 4 : 3;
    const maxBaseVal = diff === 1 ? 10 : diff === 2 ? 15 : 10;
    
    // 1. Generate Pyramid Logic (Bottom-Up)
    const structure: number[][] = [];
    // Create bottom row first
    const bottomRow = [];
    for (let i = 0; i < rows; i++) {
      bottomRow.push(Math.floor(Math.random() * maxBaseVal) + 1);
    }
    structure[rows - 1] = bottomRow;

    // Calculate upwards
    for (let r = rows - 2; r >= 0; r--) {
      const rowData = [];
      for (let c = 0; c <= r; c++) {
        // Parent = Left Child + Right Child
        const val = structure[r + 1][c] + structure[r + 1][c + 1];
        rowData.push(val);
      }
      structure[r] = rowData;
    }

    // 2. Determine Hiding Strategy
    // Diff 1: Hide Top, or Hide random simple
    // Diff 2: Hide random, ensuring solvability by subtraction (e.g. give Parent and Left, find Right)
    // Diff 3: Sparse
    const totalCells = (rows * (rows + 1)) / 2;
    const cellsToHide = diff === 1 ? Math.floor(totalCells * 0.4) : Math.floor(totalCells * 0.55);

    const newPyramid: PyramidCell[][] = structure.map((rowVals, r) => 
      rowVals.map((val, c) => ({
        row: r,
        col: c,
        val: val,
        userInput: null,
        isHidden: false, // will set below
        isError: false
      }))
    );

    // Randomly hide cells
    let hiddenCount = 0;
    while (hiddenCount < cellsToHide) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * (r + 1));
        if (!newPyramid[r][c].isHidden) {
            newPyramid[r][c].isHidden = true;
            hiddenCount++;
        }
    }

    setPyramid(newPyramid);
    setSelectedCell(null);
    setShowWin(false);
    setLastArtifact(null);
  };

  useEffect(() => {
    generateLevel(difficulty);
  }, [difficulty]);

  const handleCellClick = (r: number, c: number) => {
    initAudio();
    const cell = pyramid[r][c];
    if (!cell.isHidden) return; // Can't edit given numbers
    setSelectedCell({r, c});
    playSound('click');
  };

  const handleNumInput = (num: number) => {
    if (!selectedCell) return;
    initAudio();
    playSound('tap');

    setPyramid(prev => {
        const newP = [...prev];
        const row = [...newP[selectedCell.r]];
        const cell = { ...row[selectedCell.c] };
        
        // Append number logic (if < 3 digits)
        const currentInput = cell.userInput || 0;
        const newVal = parseInt(`${currentInput}${num}`.slice(0, 3)); // limit to 3 digits
        
        cell.userInput = newVal;
        cell.isError = false; // clear error on edit
        
        row[selectedCell.c] = cell;
        newP[selectedCell.r] = row;
        return newP;
    });
  };

  const handleBackspace = () => {
    if (!selectedCell) return;
    initAudio();
    playSound('click');

    setPyramid(prev => {
        const newP = [...prev];
        const row = [...newP[selectedCell.r]];
        const cell = { ...row[selectedCell.c] };
        
        const str = (cell.userInput || "").toString();
        const newVal = str.length > 1 ? parseInt(str.slice(0, -1)) : null;
        
        cell.userInput = newVal;
        cell.isError = false;

        row[selectedCell.c] = cell;
        newP[selectedCell.r] = row;
        return newP;
    });
  };

  const handleCheck = () => {
    initAudio();
    let allCorrect = true;
    let hasEmpty = false;

    const newPyramid = pyramid.map(row => row.map(cell => {
        if (!cell.isHidden) return cell;
        if (cell.userInput === null) {
            hasEmpty = true;
            return cell;
        }
        if (cell.userInput !== cell.val) {
            allCorrect = false;
            return { ...cell, isError: true };
        }
        return { ...cell, isError: false };
    }));

    setPyramid(newPyramid);

    if (hasEmpty) {
        // Maybe show a toast? For now just simple logic
        playSound('error');
        return;
    }

    if (allCorrect) {
        playSound('win');
        const reward = ARTIFACTS[Math.floor(Math.random() * ARTIFACTS.length)];
        if (!inventory.includes(reward.id)) {
            setInventory(prev => [...prev, reward.id]);
        }
        setLastArtifact(reward);
        setShowWin(true);
    } else {
        playSound('error');
    }
  };

  // --- Rendering Helpers ---

  // Calculate cell width based on row count to keep pyramid shape
  // Total width available approx 320px to 400px
  // Max 4 cells wide
  const cellBaseSize = difficulty === 3 ? 60 : 70;

  return (
    <div className="flex flex-col h-full bg-amber-50 font-sans relative overflow-hidden selection:bg-amber-200">
      
      {/* Background Decoration */}
      <div className="absolute inset-0 pointer-events-none opacity-5">
        <div className="absolute top-10 left-10 text-9xl">🏜️</div>
        <div className="absolute bottom-20 right-10 text-9xl">🐪</div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border-[50px] border-amber-900 rounded-full opacity-10"></div>
      </div>

      {/* Header: Difficulty & Inventory */}
      <div className="relative z-10 p-4 flex justify-between items-start">
         <div className="bg-white/80 backdrop-blur p-2 rounded-2xl shadow-sm border border-amber-100">
             <div className="flex gap-1 mb-2">
                {[1, 2, 3].map(d => (
                    <button 
                        key={d}
                        onClick={() => setDifficulty(d as 1|2|3)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${difficulty === d ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                    >
                        {d === 1 ? 'Easy' : d === 2 ? 'Med' : 'Hard'}
                    </button>
                ))}
             </div>
             <p className="text-xs text-amber-800 font-bold text-center">
                {difficulty === 1 ? 'Addition Only' : 'Logic & Subtract'}
             </p>
         </div>

         <div className="flex flex-col items-end">
             <div className="bg-amber-100 text-amber-800 px-4 py-2 rounded-full font-bold shadow-inner border border-amber-200 flex items-center gap-2 cursor-help group relative">
                <span>🏺</span> {inventory.length} / {ARTIFACTS.length}
                
                {/* Inventory Tooltip */}
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl p-2 hidden group-hover:grid grid-cols-4 gap-2 border border-amber-100 z-50">
                    {inventory.map(id => {
                        const item = ARTIFACTS.find(a => a.id === id);
                        return <div key={id} className="text-2xl text-center" title={item?.name}>{item?.icon}</div>
                    })}
                    {inventory.length === 0 && <div className="col-span-4 text-xs text-slate-400 text-center py-2">Solve puzzles to find artifacts!</div>}
                </div>
             </div>
         </div>
      </div>

      {/* Main Game Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 p-4 pb-0">
        
        <h2 className="text-2xl md:text-3xl font-black text-amber-800 mb-6 drop-shadow-sm flex items-center gap-2">
             Mystery Pyramid
        </h2>

        {/* Pyramid Container */}
        <div className="flex flex-col items-center gap-2 md:gap-4 mb-6 md:mb-10">
            {pyramid.map((row, rIndex) => (
                <div key={rIndex} className="flex gap-2 md:gap-4">
                    {row.map((cell, cIndex) => {
                        const isSelected = selectedCell?.r === rIndex && selectedCell?.c === cIndex;
                        return (
                            <button
                                key={`${rIndex}-${cIndex}`}
                                onClick={() => handleCellClick(rIndex, cIndex)}
                                disabled={!cell.isHidden}
                                className={`
                                    relative flex items-center justify-center
                                    transition-all duration-200
                                    ${isSelected ? 'translate-y-[-4px] scale-110 z-20 ring-4 ring-amber-400' : 'hover:scale-105'}
                                    ${cell.isHidden 
                                        ? (cell.userInput !== null 
                                            ? (cell.isError ? 'bg-red-100 border-red-400 text-red-600' : 'bg-white border-amber-300 text-slate-800') 
                                            : 'bg-amber-200/50 border-amber-300/50 border-dashed') 
                                        : 'bg-gradient-to-b from-stone-100 to-stone-300 border-stone-400 text-stone-600 shadow-md cursor-default'}
                                    border-2 md:border-4 rounded-xl md:rounded-2xl
                                    font-black text-xl md:text-3xl
                                `}
                                style={{
                                    width: `${cellBaseSize}px`,
                                    height: `${cellBaseSize}px`,
                                    minWidth: '50px', // Mobile constraint
                                    minHeight: '50px',
                                }}
                            >
                                {!cell.isHidden ? cell.val : cell.userInput}
                                {cell.isHidden && !cell.userInput && !isSelected && (
                                    <span className="text-amber-800/20 text-2xl">?</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>

        {/* Instruction / Hint */}
        <div className="bg-white/60 px-4 py-2 rounded-full text-amber-900 text-xs md:text-sm font-bold mb-4 shadow-sm backdrop-blur text-center max-w-xs">
             Rule: Top Block = Left Block + Right Block
        </div>

      </div>

      {/* Numpad (Bottom Sheet) */}
      <div className="bg-white border-t border-amber-100 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] p-4 z-20 shrink-0 safe-area-pb">
         <div className="max-w-md mx-auto">
            <div className="grid grid-cols-6 gap-2 mb-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(num => (
                    <button
                        key={num}
                        onClick={() => handleNumInput(num)}
                        className={`
                           col-span-1 aspect-square md:aspect-auto md:h-14 rounded-xl font-bold text-xl md:text-2xl transition-all
                           active:scale-90 active:bg-amber-200
                           bg-slate-50 hover:bg-slate-100 text-slate-700 border-b-4 border-slate-200
                           ${num === 0 ? 'col-start-5 col-end-7 aspect-auto' : ''}
                        `}
                    >
                        {num}
                    </button>
                ))}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
                <button 
                    onClick={handleBackspace}
                    className="bg-red-50 hover:bg-red-100 text-red-500 font-bold py-3 rounded-xl border-b-4 border-red-100 active:border-t-4 active:border-b-0 active:bg-red-100 transition-all uppercase tracking-wider text-sm md:text-base"
                >
                    ⌫ Delete
                </button>
                <button 
                    onClick={handleCheck}
                    className="bg-green-500 hover:bg-green-400 text-white font-bold py-3 rounded-xl shadow-[0_4px_0_rgb(21,128,61)] active:shadow-none active:translate-y-1 transition-all uppercase tracking-wider text-sm md:text-base"
                >
                    Verify ✓
                </button>
            </div>
         </div>
      </div>

      {/* Win Overlay */}
      {showWin && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl relative overflow-hidden">
                {/* Rays Effect */}
                <div className="absolute inset-0 bg-[conic-gradient(at_center,_var(--tw-gradient-stops))] from-amber-100 via-white to-amber-100 opacity-50 animate-spin-slow" style={{ animationDuration: '10s' }}></div>
                
                <div className="relative z-10">
                    <div className="text-6xl mb-4 animate-bounce">
                        {lastArtifact?.icon || '🎉'}
                    </div>
                    <h3 className="text-2xl font-black text-amber-600 mb-1">Level Cleared!</h3>
                    <p className="text-slate-500 mb-6 text-sm">
                        You found a <strong className={`${lastArtifact?.rarity === 'legendary' ? 'text-purple-600' : lastArtifact?.rarity === 'rare' ? 'text-blue-500' : 'text-slate-700'}`}>{lastArtifact?.name}</strong>!
                    </p>
                    
                    <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-500 italic mb-6 border border-slate-100">
                        "{lastArtifact?.desc}"
                    </div>

                    <button 
                        onClick={() => generateLevel(difficulty)}
                        className="w-full bg-amber-500 hover:bg-amber-400 text-white font-bold py-4 rounded-xl shadow-lg text-lg transition-transform hover:scale-105 active:scale-95"
                    >
                        Next Puzzle ➡️
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

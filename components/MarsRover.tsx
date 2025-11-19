
import React, { useState, useEffect, useRef, useMemo } from 'react';

// --- Types ---
type Direction = 'N' | 'E' | 'S' | 'W';
type CommandType = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type GameState = 'PLANNING' | 'RUNNING' | 'SUCCESS' | 'CRASH' | 'BOUNDS';

interface Level {
  id: number;
  name: string;
  gridSize: number;
  start: { x: number; y: number; dir: Direction };
  goal: { x: number; y: number };
  obstacles: { x: number; y: number }[];
  par: number; // optimal number of moves
}

interface MissionPatch {
  id: string;
  name: string;
  icon: string;
  desc: string;
}

// --- Constants ---
const LEVELS: Level[] = [
  {
    id: 1,
    name: "First Steps",
    gridSize: 5,
    start: { x: 0, y: 4, dir: 'E' }, // Bottom Left
    goal: { x: 4, y: 4 }, // Bottom Right
    obstacles: [],
    par: 4
  },
  {
    id: 2,
    name: "Around the Rock",
    gridSize: 5,
    start: { x: 0, y: 2, dir: 'E' },
    goal: { x: 4, y: 2 },
    obstacles: [{x: 2, y: 2}, {x: 2, y: 1}, {x: 2, y: 3}], // Wall in middle
    par: 6 
  },
  {
    id: 3,
    name: "Asteroid Field",
    gridSize: 5,
    start: { x: 0, y: 4, dir: 'E' },
    goal: { x: 4, y: 0 }, // Top Right
    obstacles: [{x: 2, y: 4}, {x: 2, y: 3}, {x: 1, y: 1}, {x: 3, y: 1}, {x: 0, y: 1}],
    par: 8 
  },
  {
    id: 4,
    name: "Zig Zag",
    gridSize: 6,
    start: { x: 0, y: 5, dir: 'N' },
    goal: { x: 5, y: 0 },
    obstacles: [
        {x: 0, y: 3}, {x: 1, y: 3}, 
        {x: 2, y: 3}, {x: 3, y: 3},
        {x: 5, y: 2}, {x: 4, y: 2},
        {x: 3, y: 2}, {x: 2, y: 2}
    ],
    par: 12
  },
  {
    id: 5,
    name: "The Maze",
    gridSize: 6,
    start: { x: 0, y: 0, dir: 'S' },
    goal: { x: 5, y: 5 },
    obstacles: [
        {x: 1, y: 0}, {x: 1, y: 1}, {x: 1, y: 2}, {x: 1, y: 4},
        {x: 3, y: 5}, {x: 3, y: 4}, {x: 3, y: 3}, {x: 3, y: 1},
        {x: 5, y: 1}, {x: 4, y: 1}, {x: 5, y: 3}
    ],
    par: 14
  }
];

const PATCHES: MissionPatch[] = [
    { id: 'novice', name: 'Rookie Pilot', icon: '🥉', desc: 'Completed Training' },
    { id: 'navigator', name: 'Pathfinder', icon: '🧭', desc: 'Solved 3 Puzzles' },
    { id: 'master', name: 'Mars Commander', icon: '🚀', desc: 'Solved all Puzzles' },
    { id: 'efficient', name: 'Logic Whiz', icon: '🧠', desc: 'Perfect Score on a Hard Level' }
];

export const MarsRover: React.FC = () => {
  const [levelIdx, setLevelIdx] = useState(0);
  const [rover, setRover] = useState({ x: 0, y: 0, dir: 'N' as Direction });
  const [program, setProgram] = useState<CommandType[]>([]);
  const [activeCmdIdx, setActiveCmdIdx] = useState<number | null>(null);
  const [gameState, setGameState] = useState<GameState>('PLANNING');
  const [patches, setPatches] = useState<string[]>([]);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number>(0);

  const level = LEVELS[levelIdx];

  // Initialize Level
  useEffect(() => {
    setRover(level.start);
    setProgram([]);
    setGameState('PLANNING');
    setActiveCmdIdx(null);
  }, [levelIdx]);

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

  const playSound = (type: 'click' | 'move' | 'win' | 'crash' | 'turn') => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain).connect(ctx.destination);

    if (type === 'click') {
        osc.frequency.setValueAtTime(600, t);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc.start(t);
        osc.stop(t + 0.05);
    } else if (type === 'move') {
        // Servo sound
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.linearRampToValueAtTime(200, t + 0.2);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.2);
        osc.start(t);
        osc.stop(t + 0.2);
    } else if (type === 'turn') {
        // Higher pitch servo for turning
        osc.type = 'square';
        osc.frequency.setValueAtTime(300, t);
        gain.gain.setValueAtTime(0.03, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.1);
    } else if (type === 'win') {
        // Victory Fanfare
        [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g).connect(ctx.destination);
            o.type = 'triangle';
            o.frequency.value = f;
            g.gain.setValueAtTime(0.1, t + i*0.1);
            g.gain.exponentialRampToValueAtTime(0.001, t + i*0.1 + 0.8);
            o.start(t + i*0.1);
            o.stop(t + i*0.1 + 0.8);
        });
    } else if (type === 'crash') {
        // Noise
        const bufferSize = ctx.sampleRate * 0.5;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for(let i=0; i<bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(500, t);
        f.frequency.linearRampToValueAtTime(100, t + 0.4);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        noise.connect(f).connect(gain).connect(ctx.destination);
        noise.start(t);
    }
  };

  // --- Ghost Path Simulation (For User Feedback) ---
  const ghostPath = useMemo(() => {
      if (gameState !== 'PLANNING') return [];
      
      const path: {x: number, y: number}[] = [];
      let currX = level.start.x;
      let currY = level.start.y;

      for (const cmd of program) {
          let dx = 0;
          let dy = 0;
          if (cmd === 'UP') dy = -1;
          if (cmd === 'DOWN') dy = 1;
          if (cmd === 'LEFT') dx = -1;
          if (cmd === 'RIGHT') dx = 1;

          const nextX = currX + dx;
          const nextY = currY + dy;

          // Only draw if in bounds and not obstacle
          // Note: This is a simple preview. It helps kids visually debug.
          if (nextX >= 0 && nextX < level.gridSize && nextY >= 0 && nextY < level.gridSize) {
              const hit = level.obstacles.some(o => o.x === nextX && o.y === nextY);
              if (!hit) {
                  path.push({x: nextX, y: nextY});
                  currX = nextX;
                  currY = nextY;
              } else {
                  break; // Stop drawing ghost at wall
              }
          } else {
              break; // Stop drawing ghost at bound
          }
      }
      return path;
  }, [program, level, gameState]);


  // --- Logic ---
  const executeStep = async (currentRover: typeof rover, cmdIndex: number) => {
      if (cmdIndex >= program.length) {
          // Finished program. Check if at goal.
          if (currentRover.x === level.goal.x && currentRover.y === level.goal.y) {
              setGameState('SUCCESS');
              playSound('win');
              
              // Awards
              const newPatches = [...patches];
              if (!patches.includes('novice')) newPatches.push('novice');
              if (levelIdx >= 2 && !patches.includes('navigator')) newPatches.push('navigator');
              if (levelIdx === LEVELS.length - 1 && !patches.includes('master')) newPatches.push('master');
              if (program.length <= level.par && levelIdx >= 3 && !patches.includes('efficient')) newPatches.push('efficient');
              setPatches(newPatches);

          } else {
              setGameState('PLANNING'); // Just stopped somewhere valid but not goal
          }
          setActiveCmdIdx(null);
          return;
      }

      setActiveCmdIdx(cmdIndex);
      const cmd = program[cmdIndex];
      let nextRover = { ...currentRover };
      let crashed = false;
      let bounds = false;
      let moveSuccess = true;

      // Determine intended direction and movement
      let targetDir: Direction = currentRover.dir;
      let dx = 0;
      let dy = 0;

      if (cmd === 'UP') { targetDir = 'N'; dy = -1; }
      if (cmd === 'DOWN') { targetDir = 'S'; dy = 1; }
      if (cmd === 'LEFT') { targetDir = 'W'; dx = -1; }
      if (cmd === 'RIGHT') { targetDir = 'E'; dx = 1; }

      // Update direction immediately (even if blocked)
      if (nextRover.dir !== targetDir) {
         nextRover.dir = targetDir;
         playSound('turn');
      }

      // Calculate next position
      const nextX = nextRover.x + dx;
      const nextY = nextRover.y + dy;

      // Check Bounds
      if (nextX < 0 || nextX >= level.gridSize || nextY < 0 || nextY >= level.gridSize) {
          bounds = true;
          moveSuccess = false;
      } else {
          // Check Obstacles
          const hit = level.obstacles.some(o => o.x === nextX && o.y === nextY);
          if (hit) {
              crashed = true;
              moveSuccess = false;
          } else {
              nextRover.x = nextX;
              nextRover.y = nextY;
          }
      }

      setRover(nextRover);

      if (crashed) {
          setGameState('CRASH');
          playSound('crash');
          setActiveCmdIdx(null);
      } else if (bounds) {
          setGameState('BOUNDS');
          playSound('crash');
          setActiveCmdIdx(null);
      } else {
          if (moveSuccess) playSound('move');
          timerRef.current = window.setTimeout(() => {
              executeStep(nextRover, cmdIndex + 1);
          }, 600); // Delay between steps
      }
  };

  const runProgram = () => {
      if (program.length === 0) return;
      initAudio();
      setGameState('RUNNING');
      // Reset rover to start before running
      const startRover = level.start;
      setRover(startRover);
      // Small delay before first move
      setTimeout(() => {
          executeStep(startRover, 0);
      }, 500);
  };

  const stopProgram = () => {
      clearTimeout(timerRef.current);
      setGameState('PLANNING');
      setRover(level.start);
      setActiveCmdIdx(null);
  };

  const addCommand = (cmd: CommandType) => {
      if (gameState !== 'PLANNING') return;
      initAudio();
      playSound('click');
      if (program.length < 20) {
          setProgram(p => [...p, cmd]);
      }
  };

  const removeCommand = () => {
      if (gameState !== 'PLANNING') return;
      initAudio();
      playSound('click');
      setProgram(p => p.slice(0, -1));
  };

  // --- Rendering ---
  const cellSize = 100 / level.gridSize; // Percentage

  const getRotation = (d: Direction) => {
      switch(d) {
          case 'N': return 0;
          case 'E': return 90;
          case 'S': return 180;
          case 'W': return 270;
      }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 font-sans relative selection:bg-blue-500/30">
      
      {/* Header: Status & Level */}
      <div className="flex justify-between items-center p-3 border-b border-slate-800 bg-slate-900 z-20">
          <div>
              <h2 className="text-sm md:text-lg font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                <span className="text-xl">🤖</span> Logic Rover
              </h2>
              <div className="text-[10px] md:text-xs text-slate-500">Lvl {levelIdx + 1}: {level.name}</div>
          </div>
          
          <div className="flex gap-2">
             {patches.map(pid => {
                 const p = PATCHES.find(px => px.id === pid);
                 return <span key={pid} title={p?.name} className="text-xl cursor-help hover:scale-125 transition-transform">{p?.icon}</span>
             })}
          </div>
      </div>

      {/* Main Viewport (Grid) */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LCAyNTUs 255LCAwLjEpIi8+PC9zdmc+')]">
         
         {/* The Mars Grid */}
         <div 
            className="relative aspect-square shadow-2xl border-4 border-slate-800 bg-red-900/20 rounded-xl overflow-hidden transition-all duration-500"
            style={{ width: 'min(95vw, 55vh)' }} // Increased size for mobile
         >
            {/* Grid Lines */}
            <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${level.gridSize}, 1fr)`, gridTemplateRows: `repeat(${level.gridSize}, 1fr)` }}>
                {Array.from({ length: level.gridSize * level.gridSize }).map((_, i) => (
                    <div key={i} className="border border-red-500/10"></div>
                ))}
            </div>

            {/* Goal */}
            <div 
                className="absolute transition-all duration-300 flex items-center justify-center"
                style={{ 
                    left: `${level.goal.x * cellSize}%`, 
                    top: `${level.goal.y * cellSize}%`, 
                    width: `${cellSize}%`, 
                    height: `${cellSize}%` 
                }}
            >
                <div className="w-3/4 h-3/4 bg-green-500/20 rounded-full animate-pulse flex items-center justify-center border-2 border-green-500/50">
                    <span className="text-2xl md:text-3xl drop-shadow-lg">🚩</span>
                </div>
            </div>

            {/* Obstacles */}
            {level.obstacles.map((obs, i) => (
                <div 
                    key={i}
                    className="absolute flex items-center justify-center"
                    style={{ 
                        left: `${obs.x * cellSize}%`, 
                        top: `${obs.y * cellSize}%`, 
                        width: `${cellSize}%`, 
                        height: `${cellSize}%` 
                    }}
                >
                    <span className="text-3xl md:text-4xl drop-shadow-xl grayscale contrast-125">🪨</span>
                </div>
            ))}

             {/* Ghost Path (Dots) */}
             {ghostPath.map((pos, i) => (
                 <div
                    key={`ghost-${i}`}
                    className="absolute flex items-center justify-center pointer-events-none z-0"
                    style={{
                        left: `${pos.x * cellSize}%`,
                        top: `${pos.y * cellSize}%`,
                        width: `${cellSize}%`,
                        height: `${cellSize}%`
                    }}
                 >
                     <div className="w-2 h-2 bg-blue-400/50 rounded-full"></div>
                 </div>
             ))}

            {/* The Rover */}
            <div 
                className="absolute transition-all duration-500 ease-in-out flex items-center justify-center z-10"
                style={{ 
                    left: `${rover.x * cellSize}%`, 
                    top: `${rover.y * cellSize}%`, 
                    width: `${cellSize}%`, 
                    height: `${cellSize}%`,
                    transform: `rotate(${getRotation(rover.dir)}deg)`
                }}
            >
                 <div className="w-3/4 h-3/4 bg-white rounded-lg shadow-lg relative flex flex-col items-center justify-center border-2 border-slate-300">
                    {/* Solar Panels */}
                    <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-4 bg-blue-900 rounded-l"></div>
                    <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-4 bg-blue-900 rounded-r"></div>
                    {/* Body */}
                    <div className="w-full h-full bg-slate-100 rounded relative overflow-hidden">
                        {/* Front Window */}
                        <div className="w-full h-1/3 bg-blue-400 border-b border-blue-500"></div>
                        {/* Wheels */}
                        <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-slate-800 rounded-tr"></div>
                        <div className="absolute bottom-0 right-0 w-1/3 h-1/3 bg-slate-800 rounded-tl"></div>
                    </div>
                 </div>
            </div>

            {/* Overlay Messages */}
            {gameState === 'CRASH' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20 animate-in zoom-in duration-200">
                    <div className="text-center">
                        <div className="text-5xl mb-2">💥</div>
                        <h3 className="text-red-500 font-black text-2xl uppercase">Crash!</h3>
                        <button onClick={stopProgram} className="mt-4 px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-full font-bold text-sm">Retry</button>
                    </div>
                </div>
            )}
            {gameState === 'BOUNDS' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20 animate-in zoom-in duration-200">
                    <div className="text-center">
                        <div className="text-5xl mb-2">📡</div>
                        <h3 className="text-orange-500 font-black text-2xl uppercase">Signal Lost</h3>
                        <p className="text-xs text-slate-400">Rover left the mission area.</p>
                        <button onClick={stopProgram} className="mt-4 px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-full font-bold text-sm">Retry</button>
                    </div>
                </div>
            )}
            {gameState === 'SUCCESS' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20 animate-in zoom-in duration-200">
                    <div className="text-center">
                        <div className="text-6xl mb-2 animate-bounce">🎉</div>
                        <h3 className="text-green-500 font-black text-2xl uppercase">Mission Complete!</h3>
                        <button 
                            onClick={() => setLevelIdx(prev => Math.min(prev + 1, LEVELS.length - 1))} 
                            className="mt-6 px-8 py-3 bg-green-600 hover:bg-green-500 rounded-full font-bold text-lg shadow-lg shadow-green-500/30"
                        >
                            Next Mission ➡️
                        </button>
                    </div>
                </div>
            )}

         </div>
      </div>

      {/* Controls Area */}
      <div className="bg-slate-900 border-t border-slate-800 p-4 pb-8 z-30 flex flex-col gap-4 shrink-0">
         
         {/* Program Sequence Display */}
         <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex items-center gap-1 overflow-x-auto h-14 no-scrollbar shadow-inner">
             {program.length === 0 && <span className="text-slate-600 text-xs italic pl-2">Path Preview: Tap arrows...</span>}
             {program.map((cmd, i) => (
                 <div 
                    key={i} 
                    className={`
                        shrink-0 w-8 h-8 rounded flex items-center justify-center text-sm border transition-all
                        ${activeCmdIdx === i ? 'bg-yellow-500 border-yellow-300 scale-110 z-10 text-slate-900 shadow-[0_0_10px_rgba(234,179,8,0.5)]' : 'bg-slate-800 border-slate-700 text-slate-300'}
                    `}
                 >
                    {cmd === 'UP' && '⬆'}
                    {cmd === 'DOWN' && '⬇'}
                    {cmd === 'LEFT' && '⬅'}
                    {cmd === 'RIGHT' && '➡'}
                 </div>
             ))}
         </div>

         {/* Control Palette */}
         <div className="flex justify-between items-end gap-2 max-w-md mx-auto w-full">
             
             {/* D-Pad / Arrow Buttons */}
             <div className="grid grid-cols-3 gap-1">
                 {/* Top Row */}
                 <div className="col-start-2">
                    <button 
                        onClick={() => addCommand('UP')} 
                        disabled={gameState !== 'PLANNING'}
                        className="w-14 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 active:scale-95 border-b-4 border-slate-950 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center"
                    >
                        <span className="text-2xl">⬆️</span>
                    </button>
                 </div>
                 
                 {/* Middle Row */}
                 <div className="col-start-1 row-start-2">
                    <button 
                        onClick={() => addCommand('LEFT')} 
                        disabled={gameState !== 'PLANNING'}
                        className="w-14 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 active:scale-95 border-b-4 border-slate-950 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center"
                    >
                        <span className="text-2xl">⬅️</span>
                    </button>
                 </div>
                 
                 <div className="col-start-2 row-start-2">
                    <button 
                        onClick={() => addCommand('DOWN')} 
                        disabled={gameState !== 'PLANNING'}
                        className="w-14 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 active:scale-95 border-b-4 border-slate-950 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center"
                    >
                        <span className="text-2xl">⬇️</span>
                    </button>
                 </div>

                 <div className="col-start-3 row-start-2">
                    <button 
                        onClick={() => addCommand('RIGHT')} 
                        disabled={gameState !== 'PLANNING'}
                        className="w-14 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 active:scale-95 border-b-4 border-slate-950 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center"
                    >
                        <span className="text-2xl">➡️</span>
                    </button>
                 </div>
             </div>

             <div className="flex-1 flex flex-col gap-2 justify-end h-full pb-1">
                 {gameState === 'PLANNING' ? (
                    <>
                        <button 
                            onClick={runProgram} 
                            disabled={program.length === 0}
                            className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-black text-white text-sm uppercase tracking-wider shadow-lg active:scale-95 transition-all"
                        >
                            ▶ GO
                        </button>
                        <div className="flex gap-2">
                            <button onClick={removeCommand} className="flex-1 py-2 bg-slate-800 rounded-lg text-red-400 text-xs font-bold border border-slate-700 active:bg-slate-700">⌫</button>
                            <button onClick={() => setProgram([])} className="flex-1 py-2 bg-slate-800 rounded-lg text-slate-400 text-xs font-bold border border-slate-700 active:bg-slate-700">CLR</button>
                        </div>
                    </>
                 ) : (
                    <button 
                        onClick={stopProgram} 
                        className="w-full py-4 bg-red-600 hover:bg-red-500 rounded-xl font-bold text-white text-sm uppercase tracking-wider shadow-lg active:scale-95 transition-all"
                    >
                        ■ STOP
                    </button>
                 )}
             </div>
         </div>

      </div>
    </div>
  );
};

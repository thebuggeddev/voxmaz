import { useEffect, useState, useRef } from 'react';
import { useGameStore, useMazeStore, mutableGameState } from '../store';
import { CellType } from '../MazeGenerator';
import { MobileControls } from './MobileControls';

const MiniMap = () => {
  const { grid, width, depth, cellSize } = useMazeStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerDotRef = useRef<HTMLDivElement>(null);

  // Render static maze background onto canvas once per maze generation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cellW = canvas.width / width;
    const cellH = canvas.height / depth;

    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        if (grid[z][x] === CellType.WALL) {
          ctx.fillStyle = '#94a3b8'; // slate-400
          ctx.fillRect(x * cellW, z * cellH, cellW + 0.5, cellH + 0.5);
        } else if (grid[z][x] === CellType.EXIT) {
          ctx.fillStyle = '#22c55e'; // green-500
          ctx.fillRect(x * cellW, z * cellH, cellW, cellH);
        }
      }
    }
  }, [grid, width, depth]);

  // Sync player location without React renders via rAF
  useEffect(() => {
    let frameId: number;
    const updateDot = () => {
      if (playerDotRef.current) {
        const px = (mutableGameState.playerX / (width * cellSize)) + 0.5;
        const pz = (mutableGameState.playerZ / (depth * cellSize)) + 0.5;
        
        playerDotRef.current.style.left = `${px * 100}%`;
        playerDotRef.current.style.top = `${pz * 100}%`;
      }
      frameId = requestAnimationFrame(updateDot);
    };
    frameId = requestAnimationFrame(updateDot);
    return () => cancelAnimationFrame(frameId);
  }, [width, depth, cellSize]);

  return (
    <div className="w-52 h-52 bg-white/90 backdrop-blur-md border-[3px] border-slate-300 rounded-xl overflow-hidden shadow-xl pointer-events-auto shrink-0 ml-4 hidden md:block">
      <div className="relative w-full h-full p-2 box-border">
        <canvas 
          ref={canvasRef} 
          width={200} 
          height={200} 
          className="w-full h-full opacity-80 rounded shadow-inner"
        />
        <div 
          ref={playerDotRef} 
          className="absolute w-[10px] h-[10px] bg-red-500 border-2 border-white rounded-full shadow-[0_0_8px_rgba(239,68,68,1)] transform -translate-x-1/2 -translate-y-1/2 z-10" 
        />
      </div>
    </div>
  );
};

export function GameUI() {
  const { gameState, startTime, endTime, reset } = useGameStore();
  const { generateNewMaze } = useMazeStore();
  
  const [timePassed, setTimePassed] = useState(0);

  useEffect(() => {
    let interval: number;
    if (gameState === 'PLAYING') {
      interval = window.setInterval(() => {
        setTimePassed(Date.now() - (startTime || Date.now()));
      }, 100);
    } else if (gameState === 'WON' || gameState === 'PAUSED') {
      setTimePassed((endTime || Date.now()) - (startTime || Date.now()));
    } else if (gameState === 'START') {
      setTimePassed(0);
    }
    return () => clearInterval(interval);
  }, [gameState, startTime, endTime]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleRestart = () => {
    generateNewMaze();
    reset();
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 z-10 transition-colors duration-500">
      <div className="flex justify-between w-full items-start">
        <h1 className="text-slate-800 font-extrabold text-2xl md:text-3xl tracking-[0.4em] drop-shadow-sm self-start mt-2">
          VOXMAZ
        </h1>
        <div className="flex items-start">
          {gameState !== 'START' && (
            <div className="text-slate-800 font-mono text-xl md:text-2xl font-bold drop-shadow-sm mt-2">
              {formatTime(timePassed)}
            </div>
          )}
          <MiniMap />
        </div>
      </div>

      <div className="flex items-center justify-center flex-grow">
        <div
          className="flex flex-col items-center"
          style={{ display: (gameState === 'START' || gameState === 'PAUSED') ? 'flex' : 'none' }}
        >
          <button
            id="start-button"
            onClick={() => {
              const canvas = document.querySelector('canvas');
              if (canvas) canvas.requestPointerLock();
            }}
            className="pointer-events-auto outline-none relative px-12 py-5 bg-black/60 backdrop-blur-md border border-white/20 text-white rounded-lg transition-all hover:bg-black/80 hover:border-white/40 hover:scale-[1.02] active:scale-[0.98] shadow-2xl group"
          >
            <span className="relative font-mono text-xl md:text-2xl font-bold tracking-[0.3em] uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              {gameState === 'START' ? 'Play' : 'Resume'}
            </span>
          </button>
          
          <div className="mt-8 flex items-center gap-4 text-slate-800 font-mono text-xs md:text-sm font-bold tracking-[0.2em] uppercase bg-white/70 px-6 py-3 rounded-full backdrop-blur-sm border border-slate-300 shadow-sm">
            <span>[ W A S D ] Move</span>
            <span className="opacity-50 border-r border-slate-500 h-4"></span>
            <span>[ Mouse ] Look</span>
          </div>
        </div>

        {gameState === 'WON' && (
          <div className="pointer-events-auto absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col w-[340px] bg-[#fafafa] rounded-xl shadow-2xl overflow-hidden border border-slate-300">
            {/* Ticket Header */}
            <div className="bg-slate-900 px-6 py-8 text-center border-b-[3px] border-dashed border-slate-400 relative">
               <h2 className="text-[#38bdf8] text-xs tracking-[0.4em] font-bold uppercase mb-2">Sector Cleared</h2>
               <div className="text-white text-4xl font-black tracking-widest font-mono drop-shadow-md">VOXMAZ</div>
               
               {/* Left/Right cutouts for the rip effect */}
               <div className="absolute -bottom-3 -left-3 w-6 h-6 bg-transparent rounded-full shadow-[inset_-3px_3px_5px_-3px_rgba(0,0,0,0.2)] border-r border-t border-slate-300" />
               <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-transparent rounded-full shadow-[inset_3px_3px_5px_-3px_rgba(0,0,0,0.2)] border-l border-t border-slate-300" />
            </div>

            {/* Ticket Body */}
            <div className="p-8 flex flex-col items-center bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:12px_12px] bg-[#f8fafc]">
              <div className="text-slate-500 font-mono text-[10px] uppercase tracking-widest mb-2 font-bold">Elapsed Time</div>
              <p className="text-slate-900 text-5xl mb-8 font-mono font-black tracking-tighter drop-shadow-sm">{formatTime(timePassed)}</p>
              
              <button
                onClick={handleRestart}
                className="w-full bg-[#f43f5e] hover:bg-[#e11d48] text-white px-6 py-4 rounded-lg text-sm font-bold uppercase tracking-[0.2em] transition-all active:scale-95 shadow-md flex items-center justify-center gap-3 border border-rose-600"
              >
                Next Maze <span className="text-xl leading-none">→</span>
              </button>
            </div>
            
            {/* Barcode bottom */}
            <div className="h-6 w-full px-8 flex items-end justify-between gap-[2px] opacity-30 mb-6 mt-2">
               {[...Array(35)].map((_, i) => (
                 <div key={i} className="bg-slate-900 h-full rounded-sm" style={{ width: `${Math.max(1, Math.random() * 5)}px` }} />
               ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Simple crosshair */}
      {gameState === 'PLAYING' && (
        <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-slate-900/50 rounded-full transform -translate-x-1/2 -translate-y-1/2" />
      )}
      <MobileControls />
    </div>
  );
}

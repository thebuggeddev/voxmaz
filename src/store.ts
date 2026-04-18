import { create } from 'zustand';
import { generateMaze } from './MazeGenerator';

export const mutableGameState = {
  playerX: 0,
  playerZ: 0,
  joystick: { x: 0, y: 0 },
  lookDelta: { x: 0, y: 0 }
};

export type GameState = 'START' | 'PLAYING' | 'PAUSED' | 'WON';

interface GameStore {
  gameState: GameState;
  startTime: number | null;
  endTime: number | null;
  setGameState: (state: GameState) => void;
  reset: () => void;
  win: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: 'START',
  startTime: null,
  endTime: null,
  setGameState: (state) => {
    if (state === 'PLAYING' && get().gameState === 'START') {
      set({ gameState: state, startTime: Date.now(), endTime: null });
    } else {
      set({ gameState: state });
    }
  },
  reset: () => set({ gameState: 'START', startTime: null, endTime: null }),
  win: () => {
    if (get().gameState === 'PLAYING') {
      set({ gameState: 'WON', endTime: Date.now() });
    }
  }
}));

interface MazeStore {
  grid: number[][];
  width: number;
  depth: number;
  cellSize: number;
  seed: number;
  generateNewMaze: () => void;
}

export const useMazeStore = create<MazeStore>((set) => ({
  grid: generateMaze(25, 25),
  width: 25,
  depth: 25,
  cellSize: 2,
  seed: 0,
  generateNewMaze: () => {
    set((state) => ({ grid: generateMaze(state.width, state.depth), seed: state.seed + 1 }));
  }
}));

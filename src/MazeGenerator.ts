export enum CellType {
  PATH = 0,
  WALL = 1,
  EXIT = 2,
  START = 3,
}

export function generateMaze(width: number, depth: number): number[][] {
  const grid: number[][] = Array(depth).fill(0).map(() => Array(width).fill(CellType.WALL));

  function carve(y: number, x: number) {
    grid[y][x] = CellType.PATH;

    const dirs = [
      [0, -2], [0, 2], [2, 0], [-2, 0]
    ].sort(() => Math.random() - 0.5);

    for (const [dy, dx] of dirs) {
      const ny = y + dy;
      const nx = x + dx;

      if (ny > 0 && ny < depth - 1 && nx > 0 && nx < width - 1 && grid[ny][nx] === CellType.WALL) {
        grid[y + dy / 2][x + dx / 2] = CellType.PATH;
        carve(ny, nx);
      }
    }
  }

  carve(1, 1);
  
  grid[1][1] = CellType.START;

  let exitSet = false;
  // Try to place the exit on the bottom boundary edge
  for (let x = width - 2; x > 0; x--) {
    if (grid[depth - 2][x] === CellType.PATH) {
      grid[depth - 1][x] = CellType.EXIT;
      exitSet = true;
      break;
    }
  }

  // Fallback to the right boundary edge
  if (!exitSet) {
    for (let y = depth - 2; y > 0; y--) {
      if (grid[y][width - 2] === CellType.PATH) {
        grid[y][width - 1] = CellType.EXIT;
        exitSet = true;
        break;
      }
    }
  }

  return grid;
}

export function getWorldPos(x: number, z: number, width: number, depth: number, cellSize: number): [number, number, number] {
  return [
    (x - Math.floor(width / 2)) * cellSize,
    0,
    (z - Math.floor(depth / 2)) * cellSize
  ];
}

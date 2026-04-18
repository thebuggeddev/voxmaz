import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useGameStore, useMazeStore, mutableGameState } from '../store';
import { CellType, getWorldPos } from '../MazeGenerator';

const keys = { w: false, a: false, s: false, d: false };

const onKeyDown = (e: KeyboardEvent) => {
  switch (e.code) {
    case 'KeyW': case 'ArrowUp': keys.w = true; break;
    case 'KeyA': case 'ArrowLeft': keys.a = true; break;
    case 'KeyS': case 'ArrowDown': keys.s = true; break;
    case 'KeyD': case 'ArrowRight': keys.d = true; break;
  }
};

const onKeyUp = (e: KeyboardEvent) => {
  switch (e.code) {
    case 'KeyW': case 'ArrowUp': keys.w = false; break;
    case 'KeyA': case 'ArrowLeft': keys.a = false; break;
    case 'KeyS': case 'ArrowDown': keys.s = false; break;
    case 'KeyD': case 'ArrowRight': keys.d = false; break;
  }
};

export function Player() {
  const { camera } = useThree();
  const { grid, width, depth, cellSize } = useMazeStore();
  const { gameState, win, setGameState } = useGameStore();
  const pointerLockRef = useRef<any>(null);
  
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  const playerRadius = 0.35; // Reduced from 0.65 to fit through corners more smoothly
  const bobTimer = useRef(0);
  
  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    }
  }, []);

  useEffect(() => {
    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        if (grid[z][x] === CellType.START) {
          const [wx, wy, wz] = getWorldPos(x, z, width, depth, cellSize);
          camera.position.set(wx, cellSize * 0.75, wz);
          camera.rotation.set(0, 0, 0); // Reset rotation
          return;
        }
      }
    }
  }, [grid, width, depth, cellSize, camera]);
  
  // Listen to PointerLock changes to pause/resume game
  useEffect(() => {
    const handleLock = () => {
      const state = useGameStore.getState().gameState;
      if (state === 'START' || state === 'PAUSED') {
        setGameState('PLAYING');
      }
    };
    const handleUnlock = () => {
      const state = useGameStore.getState().gameState;
      if (state === 'PLAYING') {
        setGameState('PAUSED');
      }
    };
    
    const onPointerLockChange = () => {
      if (document.pointerLockElement) {
        handleLock();
      } else {
        handleUnlock();
      }
    };

    document.addEventListener('pointerlockchange', onPointerLockChange);
    return () => document.removeEventListener('pointerlockchange', onPointerLockChange);
  }, [setGameState]);

  const checkCollision = (nx: number, nz: number) => {
    // Circle vs AABB collision logic for buttery smooth corner sliding
    const pxGrid = Math.floor(nx / cellSize + width / 2);
    const pzGrid = Math.floor(nz / cellSize + depth / 2);

    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const gridX = pxGrid + dx;
        const gridZ = pzGrid + dz;

        if (gridZ >= 0 && gridZ < depth && gridX >= 0 && gridX < width) {
          const cell = grid[gridZ][gridX];
          if (cell === CellType.WALL) {
            const cellWx = (gridX - Math.floor(width / 2)) * cellSize;
            const cellWz = (gridZ - Math.floor(depth / 2)) * cellSize;
            const minX = cellWx - cellSize / 2;
            const maxX = cellWx + cellSize / 2;
            const minZ = cellWz - cellSize / 2;
            const maxZ = cellWz + cellSize / 2;

            const closestX = Math.max(minX, Math.min(nx, maxX));
            const closestZ = Math.max(minZ, Math.min(nz, maxZ));

            const distSq = (nx - closestX) ** 2 + (nz - closestZ) ** 2;
            if (distSq < playerRadius ** 2) return true;
          } else if (cell === CellType.EXIT) {
            const cellWx = (gridX - Math.floor(width / 2)) * cellSize;
            const cellWz = (gridZ - Math.floor(depth / 2)) * cellSize;
            if (Math.abs(nx - cellWx) < cellSize * 0.8 && Math.abs(nz - cellWz) < cellSize * 0.8) {
              win();
              if (document.pointerLockElement) document.exitPointerLock();
            }
          }
        } else {
          // Out of bounds acts like a solid wall
          const cellWx = (gridX - Math.floor(width / 2)) * cellSize;
          const cellWz = (gridZ - Math.floor(depth / 2)) * cellSize;
          const closestX = Math.max(cellWx - cellSize / 2, Math.min(nx, cellWx + cellSize / 2));
          const closestZ = Math.max(cellWz - cellSize / 2, Math.min(nz, cellWz + cellSize / 2));
          if ((nx - closestX) ** 2 + (nz - closestZ) ** 2 < playerRadius ** 2) return true;
        }
      }
    }
    return false;
  };

  useFrame((state, delta) => {
    if (gameState !== 'PLAYING') return;

    // Apply snappier damping for tighter control and less residual momentum
    // Higher friction means we stop almost instantly when releasing keys
    velocity.current.x -= velocity.current.x * 25 * delta;
    velocity.current.z -= velocity.current.z * 25 * delta;

    let zMove = Number(keys.w) - Number(keys.s);
    let xMove = Number(keys.d) - Number(keys.a);
    
    // If no keyboard input, read from mobile joystick
    if (zMove === 0 && xMove === 0) {
      zMove = -mutableGameState.joystick.y;
      xMove = mutableGameState.joystick.x;
    }

    direction.current.z = zMove;
    direction.current.x = xMove;
    direction.current.normalize(); // Ensure consistent movement in all directions

    const speed = 100.0; // Increased to offset the extremely high damping rate for responsive max speed

    if (zMove !== 0) velocity.current.z += direction.current.z * speed * delta;
    if (xMove !== 0) velocity.current.x += direction.current.x * speed * delta;

    // Use camera matrix to determine correct world forward/right vectors
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0); // world right
    const forward = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 2).negate(); // world forward
        
    // Keep movement strictly horizontal
    right.y = 0; right.normalize();
    forward.y = 0; forward.normalize();

    // Calculate actual world displacements
    const dashX = right.x * (velocity.current.x * delta) + forward.x * (velocity.current.z * delta);
    const dashZ = right.z * (velocity.current.x * delta) + forward.z * (velocity.current.z * delta);

    camera.position.x += dashX;
    if (checkCollision(camera.position.x, camera.position.z)) {
      camera.position.x -= dashX;
      // Intentionally NOT zeroing velocity.current.x here
      // local velocity != world velocity, so zeroing it ruins strafing/cornering momentum!
    }

    camera.position.z += dashZ;
    if (checkCollision(camera.position.x, camera.position.z)) {
      camera.position.z -= dashZ;
      // Intentionally NOT zeroing velocity.current.z here
      // Allows for butter-smooth sliding along walls instead of dead stops
    }

    // Camera vision organically follows the strafing direction (mouse-free turning)
    const turnSpeed = 2.0;
    
    // Convert to strict YXZ Euler to perfectly sync with PointerLockControls without flipping
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.setFromQuaternion(camera.quaternion);
    
    if (keys.a) euler.y += turnSpeed * delta;
    if (keys.d) euler.y -= turnSpeed * delta;

    // Apply touch look controls
    euler.y -= mutableGameState.lookDelta.x;
    euler.x -= mutableGameState.lookDelta.y;
    mutableGameState.lookDelta.x = 0;
    mutableGameState.lookDelta.y = 0;
    
    // Clamp pitch (X-axis) strictly to prevent 360 flip-over nausea
    euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, euler.x));
    
    // Apply correctly formatted quaternion back
    camera.quaternion.setFromEuler(euler);

    // Calculate current speed magnitude for the head bob effect
    const curSpeed = Math.sqrt(velocity.current.x ** 2 + velocity.current.z ** 2);
    
    // Accumulate the bob timer only when actually moving
    if (curSpeed > 0.1) {
      bobTimer.current += delta * curSpeed * 1.5;
    }
    
    // Compute the vertical offset from a sine wave to simulate walking
    const bobOffset = Math.sin(bobTimer.current) * 0.12;

    camera.position.y = (cellSize * 0.75) + bobOffset;
    
    // Broadcast position to minimap overlay natively
    mutableGameState.playerX = camera.position.x;
    mutableGameState.playerZ = camera.position.z;
  });

  return (
    <>
      <PointerLockControls ref={pointerLockRef} selector="#start-button" />
    </>
  );
}

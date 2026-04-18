import { useMemo, useRef, useEffect } from 'react';
import { useMazeStore } from '../store';
import { CellType, getWorldPos } from '../MazeGenerator';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

export function Maze() {
  const { grid, width, depth, cellSize } = useMazeStore();
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null);
  const coreMeshRef = useRef<THREE.InstancedMesh>(null);
  const exitRef = useRef<THREE.Mesh>(null);

  const subVoxelSize = 0.25;
  const voxelsPerCell = Math.round(cellSize / subVoxelSize); // 8
  const wallHeightVoxels = 13; // Total height ≈ 3.25 units

  // Calculate total instances needed for walls
  const { wallTransforms, wallColors, coreTransforms, exitPos, exitRotation } = useMemo(() => {
    const transforms: THREE.Matrix4[] = [];
    const colors: THREE.Color[] = [];
    const cTransforms: THREE.Matrix4[] = [];
    let exitPos: [number, number, number] = [0, 0, 0];
    let exitRotation = 0;

    const palette = [
      // Base Grays & Slates
      '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1',
      // Emerald / Forest
      '#059669', '#10b981', '#34d399', '#6ee7b7',
      // Ocean / Sky
      '#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc',
      // Amethyst / Violet
      '#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd',
      // Gold / Sand
      '#ca8a04', '#eab308', '#fde047', '#fef08a',
      // Rose / Coral
      '#e11d48', '#f43f5e', '#fb7185', '#fda4af'
    ].map(c => new THREE.Color(c));

    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        const cell = grid[z][x];
        const [wx, wy, wz] = getWorldPos(x, z, width, depth, cellSize);

        if (cell === CellType.WALL) {
          // 1. SOLID CORE WALL (to block background void from bleeding through chips)
          const coreMatrix = new THREE.Matrix4();
          coreMatrix.setPosition(wx, (wallHeightVoxels * subVoxelSize) / 2, wz);
          cTransforms.push(coreMatrix);

          // 2. SURFACE SUBVOXELS (with chipped aesthetic)
          const startX = wx - cellSize / 2 + subVoxelSize / 2;
          const startZ = wz - cellSize / 2 + subVoxelSize / 2;

          for (let sy = 0; sy < wallHeightVoxels; sy++) {
            for (let sx = 0; sx < voxelsPerCell; sx++) {
              for (let sz = 0; sz < voxelsPerCell; sz++) {
                // Optimize: hollow out the walls (only outer shell, since core is behind it)
                const isSurface = sx === 0 || sx === voxelsPerCell - 1 || 
                                  sz === 0 || sz === voxelsPerCell - 1 || 
                                  sy === wallHeightVoxels - 1;
                
                if (!isSurface) continue;

                // Determine base chip chance
                let chipChance = 0.08;
                
                // Edge and corner voxels are more likely to be chipped for a ruined look
                const isEdgeX = sx === 0 || sx === voxelsPerCell - 1;
                const isEdgeZ = sz === 0 || sz === voxelsPerCell - 1;
                const isTop = sy === wallHeightVoxels - 1;
                
                if ((isEdgeX && isEdgeZ) || (isTop && (isEdgeX || isEdgeZ))) {
                  chipChance = 0.35; // Corners chip heavily
                } else if (isTop || isEdgeX || isEdgeZ) {
                  chipChance = 0.15; // Edges chip decently
                }

                // Create chipped ruined aesthetic
                if (Math.random() < chipChance) continue;

                const vx = startX + sx * subVoxelSize;
                const vz = startZ + sz * subVoxelSize;
                const vy = sy * subVoxelSize + subVoxelSize / 2;

                const matrix = new THREE.Matrix4();
                matrix.setPosition(vx, vy, vz);
                transforms.push(matrix);

                // Mix colors: bias towards slightly grouped colors via sine wave hash, mixed with noise
                const hash = Math.abs(Math.sin(vx * 0.8) + Math.cos(vz * 0.8) + Math.sin(vy * 1.5));
                const colorCategory = Math.floor(hash * 3.5) % 6; // 0 to 5 for the 6 color categories
                const baseIndex = colorCategory * 4; 
                
                // Combine structural color grouping with occasional totally random chaotic blocks
                const finalColor = Math.random() > 0.8 
                  ? palette[Math.floor(Math.random() * palette.length)] 
                  : palette[baseIndex + Math.floor(Math.random() * 4)];

                colors.push(finalColor);
              }
            }
          }
        } else if (cell === CellType.EXIT) {
          exitPos = [wx, cellSize / 2, wz];
          // Determine the orientation based on maze boundary
          if (x === width - 1) exitRotation = Math.PI / 2;
        }
      }
    }
    return { wallTransforms: transforms, wallColors: colors, coreTransforms: cTransforms, exitPos, exitRotation };
  }, [grid, width, depth, cellSize]);

  useEffect(() => {
    if (instancedMeshRef.current) {
      wallTransforms.forEach((matrix, i) => {
        instancedMeshRef.current!.setMatrixAt(i, matrix);
        instancedMeshRef.current!.setColorAt(i, wallColors[i]);
      });
      instancedMeshRef.current.instanceMatrix.needsUpdate = true;
      if (instancedMeshRef.current.instanceColor) {
        instancedMeshRef.current.instanceColor.needsUpdate = true;
      }
    }
    
    if (coreMeshRef.current) {
      coreTransforms.forEach((matrix, i) => {
        coreMeshRef.current!.setMatrixAt(i, matrix);
      });
      coreMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [wallTransforms, wallColors, coreTransforms]);

  useFrame((state) => {
    if (exitRef.current) {
      exitRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.1;
    }
  });

  return (
    <>
      {/* Dark Solid Cores to block void flashing when chipped blocks render */}
      <instancedMesh
        ref={coreMeshRef}
        args={[undefined, undefined, coreTransforms.length]}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        <boxGeometry args={[cellSize - 0.05, wallHeightVoxels * subVoxelSize - 0.05, cellSize - 0.05]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} flatShading={true} />
      </instancedMesh>

      {/* Surface Decorative Chipped Voxels */}
      <instancedMesh
        ref={instancedMeshRef}
        args={[undefined, undefined, wallTransforms.length]}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        <boxGeometry args={[subVoxelSize * 0.9, subVoxelSize * 0.9, subVoxelSize * 0.9]} />
        <meshStandardMaterial roughness={0.5} metalness={0.1} flatShading={true} />
      </instancedMesh>

      {/* Floor */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, 0, 0]} 
        receiveShadow
      >
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.9} />
      </mesh>

      {/* Exit Marker (Voxel Torii Gate) */}
      <group position={[exitPos[0], 0, exitPos[2]]} rotation={[0, exitRotation, 0]}>
        <group ref={exitRef}>
          {/* Inner Glowing Portal */}
          <mesh position={[0, cellSize * 0.7, 0]}>
            <boxGeometry args={[cellSize * 0.5, cellSize * 0.8, subVoxelSize * 0.2]} />
            <meshStandardMaterial color="#64ffda" emissive="#64ffda" emissiveIntensity={5} transparent opacity={0.9} />
          </mesh>
        </group>

        {/* Left Pillar */}
        <mesh position={[-cellSize * 0.4, cellSize * 0.8, 0]}>
          <boxGeometry args={[subVoxelSize, cellSize * 1.6, subVoxelSize]} />
          <meshStandardMaterial color="#f43f5e" emissive="#f43f5e" emissiveIntensity={2} />
        </mesh>
        
        {/* Right Pillar */}
        <mesh position={[cellSize * 0.4, cellSize * 0.8, 0]}>
          <boxGeometry args={[subVoxelSize, cellSize * 1.6, subVoxelSize]} />
          <meshStandardMaterial color="#f43f5e" emissive="#f43f5e" emissiveIntensity={2} />
        </mesh>

        {/* Top Crossbar */}
        <mesh position={[0, cellSize * 1.5, 0]}>
          <boxGeometry args={[cellSize + subVoxelSize * 2, subVoxelSize, subVoxelSize]} />
          <meshStandardMaterial color="#f43f5e" emissive="#f43f5e" emissiveIntensity={2} />
        </mesh>
        
        {/* Lower Crossbar */}
        <mesh position={[0, cellSize * 1.1, 0]}>
          <boxGeometry args={[cellSize + subVoxelSize, subVoxelSize * 0.8, subVoxelSize * 0.8]} />
          <meshStandardMaterial color="#f43f5e" emissive="#f43f5e" emissiveIntensity={2} />
        </mesh>

        {/* Ambient Area Glow */}
        <pointLight color="#64ffda" intensity={4} distance={12} position={[0, cellSize, 0]} />
        <pointLight color="#f43f5e" intensity={4} distance={8} position={[0, cellSize * 1.5, 0]} />
      </group>
    </>
  );
}

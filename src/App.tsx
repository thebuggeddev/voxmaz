/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Maze } from './components/Maze';
import { Player } from './components/Player';
import { GameUI } from './components/GameUI';
import { useMazeStore } from './store';

export default function App() {
  const seed = useMazeStore(s => s.seed);

  return (
    <div className="w-full h-screen bg-[#f8fafc] overflow-hidden relative">
      <Canvas shadows camera={{ fov: 75, near: 0.05, far: 100 }}>
        <color attach="background" args={['#f8fafc']} />
        <fog attach="fog" args={['#f8fafc', 3, 35]} />
        <ambientLight intensity={0.7} />
        <directionalLight
          position={[15, 25, 10]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        
        <group key={seed}>
          <Maze />
          <Player />
        </group>

        <EffectComposer disableNormalPass multisampling={4}>
          <Bloom luminanceThreshold={1.5} mipmapBlur intensity={1.5} />
        </EffectComposer>
      </Canvas>
      <GameUI />
    </div>
  );
}

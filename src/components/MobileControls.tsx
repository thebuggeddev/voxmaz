import { useEffect, useRef, useState } from 'react';
import { mutableGameState, useGameStore } from '../store';

export function MobileControls() {
  const { gameState, setGameState } = useGameStore();
  const joystickRef = useRef<HTMLDivElement>(null);
  const touchLookAreaRef = useRef<HTMLDivElement>(null);
  
  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });

  const lookTouchId = useRef<number | null>(null);
  const moveTouchId = useRef<number | null>(null);
  const lastLookPos = useRef({ x: 0, y: 0 });

  const maxRadius = 40;

  useEffect(() => {
    // Only show on touch devices
    if (!('ontouchstart' in window) && navigator.maxTouchPoints === 0) {
      // return; // Uncomment to strict-hide on desktop. But testing in browser might be easier if we leave it or rely on CSS media queries
    }
  }, []);

  if (gameState !== 'PLAYING') return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.clientX < window.innerWidth / 2) {
            // Left half = Joystick
            if (moveTouchId.current === null) {
                moveTouchId.current = touch.identifier;
                setJoystickActive(true);
                setJoystickPos({ x: touch.clientX, y: touch.clientY });
                setKnobPos({ x: 0, y: 0 });
            }
        } else {
            // Right half = Look
            if (lookTouchId.current === null) {
                lookTouchId.current = touch.identifier;
                lastLookPos.current = { x: touch.clientX, y: touch.clientY };
            }
        }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const defaultPrevented = false; // Add prevent default later natively
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];

        if (touch.identifier === moveTouchId.current) {
            const dx = touch.clientX - joystickPos.x;
            const dy = touch.clientY - joystickPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const rawX = dist > maxRadius ? (dx / dist) * maxRadius : dx;
            const rawY = dist > maxRadius ? (dy / dist) * maxRadius : dy;
            
            setKnobPos({ x: rawX, y: rawY });
            
            // Normalize for mutable state (-1 to 1)
            mutableGameState.joystick.x = rawX / maxRadius;
            mutableGameState.joystick.y = rawY / maxRadius; // y goes down, game expects up is negative. We'll handle it in Player
        }

        if (touch.identifier === lookTouchId.current) {
            const dx = touch.clientX - lastLookPos.current.x;
            const dy = touch.clientY - lastLookPos.current.y;
            mutableGameState.lookDelta.x += dx * 0.005; 
            mutableGameState.lookDelta.y += dy * 0.005;
            lastLookPos.current = { x: touch.clientX, y: touch.clientY };
        }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === moveTouchId.current) {
              moveTouchId.current = null;
              setJoystickActive(false);
              mutableGameState.joystick.x = 0;
              mutableGameState.joystick.y = 0;
          }
          if (touch.identifier === lookTouchId.current) {
              lookTouchId.current = null;
          }
      }
  };

  return (
    <div 
        className="absolute inset-0 pointer-events-auto touch-none z-[5]"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
    >
        {/* Render virtual joystick */}
        {joystickActive && (
            <div 
                className="absolute w-[100px] h-[100px] bg-white/20 border-2 border-white/50 rounded-full flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2"
                style={{ left: joystickPos.x, top: joystickPos.y }}
            >
                <div 
                    className="w-[40px] h-[40px] bg-white/80 rounded-full shadow-lg"
                    style={{ transform: `translate(${knobPos.x}px, ${knobPos.y}px)` }}
                />
            </div>
        )}
        
        {/* Pause Button for Mobile */}
        <button 
           className="absolute top-6 right-6 w-12 h-12 bg-white/20 backdrop-blur border border-white/40 rounded-full flex items-center justify-center text-white"
           onClick={(e) => {
               e.stopPropagation();
               setGameState('PAUSED');
           }}
        >
            <div className="flex gap-1">
                <div className="w-1 h-4 bg-white rounded-full"></div>
                <div className="w-1 h-4 bg-white rounded-full"></div>
            </div>
        </button>
    </div>
  );
}

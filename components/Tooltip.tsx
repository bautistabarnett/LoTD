
import React, { useLayoutEffect, useRef, useState } from 'react';
import { Item } from '../types';
import { RARITY_COLORS } from '../constants';

interface TooltipProps {
  item: Item;
  comparedItem?: Item;
  position: { x: number; y: number };
}

const ItemCard = ({ item, label, isEquipped }: { item: Item; label?: string, isEquipped?: boolean }) => {
  const textColor = RARITY_COLORS[item.rarity];

  let borderColor = 'border-stone-600';
  if (item.rarity === 'Magic') borderColor = 'border-blue-800';
  if (item.rarity === 'Rare') borderColor = 'border-yellow-700';
  if (item.rarity === 'Unique') borderColor = 'border-amber-600';

  return (
    <div className={`w-72 bg-[#0a0a0a]/95 border-2 ${borderColor} p-0 shadow-[0_0_30px_rgba(0,0,0,0.8)] rounded-sm text-sm relative shrink-0 flex flex-col`}>
      {/* Background Texture */}
      <div className="absolute inset-0 bg-texture-noise opacity-10 pointer-events-none"></div>
      
      {/* Header */}
      <div className={`p-3 bg-gradient-to-b from-stone-900 to-black border-b ${borderColor} relative shrink-0`}>
          {label && (
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-stone-950 text-stone-400 text-[9px] px-3 py-0.5 border border-stone-700 uppercase tracking-widest whitespace-nowrap z-10 shadow-md">
              {label}
            </div>
          )}
          <h3 className={`font-bold text-lg diablo-font text-center ${textColor} tracking-wider`}>
            {item.name}
          </h3>
          <p className={`text-center text-xs uppercase tracking-widest font-bold opacity-70 ${textColor}`}>
            {item.rarity} {item.type}
          </p>
      </div>

      {/* Content - Scrollable if too tall */}
      <div className="p-4 space-y-3 relative overflow-y-auto custom-scrollbar" style={{ maxHeight: 'calc(100vh - 200px)' }}>
        <div className="space-y-1">
          {item.stats.map((stat, idx) => (
            <div key={idx} className="flex justify-between text-stone-300 font-serif text-[15px]">
              <span className="text-stone-400">{stat.type}</span>
              <span className={`font-bold ${
                  stat.type === 'Damage' ? 'text-red-400' : 
                  stat.type === 'Armor' ? 'text-stone-200' :
                  stat.type === 'Magic Find' ? 'text-yellow-400' :
                  'text-blue-200'
              }`}>+{stat.value}{stat.type.includes('Chance') || stat.type.includes('Steal') ? '%' : ''}</span>
            </div>
          ))}
        </div>

        {!item.isIdentified && (
          <div className="text-red-500 italic text-xs border-t border-red-900/30 pt-2 text-center">
            Unidentified Item<br/>
            <span className="text-stone-500 text-[10px]">Right-click to identify</span>
          </div>
        )}

        {item.isIdentified && item.flavorText && (
          <div className="text-stone-500 text-xs border-t border-stone-800 pt-3 mt-2">
            <p className="serif-font italic text-stone-400 text-center leading-relaxed">"{item.flavorText}"</p>
          </div>
        )}

        <div className="pt-2 flex justify-end mt-auto">
            <span className="text-stone-700 text-[9px] font-mono">iLvl {item.level}</span>
        </div>
      </div>
    </div>
  );
};

const Tooltip: React.FC<TooltipProps> = ({ item, comparedItem, position }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; opacity: number }>({ top: 0, left: 0, opacity: 0 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Measure dimensions
    const rect = el.getBoundingClientRect();
    const { innerWidth: vw, innerHeight: vh } = window;
    const padding = 10;
    const offset = 15;

    let x = position.x + offset;
    let y = position.y + offset;

    // --- Smart Horizontal Positioning ---
    // Default: Right of cursor
    // If it overflows right edge
    if (x + rect.width > vw - padding) {
      // Flip to Left of cursor
      x = position.x - rect.width - offset; 
      
      // If flipped left also overflows left edge (e.g. huge tooltip or narrow screen)
      if (x < padding) {
          x = padding; // Clamp to left edge
      }
    }
    
    // Final safety clamp for right overflow if width > viewport
    if (x + rect.width > vw) {
        x = Math.max(padding, vw - rect.width - padding);
    }

    // --- Smart Vertical Positioning ---
    // Default: Below cursor
    // If it overflows bottom edge
    if (y + rect.height > vh - padding) {
      // Flip to Above cursor
      y = position.y - rect.height - offset; 
      
      // If flipped top also overflows top edge
      if (y < padding) {
          y = padding; // Clamp to top edge
      }
    }

    // Apply calculated coords
    setCoords({ top: y, left: x, opacity: 1 });

  }, [position, item, comparedItem]);

  return (
    <div
      ref={containerRef}
      className="fixed z-[100] flex flex-col md:flex-row gap-2 pointer-events-none transition-opacity duration-150 ease-out max-w-[98vw] flex-wrap md:flex-nowrap"
      style={{ 
        top: coords.top, 
        left: coords.left, 
        opacity: coords.opacity 
      }}
    >
      <ItemCard item={item} />
      {comparedItem && <ItemCard item={comparedItem} label="Equipped" isEquipped />}
    </div>
  );
};

export default Tooltip;

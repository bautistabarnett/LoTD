
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
  let bgGradient = 'from-stone-900 to-black';
  let labelColor = 'bg-stone-800 text-stone-400 border-stone-600';

  if (isEquipped) {
      borderColor = 'border-stone-500'; // Muted border for equipped
      bgGradient = 'from-stone-950 to-black';
      labelColor = 'bg-stone-800 text-stone-400 border-stone-600';
  } else {
      if (item.rarity === 'Magic') borderColor = 'border-blue-800';
      if (item.rarity === 'Rare') borderColor = 'border-yellow-700';
      if (item.rarity === 'Unique') borderColor = 'border-amber-600';
      
      // Highlight "New" or "Inspecting"
      if (label === 'Inspecting' || label === 'New') {
          labelColor = 'bg-green-900 text-green-300 border-green-700';
      }
  }

  return (
    <div className={`
        w-72 md:w-80 
        bg-[#0a0a0a]/95 
        border-2 ${borderColor} 
        p-0 
        shadow-[0_0_30px_rgba(0,0,0,0.8)] 
        rounded-sm 
        text-sm 
        relative 
        shrink-0 
        flex flex-col 
        tooltip-card
        transition-transform
        ${isEquipped ? 'opacity-90 scale-[0.98] origin-top' : 'z-10'}
    `}>
      {/* Background Texture */}
      <div className="absolute inset-0 bg-texture-noise opacity-10 pointer-events-none"></div>
      
      {/* Header */}
      <div className={`p-3 bg-gradient-to-b ${bgGradient} border-b ${borderColor} relative shrink-0`}>
          {label && (
            <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 border text-[10px] uppercase tracking-widest font-bold shadow-md rounded-sm z-20 whitespace-nowrap ${labelColor}`}>
              {label}
            </div>
          )}
          <h3 className={`font-bold text-lg diablo-font text-center ${textColor} tracking-wider truncate`}>
            {item.name}
          </h3>
          <p className={`text-center text-xs uppercase tracking-widest font-bold opacity-70 ${textColor}`}>
            {item.rarity} {item.type}
          </p>
      </div>

      {/* Content - Scrollable if content itself is massive, though outer container handles main scroll */}
      <div className="p-4 space-y-3 relative">
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

        <div className="pt-2 flex justify-between items-center mt-auto border-t border-white/5">
             <div className="flex gap-2">
                 {isEquipped ? (
                     <span className="text-[10px] text-stone-500 uppercase font-bold">Currently Equipped</span>
                 ) : (
                     <span className="text-[10px] text-green-500 uppercase font-bold">In Inventory</span>
                 )}
             </div>
            <span className="text-stone-700 text-[9px] font-mono">iLvl {item.level}</span>
        </div>
      </div>
    </div>
  );
};

const Tooltip: React.FC<TooltipProps> = ({ item, comparedItem, position }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ opacity: 0 });
  
  // Logic: Don't compare item with itself
  const comparison = comparedItem && comparedItem.id !== item.id ? comparedItem : undefined;

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const { innerWidth: vw, innerHeight: vh } = window;
    const isMobile = vw < 768; // Mobile breakpoint logic

    if (isMobile) {
        // --- MOBILE LAYOUT: Centered Modal Overlay ---
        // Stacked vertically, fixed to center screen, scrollable if tall
        setStyle({
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: 1,
            maxHeight: '85vh',
            maxWidth: '95vw',
            overflowY: 'auto', // Enable scrolling within the tooltip container
            zIndex: 100,
            pointerEvents: 'auto', // Allow user to scroll the tooltip
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            padding: '10px',
            // Backdrop blur to focus attention
            backdropFilter: 'blur(2px)',
            borderRadius: '8px'
        });
    } else {
        // --- DESKTOP LAYOUT: Follow Cursor ---
        // Side-by-side, fixed to cursor position but constrained to viewport
        const padding = 15;
        const offset = 20;
        let x = position.x + offset;
        let y = position.y + offset;

        // Smart Flip Horizontal
        if (x + rect.width > vw - padding) {
            x = position.x - rect.width - offset;
        }
        // Clamp Horizontal
        if (x < padding) x = padding;
        if (x + rect.width > vw) x = vw - rect.width - padding; // Hard clamp right

        // Smart Flip Vertical
        if (y + rect.height > vh - padding) {
            y = position.y - rect.height - offset;
        }
        // Clamp Vertical
        if (y < padding) y = padding;
        if (y + rect.height > vh) y = vh - rect.height - padding; // Hard clamp bottom

        setStyle({
            position: 'fixed',
            top: y,
            left: x,
            opacity: 1,
            zIndex: 100,
            pointerEvents: 'none', // Allow clicking through on desktop (standard tooltip behavior)
            display: 'flex',
            flexDirection: 'row', // Side by side
            gap: '8px'
        });
    }

  }, [position, item, comparison]);

  return (
    <div
      ref={containerRef}
      className="tooltip-container transition-opacity duration-150 ease-out"
      style={style}
    >
      {/* Show the hovered item (New) first/left/top */}
      <ItemCard item={item} label={comparison ? "Inspecting" : undefined} />
      
      {/* Show the equipped item (Comparison) second/right/bottom */}
      {comparison && <ItemCard item={comparison} label="Equipped" isEquipped />}
    </div>
  );
};

export default Tooltip;

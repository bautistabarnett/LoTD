
import React from 'react';
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
    <div className={`w-72 bg-[#0a0a0a]/95 border-2 ${borderColor} p-0 shadow-[0_0_30px_rgba(0,0,0,0.8)] rounded-sm text-sm relative shrink-0 overflow-hidden`}>
      {/* Background Texture */}
      <div className="absolute inset-0 bg-texture-noise opacity-10 pointer-events-none"></div>
      
      {/* Header */}
      <div className={`p-3 bg-gradient-to-b from-stone-900 to-black border-b ${borderColor} relative`}>
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

      {/* Content */}
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

        <div className="absolute bottom-1 right-2 text-stone-700 text-[9px] font-mono">
          iLvl {item.level}
        </div>
      </div>
    </div>
  );
};

const Tooltip: React.FC<TooltipProps> = ({ item, comparedItem, position }) => {
  const viewportHeight = window.innerHeight;
  const isRightSide = position.x > window.innerWidth * 0.6;
  const isBottomHalf = position.y > viewportHeight * 0.6;

  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 100,
    left: isRightSide ? 'auto' : position.x + 15,
    right: isRightSide ? (window.innerWidth - position.x) + 15 : 'auto',
    top: isBottomHalf ? 'auto' : position.y + 10,
    bottom: isBottomHalf ? (window.innerHeight - position.y) + 10 : 'auto',
  };

  return (
    <div
      className="pointer-events-none flex gap-2 items-start animate-in fade-in duration-150"
      style={style}
    >
      <ItemCard item={item} />
      {comparedItem && <ItemCard item={comparedItem} label="Currently Equipped" isEquipped />}
    </div>
  );
};

export default Tooltip;

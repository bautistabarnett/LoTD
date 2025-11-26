
import React, { useMemo } from 'react';
import { PassiveSkill, BaseAttributes } from '../types';
import { PASSIVE_THEME_COLORS } from '../constants';
import { BaseModal } from './BaseModal';

interface LevelUpModalProps {
  newPassive: PassiveSkill | null;
  isUpgrade: boolean;
  pointsAvailable: number;
  baseAttributes: BaseAttributes;
  flavorText?: string;
  onAllocate: (stat: keyof BaseAttributes) => void;
  onClose: () => void;
}

const LevelUpModal: React.FC<LevelUpModalProps> = ({ 
  newPassive, 
  isUpgrade, 
  pointsAvailable, 
  baseAttributes, 
  flavorText,
  onAllocate, 
  onClose 
}) => {
  
  const stats: { key: keyof BaseAttributes; label: string; color: string }[] = useMemo(() => [
    { key: 'strength', label: 'Strength', color: 'text-red-500' },
    { key: 'dexterity', label: 'Dexterity', color: 'text-green-500' },
    { key: 'intelligence', label: 'Intelligence', color: 'text-blue-500' },
    { key: 'vitality', label: 'Vitality', color: 'text-purple-500' }
  ], []);

  const themeStyles = newPassive ? PASSIVE_THEME_COLORS[newPassive.theme] : null;

  return (
    <BaseModal.Container zIndex="z-[60]" maxWidth="max-w-4xl" className="border-amber-600 shadow-[0_0_60px_rgba(245,158,11,0.2)]">
      {/* Animated background effect */}
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-amber-500 to-transparent animate-pulse"></div>

      <BaseModal.Body className="flex flex-col md:flex-row gap-4 md:gap-8">
        {/* Left Column: New Skill */}
        <div className="flex-1 flex flex-col shrink-0">
            <h2 className="text-2xl md:text-3xl diablo-font text-amber-500 text-center mb-2 tracking-widest drop-shadow-md">LEVEL UP!</h2>
            <div className="text-center text-stone-400 mb-4 md:mb-8 text-xs md:text-sm">You have grown stronger.</div>

            {newPassive && themeStyles && (
            <div className={`flex-grow flex flex-col justify-center bg-black/40 border-2 ${themeStyles.border} p-4 md:p-6 rounded-lg shadow-inner relative overflow-hidden group min-h-[200px]`}>
                <div className={`absolute inset-0 ${themeStyles.bg} opacity-20 group-hover:opacity-30 transition-opacity`}></div>
                
                <div className="relative z-10">
                    <div className="text-center text-xs uppercase tracking-widest text-stone-500 mb-2">
                         {isUpgrade ? 'Skill Upgraded' : 'New Passive Acquired'}
                    </div>
                    
                    <div className="flex flex-col items-center gap-4 mb-4">
                        <div className={`text-5xl md:text-6xl filter drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] animate-bounce`}>
                            {themeStyles.icon}
                        </div>
                        <div>
                            <h3 className={`text-xl md:text-2xl ${themeStyles.text} font-bold diablo-font text-center`}>{newPassive.name}</h3>
                            <div className={`text-center text-xs uppercase tracking-wider ${themeStyles.text} opacity-70 border-b border-stone-700 inline-block px-2 mx-auto`}>
                                {newPassive.theme}
                            </div>
                        </div>
                    </div>

                    <div className="text-center text-stone-200 font-mono text-xs md:text-sm mb-4 bg-black/50 p-2 rounded border border-stone-800">
                        <span className="text-amber-500">Rank {newPassive.level}</span>
                        <div className="h-px bg-stone-800 w-1/2 mx-auto my-2"></div>
                        {newPassive.description.replace('{value}', newPassive.value.toString())}
                    </div>
                    
                    {/* Flavor Text */}
                    <div className="pt-4 mt-auto">
                        <p className="text-center text-stone-500 text-xs font-serif italic leading-relaxed">
                        {flavorText ? `"${flavorText}"` : "..."}
                        </p>
                    </div>
                </div>
            </div>
            )}
        </div>

        {/* Right Column: Stat Allocation */}
        <div className="flex-1 flex flex-col justify-center border-t md:border-t-0 md:border-l border-stone-800 pt-4 md:pt-0 md:pl-8">
          <div className="mb-6">
            <h3 className="text-lg md:text-xl diablo-font text-stone-300 mb-4 border-b border-stone-700 pb-2">Attribute Allocation</h3>
            
            <div className="flex justify-between items-center mb-4 bg-stone-900/50 p-3 rounded border border-stone-700">
                <span className="text-stone-400 text-sm uppercase tracking-wider">Points Available</span>
                <span className="text-amber-500 font-bold text-2xl animate-pulse">{pointsAvailable}</span>
            </div>
            
            <div className="space-y-3 md:space-y-4">
                {stats.map((stat) => (
                <div key={stat.key} className="flex items-center justify-between bg-black/30 p-3 rounded border border-stone-800 hover:border-stone-600 transition-colors">
                    <div className="flex flex-col">
                        <span className={`font-bold ${stat.color}`}>{stat.label}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-stone-200 font-mono text-xl">{baseAttributes[stat.key]}</span>
                        <button
                            onClick={() => onAllocate(stat.key)}
                            disabled={pointsAvailable <= 0}
                            className={`
                                w-10 h-10 md:w-10 md:h-10 flex items-center justify-center rounded border-2 font-bold text-xl transition-all
                                ${pointsAvailable > 0 
                                ? 'bg-stone-800 border-stone-600 text-amber-400 hover:bg-stone-700 hover:border-amber-500 hover:scale-110 hover:text-white shadow-lg' 
                                : 'bg-stone-950 border-stone-800 text-stone-700 cursor-not-allowed'}
                            `}
                        >
                        +
                        </button>
                    </div>
                </div>
                ))}
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-full py-3 md:py-4 mt-auto bg-gradient-to-b from-amber-900 to-amber-950 hover:from-amber-800 hover:to-amber-900 border border-amber-700 text-amber-100 font-bold tracking-[0.2em] uppercase transition-all shadow-lg hover:shadow-amber-900/40"
          >
            {pointsAvailable > 0 ? 'Finish Later' : 'Accept Power'}
          </button>
        </div>
      </BaseModal.Body>
    </BaseModal.Container>
  );
};

export default React.memo(LevelUpModal);

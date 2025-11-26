
import React, { useMemo } from 'react';
import { PlayerStats, BaseAttributes, PassiveSkill } from '../types';
import { PASSIVE_THEME_COLORS } from '../constants';
import GameIcon from './GameIcon';
import { BaseModal } from './BaseModal';

interface StatsModalProps {
  stats: PlayerStats;
  baseAttributes: BaseAttributes;
  statPoints: number;
  passiveSkills: PassiveSkill[];
  onAllocate: (attr: keyof BaseAttributes) => void;
  onClose: () => void;
}

const StatsModal: React.FC<StatsModalProps> = ({ 
  stats, 
  baseAttributes, 
  statPoints, 
  passiveSkills,
  onAllocate, 
  onClose 
}) => {
  
  const attributes = useMemo(() => [
    { label: 'Strength', key: 'strength', val: stats.strength, base: baseAttributes.strength, color: 'text-red-500', desc: 'Increases Damage' },
    { label: 'Dexterity', key: 'dexterity', val: stats.dexterity, base: baseAttributes.dexterity, color: 'text-green-500', desc: 'Increases Armor & Dodge' },
    { label: 'Intelligence', key: 'intelligence', val: stats.intelligence, base: baseAttributes.intelligence, color: 'text-blue-500', desc: 'Increases Crit Chance' },
    { label: 'Vitality', key: 'vitality', val: stats.vitality, base: baseAttributes.vitality, color: 'text-purple-500', desc: 'Increases Health' },
  ], [stats, baseAttributes]);

  const combatStats = useMemo(() => [
    { label: 'Damage', val: stats.damage, icon: '⚔️' },
    { label: 'Armor', val: stats.armor, icon: '🛡️' },
    { label: 'Max HP', val: stats.maxHp, icon: '❤️' },
    { label: 'Life Steal', val: `${stats.lifeSteal}%`, icon: '🩸' },
    { label: 'Crit Chance', val: `${stats.critChance}%`, icon: '⚡' },
    { label: 'Dodge Chance', val: `${stats.dodgeChance}%`, icon: '💨' },
    { label: 'Magic Find', val: `${stats.magicFind}%`, icon: '🍀' },
  ], [stats]);

  return (
    <BaseModal.Container zIndex="z-[90]" maxWidth="max-w-4xl" className="max-h-[100dvh] md:max-h-[90vh]">
        <BaseModal.Header 
            title="Character Sheet" 
            subtitle={`Level ${stats.level} Hero`} 
            icon={<div className="w-8 h-8 bg-stone-800 rounded-full border border-stone-600 flex items-center justify-center shadow-inner"><GameIcon name="hero" className="w-5 h-5 text-stone-400" /></div>} 
            onClose={onClose} 
            textColor="text-stone-200"
        />
        
        <BaseModal.Body className="bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] bg-[#0c0a09] grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {/* Left Column: Core Attributes */}
            <div className="bg-stone-950/50 border border-stone-800 rounded-lg p-4 md:p-6 relative">
                <h3 className="text-lg md:text-xl diablo-font text-amber-600 border-b border-stone-800 pb-2 mb-4">Core Attributes</h3>
                
                {statPoints > 0 && (
                    <div className="absolute top-4 right-4 md:top-6 md:right-6 bg-amber-900/20 border border-amber-600/50 px-3 py-1 rounded animate-pulse">
                        <span className="text-amber-500 text-xs font-bold uppercase tracking-wider">Points: {statPoints}</span>
                    </div>
                )}

                <div className="space-y-3 md:space-y-4">
                    {attributes.map((attr) => (
                        <div key={attr.key} className="flex items-center justify-between bg-black/40 p-2 md:p-3 rounded border border-stone-900 hover:border-stone-700 transition-colors">
                            <div>
                                <div className={`font-bold text-base md:text-lg ${attr.color}`}>{attr.label}</div>
                                <div className="text-[10px] text-stone-500 uppercase">{attr.desc}</div>
                            </div>
                            
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <div className="text-lg md:text-2xl font-mono text-stone-200">{attr.val}</div>
                                    {attr.val > attr.base && (
                                        <div className="text-[10px] text-green-500">({attr.base} + {attr.val - attr.base})</div>
                                    )}
                                </div>
                                
                                {statPoints > 0 && (
                                    <button 
                                        onClick={() => onAllocate(attr.key as keyof BaseAttributes)}
                                        className="w-8 h-8 flex items-center justify-center bg-stone-800 hover:bg-stone-700 text-amber-500 border border-stone-600 rounded shadow hover:scale-110 transition-all"
                                    >
                                        +
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Column: Combat Stats & Overview */}
            <div className="flex flex-col gap-6">
                
                {/* Combat Stats */}
                <div className="bg-stone-950/50 border border-stone-800 rounded-lg p-4 md:p-6">
                    <h3 className="text-lg md:text-xl diablo-font text-stone-400 border-b border-stone-800 pb-2 mb-4">Combat Statistics</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {combatStats.map((stat, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-black/40 p-2 px-3 rounded border border-stone-900">
                                <span className="text-stone-500 text-xs md:text-sm flex items-center gap-2">
                                    <span>{stat.icon}</span> {stat.label}
                                </span>
                                <span className="text-stone-200 font-mono font-bold text-sm">{stat.val}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Experience */}
                <div className="bg-stone-950/50 border border-stone-800 rounded-lg p-4 md:p-6">
                    <h3 className="text-lg md:text-xl diablo-font text-stone-400 border-b border-stone-800 pb-2 mb-4">Experience</h3>
                    <div className="mb-1 flex justify-between text-xs text-stone-500 uppercase font-bold">
                        <span>Progress to Lvl {stats.level + 1}</span>
                        <span>{Math.floor((stats.xp / stats.xpToNextLevel) * 100)}%</span>
                    </div>
                    <div className="w-full h-3 bg-black border border-stone-700 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-700" style={{ width: `${(stats.xp / stats.xpToNextLevel) * 100}%` }}></div>
                    </div>
                    <div className="text-center text-[10px] text-stone-600 mt-1 font-mono">
                        {stats.xp} / {stats.xpToNextLevel} XP
                    </div>
                </div>

                {/* Passives Summary */}
                <div className="bg-stone-950/50 border border-stone-800 rounded-lg p-4 md:p-6 flex-grow">
                    <h3 className="text-lg md:text-xl diablo-font text-stone-400 border-b border-stone-800 pb-2 mb-4">Active Passives</h3>
                    {passiveSkills.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {passiveSkills.map((s, i) => (
                                <div key={i} className={`px-2 py-1 rounded border text-xs font-bold ${PASSIVE_THEME_COLORS[s.theme].bg} ${PASSIVE_THEME_COLORS[s.theme].border} ${PASSIVE_THEME_COLORS[s.theme].text}`}>
                                    {s.name} <span className="text-white opacity-50 ml-1">Lvl {s.level}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-stone-600 text-sm italic text-center">No passive skills learned.</div>
                    )}
                </div>

            </div>
        </BaseModal.Body>
    </BaseModal.Container>
  );
};

export default React.memo(StatsModal);

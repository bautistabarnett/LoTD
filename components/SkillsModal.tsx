

import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PassiveSkill, ActiveEffect, PassiveTheme, BuildLoadout, PlayerStats, ProcTrigger, Rarity } from '../types';
import { PASSIVE_THEME_COLORS, PASSIVE_SET_BONUSES, COMPOSITE_SYNERGIES, PASSIVE_SKILLS_POOL } from '../constants';
import { getRecommendedSkills } from '../services/gameLogic';
import { BaseModal } from './BaseModal';

interface SkillsModalProps {
  passiveSkills: PassiveSkill[];
  activeEffects: ActiveEffect[];
  equippedSkillIds: string[];
  buildLoadouts: BuildLoadout[];
  playerStats: PlayerStats;
  onEquip: (skillId: string) => void;
  onUnequip: (skillId: string) => void;
  onSaveBuild: (name: string) => void;
  onLoadBuild: (loadout: BuildLoadout) => void;
  onRespecAttributes: () => void;
  onClose: () => void;
}

// --- VISUAL CONSTANTS ---

const TIER_CONFIG = {
    novice: { label: 'Novice', border: 'border-stone-600', bg: 'bg-stone-900', text: 'text-stone-400', shadow: '' },
    adept: { label: 'Adept', border: 'border-blue-500', bg: 'bg-blue-950/40', text: 'text-blue-300', shadow: 'shadow-blue-900/20' },
    master: { label: 'Master', border: 'border-amber-500', bg: 'bg-amber-950/40', text: 'text-amber-300', shadow: 'shadow-amber-900/30' },
    legend: { label: 'Legend', border: 'border-red-600', bg: 'bg-red-950/40', text: 'text-red-400', shadow: 'shadow-red-900/40' }
};

const RARITY_BORDER = {
    [Rarity.COMMON]: 'border-stone-700',
    [Rarity.MAGIC]: 'border-blue-700',
    [Rarity.RARE]: 'border-yellow-600',
    [Rarity.UNIQUE]: 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)]',
};

const getSkillTier = (level: number) => {
    if (level >= 15) return 'legend';
    if (level >= 10) return 'master';
    if (level >= 5) return 'adept';
    return 'novice';
};

const TRIGGER_LABELS: Record<ProcTrigger, string> = {
    'onStartTurn': 'Start of Turn',
    'onEndTurn': 'End of Turn',
    'onAttack': 'On Attack',
    'onHit': 'On Hit',
    'onCrit': 'On Critical Hit',
    'onTakeDamage': 'When Hit',
    'onKill': 'On Kill',
    'onBattleStart': 'Battle Start'
};

// --- SUB-COMPONENTS ---

const TooltipAccordion = ({ title, isOpen, onToggle, children }: { title: string, isOpen: boolean, onToggle: () => void, children: React.ReactNode }) => (
    <div className="border border-stone-800 bg-black/20 rounded mb-1 overflow-hidden">
        <button 
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className="w-full flex justify-between items-center px-2 py-1.5 text-[10px] uppercase font-bold text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
        >
            <span>{title}</span>
            <span>{isOpen ? '−' : '+'}</span>
        </button>
        {isOpen && <div className="p-2 border-t border-stone-800 text-xs">{children}</div>}
    </div>
);

// --- TOOLTIP COMPONENT (PORTAL) ---

const SkillTooltip = ({ skill, rect, nextLevelValue, isEquipped }: { skill: PassiveSkill, rect: DOMRect, nextLevelValue: number, isEquipped: boolean }) => {
    const [openSection, setOpenSection] = useState<string | null>('details');
    
    const tier = getSkillTier(skill.level);
    const config = TIER_CONFIG[tier as keyof typeof TIER_CONFIG];
    const themeStyle = PASSIVE_THEME_COLORS[skill.theme];

    // Synergy Lookup
    const relatedSet = PASSIVE_SET_BONUSES.find(s => s.theme === skill.theme);
    const relatedSynergies = COMPOSITE_SYNERGIES.filter(s => s.themes.includes(skill.theme));

    // Calculate position
    const top = rect.bottom + 10 > window.innerHeight - 300 ? rect.top - 10 : rect.bottom + 10;
    const left = Math.min(Math.max(10, rect.left - 50), window.innerWidth - 340);
    const transform = rect.bottom + 10 > window.innerHeight - 300 ? 'translateY(-100%)' : 'translateY(0)';

    const toggleSection = (id: string) => setOpenSection(prev => prev === id ? null : id);

    return createPortal(
        <div 
            className="fixed z-[9999] w-[320px] pointer-events-none animate-in fade-in zoom-in-95 duration-150"
            style={{ top, left, transform }}
        >
            <div className={`bg-[#151413] border-2 ${RARITY_BORDER[skill.rarity || Rarity.COMMON]} shadow-[0_0_50px_rgba(0,0,0,0.9)] rounded-sm overflow-hidden relative`}>
                
                {/* Header */}
                <div className="p-3 bg-gradient-to-r from-stone-950 via-stone-900 to-stone-950 border-b border-stone-800 relative z-10">
                     <div className="flex justify-between items-start mb-1">
                         <h3 className={`font-bold diablo-font text-lg ${skill.rarity === Rarity.UNIQUE ? 'text-amber-500' : config.text} leading-none`}>{skill.name}</h3>
                         <div className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${isEquipped ? 'bg-green-900/60 border-green-500 text-green-400' : 'bg-stone-800 border-stone-600 text-stone-500'}`}>
                            {isEquipped ? 'Active' : 'Passive'}
                         </div>
                     </div>
                     <div className="flex items-center gap-2">
                         <span className={`text-[10px] uppercase tracking-wider font-bold ${themeStyle.text}`}>{skill.theme}</span>
                         <span className="text-[9px] text-stone-600">•</span>
                         <span className={`text-[10px] ${skill.rarity === Rarity.UNIQUE ? 'text-amber-500 font-bold' : 'text-stone-400'}`}>
                             {skill.rarity} {skill.rarity !== Rarity.UNIQUE && `Rank ${skill.level}`}
                         </span>
                     </div>
                </div>

                {/* Body */}
                <div className="p-3 bg-stone-950/95 relative">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-leather.png')] opacity-30"></div>
                    
                    <div className="relative z-10 flex flex-col gap-2">
                        
                        {/* Core Effect Description */}
                        <div className="text-stone-300 text-sm leading-relaxed font-serif">
                            {skill.description.replace('{value}', `[${skill.value}]`)}
                        </div>

                        {/* Logic Summary (If Active Proc) */}
                        {skill.proc && (
                            <div className="bg-black/40 border border-stone-800 rounded p-2 grid grid-cols-2 gap-y-1 gap-x-2 text-[10px] mt-1 font-mono text-stone-400">
                                <div className="text-stone-500">Trigger:</div>
                                <div className="text-stone-200 text-right">{TRIGGER_LABELS[skill.proc.trigger]}</div>
                                
                                {skill.proc.chance < 1 && (
                                    <>
                                        <div className="text-stone-500">Chance:</div>
                                        <div className="text-yellow-400 text-right">{Math.round(skill.proc.chance * 100)}%</div>
                                    </>
                                )}
                                
                                {skill.proc.cooldown > 0 && (
                                    <>
                                        <div className="text-stone-500">Cooldown:</div>
                                        <div className="text-blue-300 text-right">{skill.proc.cooldown} Turns</div>
                                    </>
                                )}
                                
                                {skill.proc.cost && (
                                    <>
                                        <div className="text-stone-500">Cost:</div>
                                        <div className="text-red-400 text-right">
                                            {skill.proc.cost.type === 'hp_percent' ? `${skill.proc.cost.value * 100}% HP` : `${skill.proc.cost.value} HP`}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Divider */}
                        <div className="h-px bg-gradient-to-r from-transparent via-stone-700 to-transparent my-1"></div>

                        {/* Collapsible: Scaling & Evolution */}
                        {skill.rarity !== Rarity.UNIQUE && (
                            <TooltipAccordion title="Power Scaling" isOpen={openSection === 'scaling'} onToggle={() => toggleSection('scaling')}>
                                <div className="grid grid-cols-3 text-center gap-2 mb-2">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-stone-500">Base</span>
                                        <span className="text-stone-400 font-mono">{skill.baseValue}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-amber-500 font-bold">Current</span>
                                        <span className="text-white font-mono font-bold text-lg leading-none">{skill.value}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-green-500">Next Lvl</span>
                                        <span className="text-green-400 font-mono">{nextLevelValue}</span>
                                    </div>
                                </div>
                                <div className="text-[10px] text-stone-500 italic text-center">
                                    Gains +{skill.valuePerLevel} per level
                                </div>
                            </TooltipAccordion>
                        )}

                        {/* Collapsible: Synergies */}
                        {(relatedSet || relatedSynergies.length > 0) && (
                            <TooltipAccordion title="Synergies" isOpen={openSection === 'synergies'} onToggle={() => toggleSection('synergies')}>
                                {relatedSet && (
                                    <div className="mb-2">
                                        <div className="text-[10px] text-amber-500 font-bold mb-0.5">SET: {relatedSet.name}</div>
                                        <div className="text-stone-400 leading-tight text-[10px]">{relatedSet.description}</div>
                                    </div>
                                )}
                                {relatedSynergies.map(syn => (
                                    <div key={syn.id} className="mt-2 pt-2 border-t border-stone-800/50">
                                        <div className="flex items-center gap-1 mb-0.5">
                                            <span className="text-[10px] text-purple-400 font-bold">COMBO: {syn.name}</span>
                                            <div className="flex gap-0.5">
                                                {syn.themes.map(t => <span key={t} className="text-[8px] px-1 bg-stone-800 rounded text-stone-400">{t}</span>)}
                                            </div>
                                        </div>
                                        <div className="text-stone-400 leading-tight text-[10px]">{syn.description}</div>
                                    </div>
                                ))}
                            </TooltipAccordion>
                        )}

                        {/* Collapsible: Details (Environment / Lore) */}
                        <TooltipAccordion title="Details & Lore" isOpen={openSection === 'details'} onToggle={() => toggleSection('details')}>
                            {/* Environmental Tag */}
                            {skill.description.match(/(FOREST|SWAMP|NIGHT|CRYPT|RUINS|WATER)/) && (
                                <div className="mb-2 bg-blue-900/20 border border-blue-800 p-1.5 rounded">
                                    <span className="text-[9px] text-blue-300 font-bold block mb-0.5">ENVIRONMENTAL TRIGGER</span>
                                    <span className="text-[10px] text-stone-300">
                                        Effectiveness changes based on terrain or time of day.
                                    </span>
                                </div>
                            )}
                            
                            {skill.flavorText ? (
                                <p className="text-stone-500 italic font-serif leading-relaxed">"{skill.flavorText}"</p>
                            ) : (
                                <p className="text-stone-600 italic">No historical records found.</p>
                            )}
                        </TooltipAccordion>

                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

// --- SKILL CARD COMPONENT ---

const SkillCard = ({ 
    skill, 
    isEquipped, 
    onClick, 
    onHover, 
    onLeave 
}: { 
    skill: PassiveSkill, 
    isEquipped: boolean, 
    onClick: () => void, 
    onHover: (e: React.MouseEvent, s: PassiveSkill) => void,
    onLeave: () => void
}) => {
    const tier = getSkillTier(skill.level);
    const config = TIER_CONFIG[tier as keyof typeof TIER_CONFIG];
    const themeStyle = PASSIVE_THEME_COLORS[skill.theme];
    
    // Rarity Styling
    const rarityBorder = RARITY_BORDER[skill.rarity || Rarity.COMMON];
    const isUnique = skill.rarity === Rarity.UNIQUE;

    return (
        <div 
            onClick={onClick}
            onMouseEnter={(e) => onHover(e, skill)}
            onMouseLeave={onLeave}
            className={`
                relative h-28 md:h-32 rounded-lg border-2 cursor-pointer transition-all duration-200 overflow-hidden group select-none
                ${isEquipped 
                    ? `${themeStyle.border} bg-gradient-to-br ${themeStyle.bg} to-black shadow-[0_0_20px_rgba(0,0,0,0.5)] scale-[1.02]` 
                    : `${rarityBorder} bg-stone-950/80 hover:bg-stone-900 hover:border-stone-400`
                }
            `}
        >
            {/* Background Icon Watermark */}
            <div className={`absolute -right-4 -bottom-4 text-8xl opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-500`}>
                {themeStyle.icon}
            </div>

            {/* Unique Glow */}
            {isUnique && (
                <div className="absolute inset-0 bg-gradient-to-t from-amber-500/10 to-transparent pointer-events-none"></div>
            )}

            {/* Active Indicator Strip */}
            {isEquipped && (
                <div className="absolute top-0 left-0 w-full h-1 bg-white animate-pulse shadow-[0_0_10px_white]"></div>
            )}

            <div className="p-3 relative z-10 flex flex-col h-full">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/50 border border-stone-700 flex items-center justify-center text-lg shadow-inner">
                        {themeStyle.icon}
                    </div>
                    
                    <div className={`
                        px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border
                        ${isEquipped ? 'bg-green-900/80 border-green-500 text-green-300' : 'bg-black/50 border-stone-800 text-stone-500'}
                    `}>
                        {isEquipped ? 'Active' : 'Passive'}
                    </div>
                </div>

                {/* Info */}
                <div className="mt-auto">
                    <div className={`font-bold diablo-font text-sm md:text-base leading-none mb-1 ${isEquipped ? 'text-white' : isUnique ? 'text-amber-500' : config.text}`}>
                        {skill.name}
                    </div>
                    <div className="flex justify-between items-end">
                        <span className={`text-[10px] uppercase opacity-70 ${themeStyle.text}`}>{skill.theme}</span>
                        {isUnique ? (
                             <span className="text-xs font-mono text-amber-500 font-bold">Unique</span>
                        ) : (
                             <span className={`text-xs font-mono ${config.text}`}>Rank {skill.level}</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Hover Overlay */}
            <div className={`absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${isEquipped ? 'mix-blend-overlay' : ''}`}></div>
        </div>
    );
};

// --- MAIN MODAL COMPONENT ---

const SkillsModal: React.FC<SkillsModalProps> = ({ 
    passiveSkills, 
    activeEffects, 
    equippedSkillIds, 
    buildLoadouts,
    playerStats,
    onEquip, 
    onUnequip,
    onSaveBuild,
    onLoadBuild,
    onRespecAttributes,
    onClose 
}) => {
  const [activeTab, setActiveTab] = useState<'build' | 'effects'>('build');
  const [buildName, setBuildName] = useState('');
  const [hoveredSkill, setHoveredSkill] = useState<{ skill: PassiveSkill, rect: DOMRect } | null>(null);
  
  // Group passives by theme
  const skillsByTheme = passiveSkills.reduce((acc, skill) => {
    if (!acc[skill.theme]) acc[skill.theme] = [];
    acc[skill.theme].push(skill);
    return acc;
  }, {} as Record<PassiveTheme, PassiveSkill[]>);

  const themes = Object.keys(PASSIVE_THEME_COLORS) as PassiveTheme[];
  const equippedSkills = equippedSkillIds.map(id => passiveSkills.find(s => s.id === id)).filter(Boolean) as PassiveSkill[];
  const recommendations = getRecommendedSkills(playerStats, passiveSkills);

  const totalPossibleSkills = PASSIVE_SKILLS_POOL.length;
  const discoveredCount = passiveSkills.length;
  const discoveryPercent = Math.floor((discoveredCount / totalPossibleSkills) * 100);

  const handleHover = (e: React.MouseEvent, skill: PassiveSkill) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setHoveredSkill({ skill, rect });
  };

  return (
    <BaseModal.Container zIndex="z-[60]" maxWidth="max-w-7xl" className="h-[95dvh] md:h-[90vh] shadow-[0_0_100px_rgba(0,0,0,0.8)]">
      {hoveredSkill && <SkillTooltip skill={hoveredSkill.skill} rect={hoveredSkill.rect} nextLevelValue={hoveredSkill.skill.value + hoveredSkill.skill.valuePerLevel} isEquipped={equippedSkillIds.includes(hoveredSkill.skill.id)} />}
      
      <BaseModal.Header 
        title="Grimoire of Power" 
        subtitle="Manage Skills & Loadouts" 
        icon="📜" 
        onClose={onClose} 
      />

      {/* Tabs */}
      <div className="flex border-b border-stone-700 bg-stone-950 shrink-0">
          <button 
              onClick={() => setActiveTab('build')}
              className={`flex-1 py-3 text-xs md:text-sm font-bold uppercase tracking-widest transition-colors ${activeTab === 'build' ? 'bg-[#1c1917] text-amber-500 border-t-2 border-amber-500' : 'text-stone-500 hover:text-stone-300 hover:bg-stone-900'}`}
          >
              Build & Skills
          </button>
          <button 
              onClick={() => setActiveTab('effects')}
              className={`flex-1 py-3 text-xs md:text-sm font-bold uppercase tracking-widest transition-colors ${activeTab === 'effects' ? 'bg-[#1c1917] text-blue-400 border-t-2 border-blue-500' : 'text-stone-500 hover:text-stone-300 hover:bg-stone-900'}`}
          >
              Active Effects ({activeEffects.length})
          </button>
      </div>

      <BaseModal.Body className="bg-[#0c0a09] bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] flex flex-col" noPadding>
            
            {/* BUILD TAB */}
            {activeTab === 'build' && (
                <div className="flex flex-col h-full overflow-hidden">
                    
                    {/* Top Panel: Loadout Deck */}
                    <div className="shrink-0 bg-[#151413] border-b border-stone-800 p-4 md:p-6 shadow-xl z-20">
                         {/* Controls Row */}
                         <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                             <div>
                                <h3 className="text-stone-200 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                                    <span className="text-amber-500">◆</span> Active Loadout <span className="text-stone-500">({equippedSkills.length}/6)</span>
                                </h3>
                             </div>
                             
                             <div className="flex gap-2 w-full md:w-auto">
                                <input 
                                    type="text" 
                                    placeholder="Loadout Name" 
                                    value={buildName}
                                    onChange={(e) => setBuildName(e.target.value)}
                                    className="bg-black/50 border border-stone-700 text-stone-300 px-3 py-1.5 text-xs rounded focus:border-amber-500 outline-none flex-grow md:w-40"
                                />
                                <button 
                                    onClick={() => { if(buildName) { onSaveBuild(buildName); setBuildName(''); } }}
                                    className="px-4 py-1.5 bg-stone-800 hover:bg-stone-700 border border-stone-600 text-xs text-stone-300 rounded uppercase font-bold transition-colors"
                                >
                                    Save
                                </button>
                                {buildLoadouts.length > 0 && (
                                    <select 
                                        onChange={(e) => {
                                            const loadout = buildLoadouts.find(b => b.id === e.target.value);
                                            if (loadout) onLoadBuild(loadout);
                                        }}
                                        className="bg-black/50 border border-stone-700 text-stone-300 px-2 py-1.5 text-xs rounded outline-none"
                                        value=""
                                    >
                                        <option value="" disabled>Load...</option>
                                        {buildLoadouts.map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                )}
                             </div>
                         </div>

                         {/* Skill Slots Grid */}
                         <div className="grid grid-cols-6 gap-2 md:gap-4 h-24 md:h-32">
                             {[0,1,2,3,4,5].map(idx => {
                                 const skill = equippedSkills[idx];
                                 return (
                                     <div 
                                        key={idx}
                                        onClick={() => skill && onUnequip(skill.id)}
                                        onMouseEnter={(e) => skill && handleHover(e, skill)}
                                        onMouseLeave={() => setHoveredSkill(null)}
                                        className={`
                                            relative border rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all group overflow-hidden shadow-inner
                                            ${skill 
                                                ? `${PASSIVE_THEME_COLORS[skill.theme].bg} ${PASSIVE_THEME_COLORS[skill.theme].border} border-opacity-50 hover:border-opacity-100 hover:brightness-110` 
                                                : 'border-stone-800 bg-black/40 border-dashed hover:border-stone-600 hover:bg-black/60'
                                            }
                                        `}
                                     >
                                         {skill ? (
                                             <>
                                                 <div className="text-2xl md:text-3xl filter drop-shadow-[0_0_5px_rgba(0,0,0,1)] group-hover:scale-110 transition-transform duration-300">
                                                     {PASSIVE_THEME_COLORS[skill.theme].icon}
                                                 </div>
                                                 <div className="absolute top-1 right-1 bg-black/60 text-stone-400 text-[9px] px-1.5 rounded font-mono border border-white/5">
                                                     {skill.level}
                                                 </div>
                                                 <div className="absolute bottom-0 w-full bg-black/80 text-center py-1">
                                                     <div className="text-[9px] md:text-[10px] text-stone-200 font-bold truncate px-1">
                                                        {skill.name}
                                                     </div>
                                                 </div>
                                                 
                                                 {/* Active Glow Overlay */}
                                                 <div className="absolute inset-0 bg-white/5 mix-blend-overlay pointer-events-none animate-pulse"></div>
                                                 <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-red-900/40 flex items-center justify-center backdrop-blur-[1px] transition-all z-10">
                                                     <span className="text-[10px] uppercase font-bold text-red-300 border border-red-500 px-2 py-1 rounded bg-black/60">Unequip</span>
                                                 </div>
                                             </>
                                         ) : (
                                             <div className="flex flex-col items-center opacity-30">
                                                 <span className="text-2xl mb-1">◇</span>
                                                 <span className="text-[9px] uppercase font-bold tracking-widest">Empty</span>
                                             </div>
                                         )}
                                     </div>
                                 );
                             })}
                         </div>
                    </div>
                    
                    {/* Middle: Stats Bar */}
                    <div className="shrink-0 px-6 py-3 bg-stone-900/80 border-b border-stone-800 flex justify-between items-center backdrop-blur-sm z-10">
                         <div className="flex items-center gap-6 overflow-x-auto">
                            <div className="flex flex-col">
                                <span className="text-[9px] text-stone-500 uppercase">Discovery</span>
                                <div className="w-24 h-1.5 bg-stone-800 rounded-full mt-1 overflow-hidden">
                                    <div className="h-full bg-purple-500" style={{ width: `${discoveryPercent}%` }}></div>
                                </div>
                            </div>

                            {recommendations.length > 0 && (
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-amber-500 text-[10px] font-bold uppercase tracking-widest">Recommended:</span>
                                    {recommendations.map(rec => (
                                        <div key={rec.id} className="text-[10px] text-stone-300 bg-black/40 px-2 py-0.5 rounded border border-stone-700 flex items-center gap-1">
                                            <span>{PASSIVE_THEME_COLORS[rec.theme].icon}</span>
                                            <span>{rec.name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                         </div>

                         <button 
                            onClick={() => {
                                if (confirm("Reset attributes for gold? Skills will remain learned.")) onRespecAttributes();
                            }}
                            className="text-[10px] text-red-400 border border-red-900/50 hover:bg-red-950/50 hover:border-red-500 px-3 py-1.5 rounded uppercase font-bold transition-colors shrink-0"
                        >
                            Reset Attributes
                        </button>
                    </div>

                    {/* Bottom: Skill Collection (Scrollable) */}
                    <div className="flex-grow overflow-y-auto p-4 md:p-6 custom-scrollbar bg-black/20">
                        {passiveSkills.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full opacity-50">
                                <span className="text-6xl mb-4 grayscale">📜</span>
                                <p className="text-stone-400 font-serif italic">Your grimoire is empty. Level up to learn skills.</p>
                            </div>
                        ) : (
                            themes.map(theme => {
                                const themeSkills = skillsByTheme[theme] || [];
                                if (themeSkills.length === 0) return null;

                                const style = PASSIVE_THEME_COLORS[theme];
                                const setBonus = PASSIVE_SET_BONUSES.find(s => s.theme === theme);
                                
                                // Set Bonus Logic
                                const equippedThemeSkills = equippedSkills.filter(s => s.theme === theme);
                                const uniqueCount = new Set(equippedThemeSkills.map(s => s.id)).size;
                                const reqCount = setBonus?.requiredCount || 3;
                                const isSetComplete = uniqueCount >= reqCount;

                                return (
                                    <div key={theme} className="mb-8">
                                        {/* Theme Header */}
                                        <div className="flex items-center gap-3 mb-3 border-b border-stone-800 pb-2">
                                            <span className="text-2xl filter drop-shadow">{style.icon}</span>
                                            <h3 className={`text-xl diablo-font font-bold ${style.text}`}>{theme}</h3>
                                            
                                            {/* Set Bonus Progress Bar */}
                                            {setBonus && (
                                                <div className="ml-auto flex flex-col items-end">
                                                     <div className="flex items-center gap-1 mb-0.5">
                                                        <span className={`text-[10px] uppercase font-bold ${isSetComplete ? 'text-amber-400' : 'text-stone-500'}`}>
                                                            {isSetComplete ? 'Set Bonus Active' : 'Set Bonus'}
                                                        </span>
                                                     </div>
                                                     <div className="flex gap-1">
                                                         {Array.from({length: reqCount}).map((_, i) => (
                                                             <div 
                                                                key={i} 
                                                                className={`w-4 h-1.5 rounded-sm ${i < uniqueCount ? style.bg.replace('/50', '') + ' ' + style.border : 'bg-stone-800'}`}
                                                             ></div>
                                                         ))}
                                                     </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Grid */}
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                            {themeSkills.map(skill => {
                                                const isEquipped = equippedSkillIds.includes(skill.id);
                                                return (
                                                    <SkillCard 
                                                        key={skill.id}
                                                        skill={skill}
                                                        isEquipped={isEquipped}
                                                        onClick={() => isEquipped ? onUnequip(skill.id) : onEquip(skill.id)}
                                                        onHover={handleHover}
                                                        onLeave={() => setHoveredSkill(null)}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* ACTIVE EFFECTS TAB */}
            {activeTab === 'effects' && (
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto">
                    {activeEffects.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 text-stone-500 opacity-60">
                            <span className="text-5xl mb-4">✨</span>
                            <p className="font-serif italic">No active magical effects currently affecting you.</p>
                        </div>
                    )}

                    {activeEffects.map(effect => (
                        <div 
                            key={effect.id} 
                            className={`
                                p-4 rounded border relative overflow-hidden h-fit transition-all hover:scale-[1.02]
                                ${effect.isDebuff 
                                    ? 'bg-red-950/20 border-red-800 hover:bg-red-950/30' 
                                    : 'bg-blue-950/20 border-blue-800 hover:bg-blue-950/30'
                                }
                            `}
                        >
                            <div className="flex items-start gap-4 relative z-10">
                                <div className={`text-4xl p-2 rounded-lg bg-black/40 border border-white/5 ${effect.isDebuff ? 'grayscale' : ''}`}>
                                    {effect.icon}
                                </div>
                                <div className="flex-grow">
                                    <div className="flex justify-between items-start">
                                        <h3 className={`font-bold text-lg leading-none mb-1 ${effect.isDebuff ? 'text-red-400' : 'text-blue-300'}`}>
                                            {effect.name}
                                        </h3>
                                        <span className={`text-[10px] uppercase font-bold px-1.5 rounded bg-black/50 ${effect.isDebuff ? 'text-red-500' : 'text-blue-500'}`}>
                                            {effect.isDebuff ? 'Malediction' : 'Blessing'}
                                        </span>
                                    </div>
                                    <p className="text-stone-400 text-xs mb-3 leading-relaxed">{effect.description}</p>
                                    
                                    <div className="w-full bg-black/50 h-1.5 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full ${effect.isDebuff ? 'bg-red-600' : 'bg-blue-500'}`} 
                                            style={{ width: `${Math.min(100, (effect.duration / 5) * 100)}%` }} // Visual approximation
                                        ></div>
                                    </div>
                                    <div className="text-[10px] text-stone-500 text-right mt-1 font-mono">
                                        {effect.duration} Battles Remaining
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
      </BaseModal.Body>
    </BaseModal.Container>
  );
};

export default SkillsModal;
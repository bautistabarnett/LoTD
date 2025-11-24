import React, { useState } from 'react';
import { PassiveSkill, ActiveEffect, PassiveTheme } from '../types';
import { PASSIVE_THEME_COLORS, PASSIVE_SET_BONUSES } from '../constants';
import { BaseModal } from './BaseModal';

interface SkillsModalProps {
  passiveSkills: PassiveSkill[];
  activeEffects: ActiveEffect[];
  onClose: () => void;
}

const SkillsModal: React.FC<SkillsModalProps> = ({ passiveSkills, activeEffects, onClose }) => {
  const [activeTab, setActiveTab] = useState<'passives' | 'effects'>('passives');

  // Group passives by theme
  const skillsByTheme = passiveSkills.reduce((acc, skill) => {
    if (!acc[skill.theme]) acc[skill.theme] = [];
    acc[skill.theme].push(skill);
    return acc;
  }, {} as Record<PassiveTheme, PassiveSkill[]>);

  const themes = Object.keys(PASSIVE_THEME_COLORS) as PassiveTheme[];

  return (
    <BaseModal.Container zIndex="z-[60]" maxWidth="max-w-6xl" className="h-[90dvh] md:h-[85vh]">
      <BaseModal.Header 
        title="Skill Mastery" 
        subtitle="Knowledge is Power" 
        icon="📜" 
        onClose={onClose} 
      />

      {/* Tabs moved to a dedicated container before body */}
      <div className="flex border-b border-stone-700 bg-stone-950 shrink-0">
          <button 
              onClick={() => setActiveTab('passives')}
              className={`flex-1 py-3 md:py-4 text-xs md:text-sm font-bold uppercase tracking-widest transition-colors ${activeTab === 'passives' ? 'bg-[#1c1917] text-amber-500 border-t-2 border-amber-500' : 'text-stone-500 hover:text-stone-300 hover:bg-stone-900'}`}
          >
              Passives ({passiveSkills.length})
          </button>
          <button 
              onClick={() => setActiveTab('effects')}
              className={`flex-1 py-3 md:py-4 text-xs md:text-sm font-bold uppercase tracking-widest transition-colors ${activeTab === 'effects' ? 'bg-[#1c1917] text-blue-400 border-t-2 border-blue-500' : 'text-stone-500 hover:text-stone-300 hover:bg-stone-900'}`}
          >
              Effects ({activeEffects.length})
          </button>
      </div>

      <BaseModal.Body className="bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] bg-[#1c1917]">
            {/* PASSIVES TAB */}
            {activeTab === 'passives' && (
                <div className="space-y-4 md:space-y-8">
                    {passiveSkills.length === 0 && (
                        <div className="text-center py-20 text-stone-500 italic">
                            You have not yet unlocked any passive skills. Level up to acquire knowledge.
                        </div>
                    )}

                    {themes.map(theme => {
                        const themeSkills = skillsByTheme[theme] || [];
                        const style = PASSIVE_THEME_COLORS[theme];
                        const totalLevels = themeSkills.reduce((sum, s) => sum + s.level, 0);
                        
                        // Set Bonus Logic
                        const setBonus = PASSIVE_SET_BONUSES.find(s => s.theme === theme);
                        const uniqueSkillsAcquired = new Set(themeSkills.map(s => s.id)).size;
                        const isSetComplete = uniqueSkillsAcquired >= (setBonus?.requiredCount || 999);
                        const progressPercent = Math.min(100, (uniqueSkillsAcquired / (setBonus?.requiredCount || 3)) * 100);

                        return (
                            <div key={theme} className={`border border-stone-700 bg-black/40 rounded-lg overflow-hidden`}>
                                {/* Theme Header */}
                                <div className={`p-2 md:p-3 border-b border-stone-800 ${style.bg} flex justify-between items-center`}>
                                    <div className="flex items-center gap-2 md:gap-3">
                                        <span className="text-xl md:text-2xl">{style.icon}</span>
                                        <h3 className={`text-base md:text-xl diablo-font font-bold ${style.text}`}>{theme}</h3>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-[10px] md:text-xs font-mono text-stone-400 bg-black/50 px-2 py-1 rounded border border-stone-700">
                                            Rank: <span className="text-white font-bold">{totalLevels}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Set Bonus Progress Section */}
                                <div className="bg-stone-950/50 border-b border-stone-800 p-3 md:p-4 flex flex-col md:flex-row items-center gap-4 md:gap-6">
                                     <div className="flex-1 w-full">
                                         <div className="flex justify-between text-[10px] md:text-xs uppercase font-bold text-stone-500 mb-1">
                                             <span>Set Progress</span>
                                             <span className={isSetComplete ? 'text-green-400' : 'text-stone-400'}>
                                                 {uniqueSkillsAcquired} / {setBonus?.requiredCount} Skills
                                             </span>
                                         </div>
                                         <div className="h-2 w-full bg-stone-900 rounded-full overflow-hidden border border-stone-700">
                                             <div 
                                                className={`h-full transition-all duration-500 ${isSetComplete ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-stone-600'}`}
                                                style={{ width: `${progressPercent}%` }}
                                             ></div>
                                         </div>
                                     </div>
                                     
                                     <div className={`flex-1 w-full border p-3 rounded flex items-center gap-3 relative overflow-hidden ${isSetComplete ? `border-amber-600 bg-amber-950/20` : 'border-stone-800 bg-stone-900/20 opacity-60'}`}>
                                         {isSetComplete && <div className="absolute inset-0 bg-amber-500/5 animate-pulse"></div>}
                                         <div className="text-2xl">{isSetComplete ? '🏆' : '🔒'}</div>
                                         <div className="overflow-hidden">
                                             <h4 className={`text-xs md:text-sm font-bold uppercase truncate ${isSetComplete ? 'text-amber-400' : 'text-stone-500'}`}>
                                                 Bonus: {setBonus?.name || 'Unknown'}
                                             </h4>
                                             <p className="text-[10px] md:text-xs text-stone-400 italic truncate">{setBonus?.description}</p>
                                         </div>
                                     </div>
                                </div>

                                {/* Skills Grid */}
                                <div className="p-3 md:p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                                    {themeSkills.map(skill => (
                                        <div key={skill.id} className="bg-stone-900/50 border border-stone-800 p-3 rounded hover:border-stone-600 transition-colors relative group">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className={`font-bold text-sm ${style.text}`}>{skill.name}</span>
                                                <span className="text-[10px] bg-stone-950 px-1.5 py-0.5 rounded text-stone-400 border border-stone-800">
                                                    Lvl {skill.level}
                                                </span>
                                            </div>
                                            <p className="text-stone-400 text-xs mb-3 h-auto md:h-10">
                                                {skill.description.replace('{value}', skill.value.toString())}
                                            </p>
                                            {skill.flavorText && (
                                                <p className="text-[10px] italic text-stone-600 border-t border-stone-800 pt-2">
                                                    "{skill.flavorText}"
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* EFFECTS TAB */}
            {activeTab === 'effects' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeEffects.length === 0 && (
                        <div className="col-span-full text-center py-20 text-stone-500 italic">
                            No active magical effects currently affecting you.
                        </div>
                    )}

                    {activeEffects.map(effect => (
                        <div 
                            key={effect.id} 
                            className={`
                                p-4 rounded border-l-4 shadow-lg relative overflow-hidden
                                ${effect.isDebuff 
                                    ? 'bg-red-950/20 border-red-600' 
                                    : 'bg-blue-950/20 border-blue-500'
                                }
                            `}
                        >
                            <div className="flex items-start gap-4 relative z-10">
                                <div className="text-4xl filter drop-shadow-md">{effect.icon}</div>
                                <div className="flex-grow">
                                    <h3 className={`font-bold text-lg ${effect.isDebuff ? 'text-red-400' : 'text-blue-300'}`}>
                                        {effect.name}
                                    </h3>
                                    <p className="text-stone-400 text-sm mb-2">{effect.description}</p>
                                    
                                    <div className="flex items-center gap-2 text-xs font-mono bg-black/30 p-1 rounded w-fit">
                                        <span className="text-stone-500 uppercase">Duration:</span>
                                        <span className={effect.isDebuff ? 'text-red-300' : 'text-blue-200'}>
                                            {effect.duration} Battles
                                        </span>
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

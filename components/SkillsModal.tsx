


import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PassiveSkill, ActiveEffect, PassiveTheme, BuildLoadout, PlayerStats, ProcTrigger, Rarity } from '../types';
import { PASSIVE_THEME_COLORS, PASSIVE_SET_BONUSES, COMPOSITE_SYNERGIES, PASSIVE_SKILLS_POOL } from '../constants';
import { BaseModal } from './BaseModal';

interface SkillsModalProps {
  passiveSkills: PassiveSkill[];
  activeEffects: ActiveEffect[];
  equippedSkillIds: string[];
  buildLoadouts: BuildLoadout[];
  playerStats: PlayerStats;
  onEquip: (skillId: string) => void;
  onUnequip: (skillId: string) => void;
  onUnlockTreeSkill: (skillId: string) => void;
  onSaveBuild: (name: string) => void;
  onLoadBuild: (loadout: BuildLoadout) => void;
  onRespecAttributes: () => void;
  onClose: () => void;
}

// --- VISUAL CONSTANTS ---
const TIER_ROW_HEIGHT = 160;
const NODE_WIDTH = 64;
const NODE_HEIGHT = 64;
const TREE_CANVAS_WIDTH = 800;
const CANVAS_CENTER_OFFSET = 100;

// Branch Definitions for the Sidebar
const BRANCHES = [
    { id: 'offense', label: 'Offense', themes: [PassiveTheme.PYROMANCY, PassiveTheme.WARFARE], icon: '⚔️' },
    { id: 'defense', label: 'Defense', themes: [PassiveTheme.SENTINEL, PassiveTheme.CRYOMANCY], icon: '🛡️' },
    { id: 'utility', label: 'Utility', themes: [PassiveTheme.FORTUNE, PassiveTheme.NATURE], icon: '🌿' },
    { id: 'control', label: 'Control', themes: [PassiveTheme.SHADOW, PassiveTheme.ARCANE], icon: '🔮' },
    { id: 'exploration', label: 'Exploration', themes: [PassiveTheme.SCOUTING], icon: '🗺️' }
];

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

// --- TOOLTIP COMPONENT ---

const SkillTooltip = ({ 
    skill, 
    rect, 
    nextLevelValue, 
    currentLevel,
    isEquipped, 
    isLocked,
    canUnlock,
    cost,
    onMouseEnter, 
    onMouseLeave 
}: { 
    skill: Omit<PassiveSkill, 'level' | 'value'>, 
    rect: DOMRect, 
    nextLevelValue: number, 
    currentLevel: number,
    isEquipped: boolean,
    isLocked: boolean,
    canUnlock: boolean,
    cost: number,
    onMouseEnter: () => void,
    onMouseLeave: () => void
}) => {
    const themeStyle = PASSIVE_THEME_COLORS[skill.theme];
    const top = rect.bottom + 10 > window.innerHeight - 300 ? rect.top - 10 : rect.bottom + 10;
    const left = Math.min(Math.max(10, rect.left - 50), window.innerWidth - 340);
    const transform = rect.bottom + 10 > window.innerHeight - 300 ? 'translateY(-100%)' : 'translateY(0)';

    return createPortal(
        <div 
            className="fixed z-[9999] w-[300px] pointer-events-auto animate-in fade-in zoom-in-95 duration-150"
            style={{ top, left, transform }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <div className={`bg-[#151413] border-2 ${isLocked ? 'border-stone-700' : themeStyle.border} shadow-[0_0_50px_rgba(0,0,0,0.9)] rounded-sm overflow-hidden`}>
                <div className="p-3 bg-gradient-to-r from-stone-950 to-stone-900 border-b border-stone-800">
                     <h3 className={`font-bold diablo-font text-lg ${skill.rarity === Rarity.UNIQUE ? 'text-amber-500' : 'text-stone-200'} leading-none`}>{skill.name}</h3>
                     <div className="flex justify-between items-center mt-1">
                        <span className={`text-[10px] uppercase tracking-wider font-bold ${themeStyle.text}`}>{skill.theme}</span>
                        <span className="text-[10px] text-stone-500">Tier {skill.tier}</span>
                     </div>
                </div>

                <div className="p-3 bg-stone-950/95 text-sm text-stone-300">
                    <p className="mb-2 italic">{skill.description.replace('{value}', `[${skill.baseValue + ((currentLevel || 1) - 1) * skill.valuePerLevel}]`)}</p>
                    
                    {skill.proc && (
                         <div className="bg-black/40 border border-stone-800 rounded p-2 text-[10px] mb-2">
                             <span className="text-amber-500 font-bold">Effect:</span> {skill.proc.description}
                         </div>
                    )}

                    <div className="flex justify-between items-center border-t border-stone-800 pt-2 mt-2">
                         <div className="flex flex-col">
                             <span className="text-[10px] text-stone-500 uppercase">Rank</span>
                             <span className="text-white font-mono">{currentLevel}/{skill.maxRank || 10}</span>
                         </div>
                         {canUnlock && currentLevel < (skill.maxRank || 10) ? (
                             <div className="text-right">
                                 <div className="text-[10px] text-stone-500 uppercase">Cost</div>
                                 <div className="text-amber-500 font-bold">{cost} SP</div>
                             </div>
                         ) : currentLevel >= (skill.maxRank || 10) ? (
                             <span className="text-amber-500 text-xs font-bold uppercase border border-amber-900/50 px-2 py-1 rounded">Max Rank</span>
                         ) : (
                             <span className="text-red-500 text-xs font-bold uppercase">Locked</span>
                         )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

// --- TREE NODE COMPONENT ---

const TreeNode = ({ 
    node, 
    learnedSkill, 
    isActive, 
    isLocked,
    canAfford,
    onClick,
    onHover,
    onLeave
}: { 
    node: Omit<PassiveSkill, 'level' | 'value'>, 
    learnedSkill?: PassiveSkill,
    isActive: boolean,
    isLocked: boolean,
    canAfford: boolean,
    onClick: () => void,
    onHover: (e: React.MouseEvent, s: any) => void,
    onLeave: () => void
}) => {
    const themeStyle = PASSIVE_THEME_COLORS[node.theme];
    const level = learnedSkill ? learnedSkill.level : 0;
    const maxRank = node.maxRank || 10;
    const isMaxed = level >= maxRank;

    let borderClass = 'border-stone-700';
    let bgClass = 'bg-stone-900';
    let iconClass = 'grayscale opacity-50 text-stone-500';

    if (!isLocked) {
        borderClass = isActive ? 'border-green-500' : themeStyle.border;
        bgClass = isActive ? 'bg-green-950/30' : 'bg-stone-800';
        iconClass = isActive ? 'text-green-400' : themeStyle.text;
        
        if (isMaxed) {
             borderClass = 'border-amber-500';
             iconClass = 'text-amber-400';
        }
    } else if (!isLocked && canAfford) {
        // Unlockable
        borderClass = 'border-white animate-pulse';
        iconClass = 'text-white';
    }

    // Coordinates logic: (treeX) * 120 + offset
    const leftPos = (node.treeX || 0) * 120 + CANVAS_CENTER_OFFSET;

    return (
        <div 
            className="absolute flex flex-col items-center"
            style={{ 
                left: `${leftPos}px`, 
                top: `${(node.tier - 1) * TIER_ROW_HEIGHT + 40}px`,
                width: NODE_WIDTH,
            }}
        >
            <button
                onClick={onClick}
                onMouseEnter={(e) => onHover(e, node)}
                onMouseLeave={onLeave}
                className={`
                    w-16 h-16 rounded-md border-2 flex items-center justify-center relative shadow-lg transition-all duration-200 z-10
                    ${borderClass} ${bgClass}
                    ${!isLocked ? 'hover:scale-110 cursor-pointer' : 'cursor-not-allowed'}
                `}
            >
                <span className={`text-2xl filter drop-shadow-md ${iconClass}`}>{themeStyle.icon}</span>
                
                {/* Level Badge */}
                <div className="absolute -bottom-2 -right-2 bg-black text-[10px] font-mono border border-stone-700 px-1 rounded text-stone-300 z-20">
                    {level}/{maxRank}
                </div>
                
                {/* Active Indicator */}
                {isActive && (
                    <div className="absolute -top-1 -left-1 w-3 h-3 bg-green-500 rounded-full shadow-[0_0_5px_lime] animate-pulse"></div>
                )}
            </button>
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
    onUnlockTreeSkill,
    onSaveBuild,
    onLoadBuild,
    onRespecAttributes,
    onClose 
}) => {
  const [activeTab, setActiveTab] = useState<'tree' | 'effects'>('tree');
  const [selectedBranchId, setSelectedBranchId] = useState('offense');
  const [hoveredNode, setHoveredNode] = useState<{ node: any, rect: DOMRect } | null>(null);

  // Filter skills for current branch
  const currentBranch = BRANCHES.find(b => b.id === selectedBranchId)!;
  const treeNodes = PASSIVE_SKILLS_POOL.filter(s => currentBranch.themes.includes(s.theme));

  // Determine Connections for SVG
  const connections = treeNodes.map(node => {
      if (!node.prerequisiteId) return null;
      const parent = treeNodes.find(p => p.id === node.prerequisiteId);
      if (!parent) return null;
      
      return {
          fromX: (parent.treeX || 0) * 120 + CANVAS_CENTER_OFFSET + 32, // +32 center of node
          fromY: (parent.tier - 1) * TIER_ROW_HEIGHT + 40 + 64, // bottom of node
          toX: (node.treeX || 0) * 120 + CANVAS_CENTER_OFFSET + 32,
          toY: (node.tier - 1) * TIER_ROW_HEIGHT + 40, // top of node
          isUnlocked: passiveSkills.some(s => s.id === parent.id)
      };
  }).filter(Boolean);

  const handleNodeClick = (nodeId: string) => {
      const learned = passiveSkills.find(s => s.id === nodeId);
      const poolNode = treeNodes.find(n => n.id === nodeId);
      
      if (learned && learned.level < (poolNode?.maxRank || 10) && playerStats.skillPoints > 0) {
           onUnlockTreeSkill(nodeId);
      } else if (learned) {
           if (equippedSkillIds.includes(nodeId)) onUnequip(nodeId);
           else onEquip(nodeId);
      } else {
           // Try to learn
           onUnlockTreeSkill(nodeId);
      }
  };

  const isNodeLocked = (nodeId: string, prerequisiteId?: string) => {
      const learned = passiveSkills.some(s => s.id === nodeId);
      if (learned) return false;
      if (!prerequisiteId) return false; // Tier 1 usually
      return !passiveSkills.some(s => s.id === prerequisiteId);
  };

  return (
    <BaseModal.Container zIndex="z-[60]" maxWidth="max-w-7xl" className="h-[95dvh] md:h-[90vh] shadow-[0_0_100px_rgba(0,0,0,0.8)]">
      {hoveredNode && (
          <SkillTooltip 
              skill={hoveredNode.node} 
              rect={hoveredNode.rect} 
              currentLevel={passiveSkills.find(s => s.id === hoveredNode.node.id)?.level || 0}
              nextLevelValue={hoveredNode.node.baseValue} // Simplified for tooltip
              isEquipped={equippedSkillIds.includes(hoveredNode.node.id)} 
              isLocked={isNodeLocked(hoveredNode.node.id, hoveredNode.node.prerequisiteId)}
              canUnlock={playerStats.skillPoints > 0 && !isNodeLocked(hoveredNode.node.id, hoveredNode.node.prerequisiteId)}
              cost={1}
              onMouseEnter={() => {}}
              onMouseLeave={() => setHoveredNode(null)}
          />
      )}
      
      <BaseModal.Header 
        title="Skill Tree" 
        subtitle={`Points Available: ${playerStats.skillPoints}`} 
        icon="📜" 
        onClose={onClose} 
      />

      {/* Tabs */}
      <div className="flex border-b border-stone-700 bg-stone-950 shrink-0">
          <button 
              onClick={() => setActiveTab('tree')}
              className={`flex-1 py-3 text-xs md:text-sm font-bold uppercase tracking-widest transition-colors ${activeTab === 'tree' ? 'bg-[#1c1917] text-amber-500 border-t-2 border-amber-500' : 'text-stone-500 hover:text-stone-300 hover:bg-stone-900'}`}
          >
              Skill Trees
          </button>
          <button 
              onClick={() => setActiveTab('effects')}
              className={`flex-1 py-3 text-xs md:text-sm font-bold uppercase tracking-widest transition-colors ${activeTab === 'effects' ? 'bg-[#1c1917] text-blue-400 border-t-2 border-blue-500' : 'text-stone-500 hover:text-stone-300 hover:bg-stone-900'}`}
          >
              Active Effects ({activeEffects.length})
          </button>
      </div>

      <BaseModal.Body className="bg-[#0c0a09] bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] flex flex-col relative" noPadding>
            
            {/* TREE TAB */}
            {activeTab === 'tree' && (
                <div className="flex flex-col md:flex-row h-full">
                    
                    {/* Sidebar Branch Selector */}
                    <div className="w-full md:w-64 bg-stone-950 border-r border-stone-800 flex flex-row md:flex-col overflow-x-auto md:overflow-visible shrink-0 z-20">
                        {BRANCHES.map(branch => (
                            <button
                                key={branch.id}
                                onClick={() => setSelectedBranchId(branch.id)}
                                className={`
                                    flex items-center gap-3 px-6 py-4 border-b border-stone-800 transition-colors whitespace-nowrap
                                    ${selectedBranchId === branch.id ? 'bg-stone-900 text-amber-500 border-l-4 border-l-amber-500' : 'text-stone-500 hover:text-stone-300 hover:bg-stone-900'}
                                `}
                            >
                                <span className="text-xl">{branch.icon}</span>
                                <span className="font-bold uppercase tracking-wider text-xs md:text-sm">{branch.label}</span>
                            </button>
                        ))}
                        
                        <div className="mt-auto p-4 hidden md:block">
                            <div className="bg-stone-900 border border-stone-800 p-3 rounded text-center">
                                <div className="text-[10px] uppercase text-stone-500 mb-1">Skill Points</div>
                                <div className="text-3xl text-amber-500 font-bold diablo-font">{playerStats.skillPoints}</div>
                            </div>
                        </div>
                    </div>

                    {/* Tree Visualization Area */}
                    <div className="flex-grow relative overflow-auto custom-scrollbar bg-black/20 min-h-[500px]">
                         {/* Background Grid */}
                         <div className="absolute inset-0 w-[1200px] h-[1000px] bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:20px_20px] opacity-10 pointer-events-none"></div>

                         <div className="relative w-[1200px] h-[1000px] p-10">
                              
                              {/* Connector Lines Layer */}
                              <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                                  {connections.map((conn: any, i) => (
                                      <path 
                                        key={i} 
                                        d={`M${conn.fromX},${conn.fromY} C${conn.fromX},${conn.fromY + 40} ${conn.toX},${conn.toY - 40} ${conn.toX},${conn.toY}`} 
                                        stroke={conn.isUnlocked ? '#d97706' : '#44403c'} 
                                        strokeWidth="2" 
                                        fill="none" 
                                        strokeDasharray={conn.isUnlocked ? "0" : "5 5"}
                                      />
                                  ))}
                              </svg>

                              {/* Nodes */}
                              {treeNodes.map(node => {
                                  const learned = passiveSkills.find(s => s.id === node.id);
                                  const locked = isNodeLocked(node.id, node.prerequisiteId);
                                  const equipped = equippedSkillIds.includes(node.id);
                                  
                                  return (
                                      <TreeNode 
                                          key={node.id}
                                          node={node}
                                          learnedSkill={learned}
                                          isActive={equipped}
                                          isLocked={locked}
                                          canAfford={playerStats.skillPoints > 0}
                                          onClick={() => handleNodeClick(node.id)}
                                          onHover={(e, n) => setHoveredNode({ node: n, rect: e.currentTarget.getBoundingClientRect() })}
                                          onLeave={() => setHoveredNode(null)}
                                      />
                                  );
                              })}

                              {/* TIER LABELS */}
                              {[1, 2, 3, 4].map(tier => (
                                  <div 
                                    key={tier} 
                                    className="absolute left-2 text-stone-600 font-bold uppercase text-[10px] tracking-widest border-b border-stone-800 w-full"
                                    style={{ top: (tier - 1) * TIER_ROW_HEIGHT + 20 }}
                                  >
                                      Tier {tier}
                                  </div>
                              ))}
                         </div>
                    </div>
                    
                    {/* Mobile Skill Points Display */}
                    <div className="md:hidden absolute bottom-4 right-4 bg-stone-900 border border-amber-500/50 p-2 rounded-full shadow-lg z-30 flex items-center justify-center w-12 h-12">
                        <span className="text-amber-500 font-bold">{playerStats.skillPoints}</span>
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

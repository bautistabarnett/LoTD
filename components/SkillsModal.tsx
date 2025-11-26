
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PassiveSkill, ActiveEffect, PassiveTheme, BuildLoadout, PlayerStats, ProcTrigger, Rarity } from '../types';
import { PASSIVE_THEME_COLORS, PASSIVE_SKILLS_POOL } from '../constants';
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
const TREE_CANVAS_WIDTH = 800;
const CANVAS_CENTER_OFFSET = 0; // Centered dynamically

// Branch Definitions
const BRANCHES = [
    { id: 'offense', label: 'Offense', themes: [PassiveTheme.PYROMANCY, PassiveTheme.WARFARE], icon: '⚔️' },
    { id: 'defense', label: 'Defense', themes: [PassiveTheme.SENTINEL, PassiveTheme.CRYOMANCY], icon: '🛡️' },
    { id: 'utility', label: 'Utility', themes: [PassiveTheme.FORTUNE, PassiveTheme.NATURE], icon: '🌿' },
    { id: 'control', label: 'Control', themes: [PassiveTheme.SHADOW, PassiveTheme.ARCANE], icon: '🔮' },
    { id: 'exploration', label: 'Exploration', themes: [PassiveTheme.SCOUTING], icon: '🗺️' }
];

// --- DETAILS PANEL COMPONENT (Replaces Tooltip) ---
const SkillDetailsPanel = ({
    skill,
    learnedSkill,
    isEquipped,
    isLocked,
    canAfford,
    cost,
    onAction,
    onClose
}: {
    skill: any;
    learnedSkill?: PassiveSkill;
    isEquipped: boolean;
    isLocked: boolean;
    canAfford: boolean;
    cost: number;
    onAction: () => void;
    onClose: () => void;
}) => {
    const themeStyle = PASSIVE_THEME_COLORS[skill.theme];
    const currentLevel = learnedSkill ? learnedSkill.level : 0;
    const maxRank = skill.maxRank || 10;
    const isMaxed = currentLevel >= maxRank;

    let actionLabel = "Unlock";
    let actionColor = "bg-amber-600 hover:bg-amber-500 text-white";
    let isDisabled = false;

    if (isLocked) {
        actionLabel = "Locked";
        actionColor = "bg-stone-800 text-stone-500 border-stone-700";
        isDisabled = true;
    } else if (learnedSkill) {
        if (!isMaxed && canAfford) {
            actionLabel = `Upgrade (${cost} SP)`;
            actionColor = "bg-green-700 hover:bg-green-600 text-white border-green-500";
        } else if (isMaxed) {
             if (isEquipped) {
                 actionLabel = "Unequip";
                 actionColor = "bg-red-900/50 hover:bg-red-800 border-red-700 text-red-200";
             } else {
                 actionLabel = "Equip";
                 actionColor = "bg-stone-700 hover:bg-stone-600 border-stone-500 text-stone-200";
             }
        } else {
             // Not maxed, but can't afford
             actionLabel = "Not Enough Points";
             actionColor = "bg-stone-800 text-stone-500";
             isDisabled = true;
        }
        // Hybrid state: Can upgrade OR Equip. Prioritize Equip toggle if maxed, or show Upgrade button primarily?
        // Logic fix: Allow equipping even if not maxed. 
        // We need TWO buttons if learned: Equip/Unequip AND Upgrade.
    } else if (!canAfford) {
        actionLabel = "Not Enough Points";
        actionColor = "bg-stone-800 text-stone-500";
        isDisabled = true;
    }

    return (
        <div className="absolute bottom-0 left-0 w-full bg-[#151413] border-t-2 border-amber-600 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] z-50 animate-in slide-in-from-bottom duration-300 pb-safe">
            <div className="flex flex-col md:flex-row max-w-5xl mx-auto">
                {/* Header Section */}
                <div className={`p-4 md:p-6 bg-gradient-to-r ${themeStyle.bg} to-transparent md:w-1/3 flex flex-col justify-center relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-8xl pointer-events-none">{themeStyle.icon}</div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start">
                             <h3 className={`font-bold diablo-font text-xl md:text-2xl ${skill.rarity === Rarity.UNIQUE ? 'text-amber-500' : 'text-stone-200'} leading-none mb-2`}>{skill.name}</h3>
                             <button onClick={onClose} className="md:hidden text-stone-400 p-2 -mr-2 -mt-2">✕</button>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-black/40 border border-white/10 ${themeStyle.text}`}>{skill.theme}</span>
                            <span className="text-[10px] text-stone-400 uppercase">Tier {skill.tier}</span>
                        </div>
                    </div>
                </div>

                {/* Content Section */}
                <div className="p-4 md:p-6 flex-grow bg-stone-900/80 md:w-2/3 flex flex-col gap-4">
                    <div className="text-sm text-stone-300 leading-relaxed italic">
                        {skill.description.replace('{value}', `[${skill.baseValue + ((currentLevel || 1) - 1) * skill.valuePerLevel}]`)}
                    </div>
                    
                    {skill.proc && (
                         <div className="bg-black/40 border border-stone-800 rounded p-2 text-xs flex gap-2 items-start">
                             <span className="text-amber-500 font-bold shrink-0">Effect:</span> 
                             <span className="text-stone-400">{skill.proc.description}</span>
                         </div>
                    )}

                    <div className="flex items-center gap-4 mt-auto">
                         <div className="flex flex-col border-r border-stone-700 pr-4">
                             <span className="text-[10px] text-stone-500 uppercase font-bold">Rank</span>
                             <span className="text-white font-mono text-lg">{currentLevel}/{maxRank}</span>
                         </div>
                         
                         <div className="flex-grow flex gap-2 justify-end">
                             {/* Separate Equip/Unequip Logic from Upgrade */}
                             {learnedSkill && (
                                 <button 
                                    onClick={() => isEquipped ? onAction() : onAction()} // This needs to be passed correctly
                                    className={`px-4 py-3 font-bold uppercase tracking-widest text-xs rounded border transition-all ${isEquipped ? 'bg-red-900/20 border-red-800 text-red-400 hover:bg-red-900/40' : 'bg-stone-800 border-stone-600 text-stone-300 hover:bg-stone-700'}`}
                                 >
                                     {isEquipped ? 'Unequip' : 'Equip'}
                                 </button>
                             )}

                             {(!isMaxed) && (
                                 <button
                                     onClick={onAction}
                                     disabled={isDisabled}
                                     className={`flex-grow md:flex-grow-0 px-6 py-3 font-bold uppercase tracking-widest text-xs rounded border transition-all shadow-lg active:scale-95 ${isDisabled ? 'bg-stone-800 border-stone-700 text-stone-600 cursor-not-allowed' : 'bg-amber-700 border-amber-600 text-white hover:bg-amber-600'}`}
                                 >
                                     {learnedSkill ? `Upgrade (${cost} SP)` : `Unlock (${cost} SP)`}
                                 </button>
                             )}
                             
                             {isMaxed && !learnedSkill && ( /* Should not happen logic wise but fallback */
                                 <div className="text-amber-500 font-bold text-sm uppercase px-4 py-2 border border-amber-900 bg-amber-950/30 rounded">Maxed</div>
                             )}
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- TREE NODE ---
const TreeNode = ({ 
    node, 
    learnedSkill, 
    isActive, 
    isLocked,
    canAfford,
    isSelected,
    onClick,
}: { 
    node: any, 
    learnedSkill?: PassiveSkill,
    isActive: boolean,
    isLocked: boolean,
    canAfford: boolean,
    isSelected: boolean,
    onClick: () => void,
}) => {
    const themeStyle = PASSIVE_THEME_COLORS[node.theme];
    const level = learnedSkill ? learnedSkill.level : 0;
    const maxRank = node.maxRank || 10;
    const isMaxed = level >= maxRank;

    let borderClass = 'border-stone-700';
    let bgClass = 'bg-stone-900';
    let iconClass = 'grayscale opacity-30 text-stone-500';
    let scaleClass = 'scale-100';

    if (!isLocked) {
        borderClass = isActive ? 'border-green-500' : themeStyle.border;
        bgClass = isActive ? 'bg-green-950/40' : 'bg-stone-800';
        iconClass = isActive ? 'text-green-400' : themeStyle.text;
        
        if (isMaxed) {
             borderClass = 'border-amber-500';
             iconClass = 'text-amber-400';
        }
    } else if (!isLocked && canAfford) {
        borderClass = 'border-stone-400';
        iconClass = 'text-stone-400';
    }

    if (isSelected) {
        scaleClass = 'scale-110';
        borderClass = 'border-white shadow-[0_0_15px_rgba(255,255,255,0.5)]';
        bgClass = 'bg-stone-700';
    }

    // Coordinates logic: (treeX) * 120 + offset
    const leftPos = (node.treeX || 0) * 120 + CANVAS_CENTER_OFFSET;

    return (
        <div 
            className="absolute flex flex-col items-center justify-center"
            style={{ 
                left: `${leftPos}px`, 
                top: `${(node.tier - 1) * TIER_ROW_HEIGHT + 40}px`,
                width: NODE_WIDTH,
                height: NODE_WIDTH
            }}
        >
            <button
                onPointerUp={(e) => { e.stopPropagation(); onClick(); }} // PointerUp to work well with Pan gestures
                className={`
                    w-16 h-16 rounded-md border-2 flex items-center justify-center relative shadow-lg transition-all duration-200 z-10
                    ${borderClass} ${bgClass} ${scaleClass}
                    touch-manipulation
                `}
            >
                <span className={`text-2xl filter drop-shadow-md transition-all duration-300 ${iconClass}`}>{themeStyle.icon}</span>
                
                {/* Level Badge */}
                <div className="absolute -bottom-2 -right-2 bg-black text-[9px] font-mono border border-stone-700 px-1 rounded text-stone-300 z-20 shadow-sm">
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


// --- MAIN MODAL ---
const SkillsModal: React.FC<SkillsModalProps> = ({ 
    passiveSkills, 
    activeEffects, 
    equippedSkillIds, 
    playerStats,
    onEquip, 
    onUnequip,
    onUnlockTreeSkill,
    onClose 
}) => {
  const [activeTab, setActiveTab] = useState<'tree' | 'effects'>('tree');
  const [selectedBranchId, setSelectedBranchId] = useState('offense');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Pan & Zoom State
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const lastDist = useRef<number | null>(null); // For pinch zoom

  // Filter skills for current branch
  const currentBranch = BRANCHES.find(b => b.id === selectedBranchId)!;
  const treeNodes = PASSIVE_SKILLS_POOL.filter(s => currentBranch.themes.includes(s.theme));

  // Determine Connections for SVG
  const connections = treeNodes.map(node => {
      if (!node.prerequisiteId) return null;
      const parent = treeNodes.find(p => p.id === node.prerequisiteId);
      if (!parent) return null;
      
      return {
          fromX: (parent.treeX || 0) * 120 + CANVAS_CENTER_OFFSET + 32, 
          fromY: (parent.tier - 1) * TIER_ROW_HEIGHT + 40 + 64, 
          toX: (node.treeX || 0) * 120 + CANVAS_CENTER_OFFSET + 32,
          toY: (node.tier - 1) * TIER_ROW_HEIGHT + 40,
          isUnlocked: passiveSkills.some(s => s.id === parent.id)
      };
  }).filter(Boolean);

  // --- INTERACTION HANDLERS ---

  const handlePointerDown = (e: React.PointerEvent) => {
      if (e.target !== containerRef.current && !(e.target as HTMLElement).classList.contains('canvas-layer')) return;
      isDragging.current = false; // Reset, will set to true on move
      lastPos.current = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!e.buttons) return; // Only if clicked
      isDragging.current = true;
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
          // Pinch Zoom
          const touch1 = e.touches[0];
          const touch2 = e.touches[1];
          const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
          
          if (lastDist.current !== null) {
              const delta = dist - lastDist.current;
              const zoomFactor = delta * 0.005;
              setTransform(prev => ({ ...prev, scale: Math.min(2, Math.max(0.5, prev.scale + zoomFactor)) }));
          }
          lastDist.current = dist;
      } else if (e.touches.length === 1) {
          // Pan
          isDragging.current = true;
          const touch = e.touches[0];
          const dx = touch.clientX - lastPos.current.x;
          const dy = touch.clientY - lastPos.current.y;
          setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
          lastPos.current = { x: touch.clientX, y: touch.clientY };
      }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
          const touch1 = e.touches[0];
          const touch2 = e.touches[1];
          lastDist.current = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      } else {
          lastDist.current = null;
          lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          isDragging.current = false;
      }
  };

  const handleWheel = (e: React.WheelEvent) => {
      const zoomSensitivity = 0.001;
      const delta = -e.deltaY * zoomSensitivity;
      setTransform(prev => ({ ...prev, scale: Math.min(2, Math.max(0.5, prev.scale + delta)) }));
  };

  // Center tree on branch change
  useEffect(() => {
      setTransform({ x: 0, y: 0, scale: 1 });
      setSelectedNodeId(null);
  }, [selectedBranchId]);

  const handleAction = () => {
      if (!selectedNodeId) return;
      const learned = passiveSkills.find(s => s.id === selectedNodeId);
      const poolNode = treeNodes.find(n => n.id === selectedNodeId);
      
      if (learned) {
          const maxRank = poolNode?.maxRank || 10;
          if (learned.level < maxRank && playerStats.skillPoints > 0) {
              // Priority: Upgrade if points available and not maxed? 
              // UX: Usually people want to toggle equip if learned. But upgrade is important.
              // Let's rely on the separate buttons in the details panel.
              // This function handles the MAIN button action which is ambiguous in the generic handler.
              // See `SkillDetailsPanel` for granular calls.
          }
          // The detail panel calls specific logic now, so this generic one is less used, 
          // but we map it to Unlock/Upgrade if possible, else Equip toggle.
          if (learned.level < maxRank && playerStats.skillPoints > 0) onUnlockTreeSkill(selectedNodeId);
          else if (equippedSkillIds.includes(selectedNodeId)) onUnequip(selectedNodeId);
          else onEquip(selectedNodeId);
      } else {
          onUnlockTreeSkill(selectedNodeId);
      }
  };

  const isNodeLocked = (nodeId: string, prerequisiteId?: string) => {
      const learned = passiveSkills.some(s => s.id === nodeId);
      if (learned) return false;
      if (!prerequisiteId) return false;
      return !passiveSkills.some(s => s.id === prerequisiteId);
  };

  const selectedNode = selectedNodeId ? treeNodes.find(n => n.id === selectedNodeId) : null;
  const learnedSelected = selectedNode ? passiveSkills.find(s => s.id === selectedNode.id) : undefined;

  return (
    <BaseModal.Container zIndex="z-[60]" maxWidth="max-w-7xl" className="h-[100dvh] md:h-[90vh] shadow-2xl border-stone-800">
      <BaseModal.Header 
        title="Skill Tree" 
        subtitle={`Points Available: ${playerStats.skillPoints}`} 
        icon="📜" 
        onClose={onClose} 
      />

      {/* TABS */}
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

      <BaseModal.Body className="bg-[#0c0a09] relative flex flex-col h-full overflow-hidden" noPadding>
            
            {activeTab === 'tree' && (
                <div className="flex flex-col md:flex-row h-full relative">
                    
                    {/* SIDEBAR: Branch Selector */}
                    <div className="w-full md:w-64 bg-stone-950 border-b md:border-b-0 md:border-r border-stone-800 flex flex-row md:flex-col overflow-x-auto md:overflow-visible shrink-0 z-20 custom-scrollbar">
                        {BRANCHES.map(branch => (
                            <button
                                key={branch.id}
                                onClick={() => setSelectedBranchId(branch.id)}
                                className={`
                                    flex items-center gap-3 px-4 md:px-6 py-3 md:py-4 border-r md:border-r-0 md:border-b border-stone-800 transition-colors whitespace-nowrap min-w-[140px] md:min-w-0
                                    ${selectedBranchId === branch.id ? 'bg-stone-900 text-amber-500 md:border-l-4 md:border-l-amber-500 border-b-4 md:border-b-stone-800 border-b-amber-500' : 'text-stone-500 hover:text-stone-300 hover:bg-stone-900'}
                                `}
                            >
                                <span className="text-lg md:text-xl">{branch.icon}</span>
                                <span className="font-bold uppercase tracking-wider text-xs md:text-sm">{branch.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* CANVAS AREA */}
                    <div className="flex-grow relative overflow-hidden bg-[#12100e] cursor-grab active:cursor-grabbing touch-none select-none">
                         
                         {/* Controls Overlay */}
                         <div className="absolute top-4 right-4 z-30 flex flex-col gap-2">
                             <button onClick={() => setTransform(p => ({...p, scale: Math.min(2, p.scale + 0.2)}))} className="w-10 h-10 bg-stone-800 border border-stone-600 rounded text-stone-300 hover:bg-stone-700 shadow-lg font-bold text-xl">+</button>
                             <button onClick={() => setTransform(p => ({...p, scale: Math.max(0.5, p.scale - 0.2)}))} className="w-10 h-10 bg-stone-800 border border-stone-600 rounded text-stone-300 hover:bg-stone-700 shadow-lg font-bold text-xl">-</button>
                             <button onClick={() => setTransform({x:0, y:0, scale:1})} className="w-10 h-10 bg-stone-800 border border-stone-600 rounded text-stone-300 hover:bg-stone-700 shadow-lg text-xs font-bold">RST</button>
                         </div>
                         
                         {/* Points Display (Mobile Overlay) */}
                         <div className="absolute top-4 left-4 z-30 pointer-events-none">
                             <div className="bg-black/60 border border-amber-900/50 px-3 py-1 rounded backdrop-blur-sm">
                                 <span className="text-[10px] text-stone-400 uppercase font-bold mr-2">Points</span>
                                 <span className="text-amber-500 font-bold text-lg">{playerStats.skillPoints}</span>
                             </div>
                         </div>

                         {/* The Interactive Canvas */}
                         <div 
                            ref={containerRef}
                            className="w-full h-full relative origin-center canvas-layer"
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={() => isDragging.current = false}
                            onPointerLeave={() => isDragging.current = false}
                            onWheel={handleWheel}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={() => isDragging.current = false}
                         >
                             {/* Transform Container */}
                             <div 
                                style={{ 
                                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                                    transformOrigin: 'center',
                                    transition: isDragging.current ? 'none' : 'transform 0.1s ease-out',
                                    width: '100%',
                                    height: '100%',
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    // Use a large centralized area for the tree
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                             >
                                 {/* Actual Tree Content Wrapper - Centered */}
                                 <div className="relative" style={{ width: TREE_CANVAS_WIDTH, height: 800 }}>
                                    
                                     {/* Background Grid for Depth */}
                                     <div className="absolute -inset-[1000px] bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:40px_40px] opacity-10 pointer-events-none"></div>

                                     {/* Connections Layer */}
                                     <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                                          {connections.map((conn: any, i) => (
                                              <path 
                                                key={i} 
                                                d={`M${conn.fromX},${conn.fromY} C${conn.fromX},${conn.fromY + 40} ${conn.toX},${conn.toY - 40} ${conn.toX},${conn.toY}`} 
                                                stroke={conn.isUnlocked ? '#d97706' : '#44403c'} 
                                                strokeWidth={conn.isUnlocked ? 3 : 2}
                                                fill="none" 
                                                strokeDasharray={conn.isUnlocked ? "0" : "5 5"}
                                                className="transition-all duration-500"
                                              />
                                          ))}
                                     </svg>

                                     {/* Nodes Layer */}
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
                                                  isSelected={selectedNodeId === node.id}
                                                  canAfford={playerStats.skillPoints > 0}
                                                  onClick={() => {
                                                      if (!isDragging.current) setSelectedNodeId(node.id);
                                                  }}
                                              />
                                          );
                                     })}

                                     {/* Tier Labels */}
                                     {[1, 2, 3, 4].map(tier => (
                                          <div 
                                            key={tier} 
                                            className="absolute left-[-20%] right-[-20%] text-stone-700 font-bold uppercase text-[100px] opacity-5 pointer-events-none text-center select-none"
                                            style={{ top: (tier - 1) * TIER_ROW_HEIGHT + 20 }}
                                          >
                                              {tier}
                                          </div>
                                     ))}
                                 </div>
                             </div>
                         </div>
                    </div>
                </div>
            )}

            {/* DETAILS PANEL OVERLAY */}
            {selectedNode && activeTab === 'tree' && (
                <SkillDetailsPanel 
                    skill={selectedNode}
                    learnedSkill={learnedSelected}
                    isEquipped={equippedSkillIds.includes(selectedNode.id)}
                    isLocked={isNodeLocked(selectedNode.id, selectedNode.prerequisiteId)}
                    canAfford={playerStats.skillPoints > 0}
                    cost={1}
                    onAction={handleAction} // Generic action
                    onClose={() => setSelectedNodeId(null)}
                />
            )}

            {/* EFFECTS TAB (Unchanged layout, just ensuring scroll) */}
            {activeTab === 'effects' && (
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto h-full bg-stone-900">
                    {activeEffects.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 text-stone-500 opacity-60">
                            <span className="text-5xl mb-4">✨</span>
                            <p className="font-serif italic">No active magical effects.</p>
                        </div>
                    )}
                    {activeEffects.map(effect => (
                        <div key={effect.id} className={`p-4 rounded border relative overflow-hidden h-fit ${effect.isDebuff ? 'bg-red-950/20 border-red-800' : 'bg-blue-950/20 border-blue-800'}`}>
                            <div className="flex items-start gap-4 relative z-10">
                                <div className={`text-4xl p-2 rounded-lg bg-black/40 border border-white/5 ${effect.isDebuff ? 'grayscale' : ''}`}>{effect.icon}</div>
                                <div className="flex-grow">
                                    <h3 className={`font-bold text-lg leading-none mb-1 ${effect.isDebuff ? 'text-red-400' : 'text-blue-300'}`}>{effect.name}</h3>
                                    <p className="text-stone-400 text-xs mb-3">{effect.description}</p>
                                    <div className="text-[10px] text-stone-500 text-right mt-1 font-mono">{effect.duration} Turns/Battles</div>
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

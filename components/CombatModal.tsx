
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Monster, PlayerStats, CombatStatusEffect, ActiveEffect, CombatStance, MaledictAffix } from '../types';
import { BALANCE } from '../services/gameBalance';
import GameIcon from './GameIcon';

interface CombatModalProps {
  playerStats: PlayerStats;
  playerHp: number;
  monster: Monster;
  onFlee: () => void;
  combatLog: string[];
  isPlayerTurn: boolean;
  combatStatusEffects: CombatStatusEffect[];
  activeEffects: ActiveEffect[];
  combatStance: CombatStance;
  onSetStance: (stance: CombatStance) => void;
  turnQueue: ('player' | 'enemy')[];
}

interface FloatingNumber { id: number; value: string; type: 'damage' | 'heal' | 'crit' | 'miss'; x: number; }

const FloatingText: React.FC<{ num: FloatingNumber }> = ({ num }) => {
  const color = num.type === 'heal' ? 'text-green-400' : num.type === 'crit' ? 'text-yellow-400 scale-150' : num.type === 'miss' ? 'text-blue-300' : 'text-red-500';
  return (
    <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-bold diablo-font text-2xl md:text-4xl pointer-events-none z-50 drop-shadow-md animate-float-up ${color}`} style={{ marginLeft: `${num.x}px`, textShadow: '0 2px 4px rgba(0,0,0,1)' }}>{num.value}</div>
  );
};

const StatPlate: React.FC<{ label: string; value: string | number; icon: string; color?: string }> = ({ label, value, icon, color = 'text-stone-200' }) => (
    <div className="bg-black/40 border border-stone-700 rounded px-2 py-1 flex items-center gap-2 min-w-[80px]">
        <span className="text-xs opacity-70 grayscale">{icon}</span>
        <div className="flex flex-col leading-none">
            <span className="text-[9px] text-stone-500 uppercase font-bold">{label}</span>
            <span className={`text-xs font-mono font-bold ${color}`}>{value}</span>
        </div>
    </div>
);

const HealthBar: React.FC<{ current: number; max: number; isEnemy?: boolean; label?: string }> = ({ current, max, isEnemy, label }) => {
  const percentage = Math.max(0, Math.min(100, (current / max) * 100));
  const barColor = isEnemy ? 'bg-gradient-to-r from-red-900 via-red-600 to-red-900' : 'bg-gradient-to-r from-green-900 via-green-600 to-green-900';
  
  return (
    <div className="w-full relative group shadow-[0_0_15px_rgba(0,0,0,0.5)]">
       <div className="h-6 bg-black border border-stone-600 rounded relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30"></div>
          <div className={`h-full transition-all duration-300 ease-out ${barColor} relative`} style={{ width: `${percentage}%` }}>
              <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent"></div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,1)] z-10 font-mono tracking-widest">
             {Math.ceil(current)} / {max}
          </div>
       </div>
       {label && <div className={`absolute -top-4 ${isEnemy ? 'right-0' : 'left-0'} text-[10px] font-bold text-stone-500 uppercase tracking-widest`}>{label}</div>}
    </div>
  );
};

const EFFECT_ICONS: Record<string, string> = { 
    burn: '🔥', freeze: '❄️', poison: '🤢', blind: '🙈', regen: '💖', 
    crit_boost: '⚡', chill: '🥶', stun: '💫', explode: '💥', shield: '🛡️' 
};

// Unified Effect Types
type AnyEffect = CombatStatusEffect | ActiveEffect | MaledictAffix;

const AuraTooltip: React.FC<{ effect: AnyEffect; rect: DOMRect | null }> = ({ effect, rect }) => {
  if (!rect) return null;

  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const tooltipWidth = 240;
  
  // Calculate Position
  const spaceAbove = rect.top;
  const spaceBelow = viewportHeight - rect.bottom;
  const showBelow = spaceAbove < 160 && spaceBelow > spaceAbove;
  
  const top = showBelow ? rect.bottom + 12 : rect.top - 12;
  const left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
  
  // Clamping to screen edges
  const clampedLeft = Math.max(10, Math.min(left, viewportWidth - tooltipWidth - 10));
  const transform = showBelow ? 'translateX(0)' : 'translateY(-100%)';

  // Determine Duration Text
  let durationText = "";
  if ('duration' in effect) {
     const dur = (effect as any).duration;
     if ('type' in effect) durationText = `${dur} Turn${dur !== 1 ? 's' : ''}`; // CombatStatusEffect
     else durationText = `${dur} Battle${dur !== 1 ? 's' : ''}`; // ActiveEffect
  } else {
     durationText = "Permanent Aura"; // Maledict
  }

  // Type Guards & Labels
  const isMaledict = (e: any): e is MaledictAffix => 'statModifiers' in e;
  
  const typeLabel = isMaledict(effect) ? "Maledict Aura" : 
                    ('isDebuff' in effect && effect.isDebuff) || ('type' in effect && ['burn','poison','freeze','blind','chill','stun'].includes((effect as any).type)) 
                    ? "Debuff" : "Buff";

  return createPortal(
    <div 
        className="fixed z-[9999] pointer-events-none animate-in fade-in zoom-in-95 duration-150"
        style={{ top, left: clampedLeft, width: tooltipWidth, transform }}
    >
        <div className="bg-[#151413] border-2 border-stone-500 shadow-[0_0_50px_rgba(0,0,0,0.8)] rounded-sm p-3 relative text-xs overflow-hidden">
             {/* Background Texture */}
             <div className="absolute inset-0 bg-stone-900 opacity-90"></div>
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-leather.png')] opacity-30"></div>

             {/* Arrow Indicator */}
             <div className={`absolute w-3 h-3 bg-[#151413] border-r border-b border-stone-500 transform rotate-45 left-1/2 -translate-x-1/2 z-0 ${showBelow ? '-top-1.5 border-b-0 border-r-0 border-t border-l' : '-bottom-1.5'}`}></div>
             
             <div className="relative z-10">
                <div className="flex justify-between items-center border-b border-stone-700 pb-2 mb-2">
                    <span className="font-bold text-stone-100 text-sm uppercase tracking-wider font-serif">{effect.name}</span>
                    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border border-white/10 ${typeLabel === 'Debuff' ? 'bg-red-900/50 text-red-300' : typeLabel === 'Maledict Aura' ? 'bg-purple-900/50 text-purple-300' : 'bg-blue-900/50 text-blue-300'}`}>
                        {typeLabel}
                    </span>
                </div>
                
                <p className="text-stone-300 leading-relaxed italic mb-3">
                    {effect.description || "Description unavailable."}
                </p>

                <div className="flex justify-between items-center text-[10px] bg-black/40 p-1.5 rounded font-mono border border-stone-800">
                    <span className="text-stone-500 font-bold">DURATION</span>
                    <span className={`font-bold ${durationText === "Permanent Aura" ? "text-purple-400" : "text-stone-200"}`}>{durationText}</span>
                </div>
                {('value' in effect && (effect as any).value !== 0) && (
                    <div className="text-[10px] text-stone-500 mt-1 font-mono text-right">
                         Strength: {(effect as any).value}
                    </div>
                )}
             </div>
        </div>
    </div>,
    document.body
  );
};

const AuraBadge: React.FC<{ 
    effect: AnyEffect; 
    onHover: (e: React.MouseEvent<HTMLDivElement>, effect: AnyEffect) => void; 
    onLeave: () => void; 
}> = ({ effect, onHover, onLeave }) => {
    
    // Determine Properties based on Type
    const isCombat = (e: any): e is CombatStatusEffect => 'type' in e && 'stacks' in e;
    const isMaledict = (e: any): e is MaledictAffix => 'statModifiers' in e;
    
    let icon = '';
    let badgeText: string | null = null;
    let stackCount = 0;
    let borderColor = 'border-stone-600';
    let bgColor = 'bg-stone-900/50';

    if (isCombat(effect)) {
        icon = EFFECT_ICONS[effect.type] || '✨';
        badgeText = `${effect.duration}`;
        stackCount = effect.stacks;
        const isDebuff = ['burn', 'poison', 'freeze', 'blind', 'chill', 'stun'].includes(effect.type);
        borderColor = isDebuff ? 'border-red-600' : 'border-blue-500';
        bgColor = isDebuff ? 'bg-red-950/60' : 'bg-blue-950/60';
    } else {
        // Both MaledictAffix and ActiveEffect have an icon property
        // Safe access check via type assertion for unknown property access in union
        icon = 'icon' in effect ? (effect as any).icon : '❓';
        
        if (isMaledict(effect)) {
            borderColor = 'border-purple-500';
            bgColor = 'bg-purple-950/60';
            badgeText = null; // Infinite
        } else {
            // ActiveEffect (Hero Buff)
            badgeText = `${(effect as ActiveEffect).duration}`;
            const isDebuff = (effect as ActiveEffect).isDebuff;
            borderColor = isDebuff ? 'border-red-600' : 'border-green-600';
            bgColor = isDebuff ? 'bg-red-950/60' : 'bg-green-950/60';
        }
    }

    return (
        <div 
            className={`relative w-8 h-8 md:w-10 md:h-10 border ${borderColor} ${bgColor} rounded flex items-center justify-center cursor-help transition-all duration-200 hover:scale-110 hover:shadow-[0_0_15px_rgba(255,255,255,0.15)] hover:z-20 group`}
            onMouseEnter={(e) => onHover(e, effect)}
            onMouseLeave={onLeave}
        >
            <span className="text-sm md:text-lg filter drop-shadow opacity-90 group-hover:opacity-100">{icon}</span>
            
            {badgeText && (
                 <span className="absolute -bottom-1 -right-1 bg-black text-[9px] text-stone-300 px-1 rounded leading-none border border-stone-800 shadow z-10 font-mono font-bold">
                    {badgeText}
                 </span>
            )}
            
            {stackCount > 1 && (
                <span className="absolute -top-2 -right-2 bg-amber-600 text-white text-[9px] rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center border border-black z-20 font-bold shadow-sm">
                    {stackCount}
                </span>
            )}
        </div>
    );
};

const CombatModal: React.FC<CombatModalProps> = ({ playerStats, playerHp, monster, onFlee, combatLog, isPlayerTurn, combatStatusEffects, activeEffects, combatStance, onSetStance, turnQueue }) => {
  const rarityConfig = BALANCE.MONSTER.rarityConfig[monster.rarity];
  const latestLog = combatLog[combatLog.length - 1] || "Battle Joined";
  
  const [heroFloats, setHeroFloats] = useState<FloatingNumber[]>([]);
  const [enemyFloats, setEnemyFloats] = useState<FloatingNumber[]>([]);
  const prevPlayerHp = useRef(playerHp);
  const prevMonsterHp = useRef(monster.currentHp);
  
  // Tooltip State
  const [hoveredEffect, setHoveredEffect] = useState<{ effect: AnyEffect; rect: DOMRect } | null>(null);

  const handleEffectHover = (e: React.MouseEvent<HTMLDivElement>, effect: AnyEffect) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setHoveredEffect({ effect, rect });
  };
  
  const handleEffectLeave = () => setHoveredEffect(null);

  useEffect(() => {
    const diff = playerHp - prevPlayerHp.current;
    if (diff !== 0) {
        setHeroFloats(prev => [...prev, { id: Date.now(), value: Math.abs(diff).toString(), type: diff > 0 ? 'heal' : 'damage', x: (Math.random() * 40) - 20 }]);
        setTimeout(() => setHeroFloats(prev => prev.slice(1)), 1000);
    }
    prevPlayerHp.current = playerHp;
  }, [playerHp]);

  useEffect(() => {
    const diff = monster.currentHp - prevMonsterHp.current;
    if (diff !== 0) {
        setEnemyFloats(prev => [...prev, { id: Date.now(), value: Math.abs(diff).toString(), type: 'damage', x: (Math.random() * 40) - 20 }]);
        setTimeout(() => setEnemyFloats(prev => prev.slice(1)), 1000);
    }
    prevMonsterHp.current = monster.currentHp;
  }, [monster.currentHp]);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
       
       {/* Tooltip Portal Layer */}
       {hoveredEffect && <AuraTooltip effect={hoveredEffect.effect} rect={hoveredEffect.rect} />}

       {/* Battle Container */}
       <div className="w-full h-full max-w-[90%] max-h-[90%] flex flex-col relative pointer-events-auto">
           
           {/* Timeline Header */}
           <div className="h-12 bg-black/80 border-b border-stone-800 flex items-center justify-center gap-2 relative">
                <div className="text-[10px] text-stone-500 uppercase font-bold mr-2 tracking-widest">Turn Order</div>
                {turnQueue.slice(0, 15).map((actor, idx) => (
                    <div key={idx} className={`w-6 h-6 rounded-full flex items-center justify-center border shadow-md transition-all ${actor === 'player' ? 'bg-stone-800 border-green-600' : 'bg-stone-900 border-red-600'} ${idx === 0 ? 'scale-125 z-10 ring-2 ring-amber-500' : 'opacity-60 scale-90'}`}>
                        <span className="text-[10px]">{actor === 'player' ? '👤' : '👹'}</span>
                    </div>
                ))}
                <div className="absolute right-4 top-2">
                    <button onClick={onFlee} className="px-4 py-1 bg-stone-800 hover:bg-red-900/80 border border-stone-600 text-stone-300 text-xs uppercase font-bold rounded transition-colors">Run Away</button>
                </div>
           </div>

           {/* Main Arena */}
           <div className="flex-grow flex items-center justify-between px-12 md:px-24 relative overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-stone-900/30 via-black/60 to-black/90">
                
                {/* HERO SIDE */}
                <div className="flex flex-col items-center gap-4 w-64 z-10">
                    <div className={`w-32 h-32 md:w-40 md:h-40 rounded-full border-4 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative transition-all duration-500 ${isPlayerTurn ? 'border-green-600 shadow-[0_0_30px_rgba(22,163,74,0.3)] scale-105' : 'border-stone-700 grayscale-[0.3]'}`}>
                        <div className="absolute inset-0 bg-black/40 rounded-full"></div>
                        <GameIcon name="hero" className="w-full h-full drop-shadow-2xl" />
                        {heroFloats.map(f => <FloatingText key={f.id} num={f} />)}
                    </div>
                    
                    <div className="w-full space-y-2">
                        <HealthBar current={playerHp} max={playerStats.maxHp} label="HERO" />
                        <div className="grid grid-cols-2 gap-2">
                            <StatPlate label="Dmg" value={playerStats.damage} icon="⚔️" />
                            <StatPlate label="Arm" value={playerStats.armor} icon="🛡️" />
                        </div>
                        <div className="flex flex-wrap justify-center gap-1.5 min-h-[40px] bg-black/20 p-2 rounded border border-white/5">
                            {[...combatStatusEffects.filter(e => e.target === 'player'), ...activeEffects].map((e, idx) => (
                                <AuraBadge key={`${e.id}-${idx}`} effect={e} onHover={handleEffectHover} onLeave={handleEffectLeave} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* VS CENTER */}
                <div className="flex flex-col items-center z-10">
                    <div className="text-6xl diablo-font text-red-800 font-bold drop-shadow-[0_0_15px_rgba(153,27,27,0.8)] animate-pulse opacity-80">VS</div>
                    <div className="mt-8 flex gap-1 bg-black/60 p-1 rounded border border-stone-800 backdrop-blur-sm">
                        {[CombatStance.AGGRESSIVE, CombatStance.BALANCED, CombatStance.DEFENSIVE].map(s => (
                            <button key={s} onClick={() => onSetStance(s)} className={`w-8 h-8 flex items-center justify-center rounded transition-all ${combatStance === s ? 'bg-stone-700 text-amber-400 border border-stone-500 shadow-inner' : 'text-stone-600 hover:text-stone-300 hover:bg-stone-800'}`}>
                                <span className="text-sm">{s === CombatStance.AGGRESSIVE ? '⚔️' : s === CombatStance.DEFENSIVE ? '🛡️' : '⚖️'}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* MONSTER SIDE */}
                <div className="flex flex-col items-center gap-4 w-64 z-10">
                    <div className={`w-32 h-32 md:w-40 md:h-40 rounded-full border-4 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative transition-all duration-500 ${!isPlayerTurn ? `border-red-600 ${rarityConfig.glow} scale-105` : 'border-stone-700 grayscale-[0.3]'}`}>
                        <div className="absolute inset-0 bg-black/40 rounded-full"></div>
                        <GameIcon name={monster.icon} imageUrl={monster.imageUrl} className={`w-full h-full drop-shadow-2xl ${rarityConfig.color}`} />
                        {enemyFloats.map(f => <FloatingText key={f.id} num={f} />)}
                    </div>
                    
                    <div className="w-full space-y-2">
                        <HealthBar current={monster.currentHp} max={monster.maxHp} isEnemy label={monster.rarity} />
                        <div className="grid grid-cols-2 gap-2">
                            <StatPlate label="Dmg" value={monster.damage} icon="⚔️" color="text-red-400" />
                            <StatPlate label="Arm" value={monster.armor} icon="🛡️" />
                        </div>
                        <div className="flex flex-wrap justify-center gap-1.5 min-h-[40px] bg-black/20 p-2 rounded border border-white/5">
                            {[...monster.maledicts, ...combatStatusEffects.filter(e => e.target === 'enemy')].map((e, idx) => (
                                <AuraBadge key={`${e.id}-${idx}`} effect={e} onHover={handleEffectHover} onLeave={handleEffectLeave} />
                            ))}
                        </div>
                    </div>
                </div>
           </div>

           {/* Combat Log Footer */}
           <div className="h-16 bg-black/90 border-t border-stone-800 flex items-center justify-center relative z-20">
                <div className={`text-lg diablo-font tracking-wide ${latestLog.includes('CRIT') ? 'text-yellow-500 animate-pulse font-bold' : 'text-stone-300'}`}>
                    {latestLog}
                </div>
           </div>
       </div>
    </div>
  );
};

export default CombatModal;

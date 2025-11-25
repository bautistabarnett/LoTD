

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Monster, PlayerStats, CombatStatusEffect, ActiveEffect, CombatStance, CombatTrigger, LogEntry, TerrainType, PassiveSkill } from '../types';
import { COMPOSITE_SYNERGIES, PASSIVE_SET_BONUSES, PASSIVE_SKILLS_POOL } from '../constants';
import { BALANCE } from '../services/gameBalance';
import { generateCombatNarrative, generateEncounterDescription } from '../services/geminiService';

interface UseCombatEngineProps {
  playerStats: PlayerStats | null;
  playerHp: number;
  setPlayerHp: React.Dispatch<React.SetStateAction<number>>;
  onVictory: (monster: Monster) => void;
  onDefeat: () => void;
  addLog: (msg: string, type?: LogEntry['type']) => void;
  environment?: {
      terrain: TerrainType;
      isNight: boolean;
      activeSkillIds: string[];
  };
}

export const generateTurnBatch = (playerAgi: number, enemyAgi: number): ('player' | 'enemy')[] => {
    const { playerAttacks, enemyAttacks, playerGoesFirst } = BALANCE.COMBAT.calculateTurns(playerAgi, enemyAgi);

    const batch: ('player' | 'enemy')[] = [];
    if (playerGoesFirst) {
        for (let i = 0; i < playerAttacks; i++) batch.push('player');
        for (let i = 0; i < enemyAttacks; i++) batch.push('enemy');
    } else {
        for (let i = 0; i < enemyAttacks; i++) batch.push('enemy');
        for (let i = 0; i < playerAttacks; i++) batch.push('player');
    }
    return batch;
};

// Helper to consolidate stacking effects
const applyStatusEffects = (current: CombatStatusEffect[], incoming: CombatStatusEffect[]): CombatStatusEffect[] => {
    const next = [...current];
    incoming.forEach(inc => {
        const existingIdx = next.findIndex(e => e.type === inc.type && e.target === inc.target && e.name === inc.name);
        if (existingIdx >= 0) {
            const existing = next[existingIdx];
            // Determine if this effect type stacks
            const isHardCC = ['stun', 'freeze', 'shield', 'cleanse'].includes(inc.type);
            
            // Scaling strength specifically adds value on stack
            const isScaling = inc.type === 'scaling_strength';
            
            next[existingIdx] = {
                ...existing,
                duration: inc.duration, // Refresh duration
                stacks: isHardCC ? 1 : existing.stacks + 1, // Hard CC/Shield doesn't stack intensity, just refreshes
                value: isScaling ? existing.value + inc.value : Math.max(existing.value, inc.value) // Scaling adds, others take max
            };
        } else {
            next.push(inc);
        }
    });
    return next;
};

export const useCombatEngine = ({ 
  playerStats, 
  playerHp, 
  setPlayerHp, 
  onVictory, 
  onDefeat,
  addLog,
  environment
}: UseCombatEngineProps) => {
  const [isFighting, setIsFighting] = useState(false);
  const [activeMonster, setActiveMonster] = useState<Monster | null>(null);
  const [combatLog, setCombatLog] = useState<string[]>([]);
  const [turnQueue, setTurnQueue] = useState<('player' | 'enemy')[]>([]);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [combatStance, setCombatStance] = useState<CombatStance>(CombatStance.BALANCED);
  const [combatStatusEffects, setCombatStatusEffects] = useState<CombatStatusEffect[]>([]);
  const [turnCount, setTurnCount] = useState(0);
  
  // New: Track Cooldowns for Skills (SkillID -> Turns Remaining)
  const [skillCooldowns, setSkillCooldowns] = useState<Record<string, number>>({});

  const addToCombatLog = (msg: string) => setCombatLog(prev => [...prev, msg]);

  // --- BATTLE START ---
  const startBattle = useCallback(async (monster: Monster, level: number) => {
    if (!playerStats) return;
    setActiveMonster(monster);
    setPlayerHp(playerStats.maxHp);
    setTurnQueue(generateTurnBatch(playerStats.dexterity, monster.dexterity));
    setCombatLog([`Encountered ${monster.name} (${monster.rarity})!`]);
    setCombatStatusEffects([]);
    setSkillCooldowns({});
    setTurnCount(1);
    setIsFighting(true);
    setCombatStance(CombatStance.BALANCED);
    
    // Initial Environment Check & Battle Start Triggers
    if (environment) {
        const { terrain, isNight, activeSkillIds } = environment;
        const initEffects: CombatStatusEffect[] = [];

        if (activeSkillIds.includes('night_prowler') && isNight) {
            addToCombatLog("🌑 Nightstalker active! Crit Chance increased.");
        }

        if (activeSkillIds.includes('tidal_affinity') && (terrain === TerrainType.SWAMP)) {
            addToCombatLog("🌊 Tidal Affinity: Regenerating in the swamp.");
            initEffects.push({
                id: 'tidal-regen', type: 'regen', name: 'Tidal Ward', duration: 10, value: 0.05, stacks: 1, source: 'environment', target: 'player', description: 'Swamp Healing'
            });
        }
        
        // Handle Void Form (Dodge Boost on Start)
        if (activeSkillIds.includes('void_form')) {
             const skill = PASSIVE_SKILLS_POOL.find(s => s.id === 'void_form');
             if(skill) {
                 addToCombatLog(`🌌 ${skill.name} activates! Ethereal form entered.`);
                 initEffects.push({
                    id: 'void-form', type: 'dodge_boost' as any, name: 'Void Form', duration: 2, value: 50, stacks: 1, source: 'skill', target: 'player', description: '+50% Dodge'
                });
             }
        }
        
        if (initEffects.length > 0) {
            setCombatStatusEffects(prev => applyStatusEffects(prev, initEffects));
        }
    }
    
    generateEncounterDescription(monster, level).then(addToCombatLog);
  }, [playerStats, setPlayerHp, environment]);

  // --- DYNAMIC AGILITY RECALC ---
  useEffect(() => {
      if (!isFighting || !activeMonster || !playerStats) return;
      
      const playerChillStacks = combatStatusEffects
        .filter(e => e.target === 'player' && e.type === 'chill')
        .reduce((acc, curr) => acc + curr.stacks, 0);
      
      const enemyChillStacks = combatStatusEffects
        .filter(e => e.target === 'enemy' && e.type === 'chill')
        .reduce((acc, curr) => acc + curr.stacks, 0);
      
      const pAgi = playerStats.dexterity * Math.pow(0.8, playerChillStacks);
      const eAgi = activeMonster.dexterity * Math.pow(0.8, enemyChillStacks);

      if (turnQueue.length < 2) {
          const nextBatch = generateTurnBatch(pAgi, eAgi);
          setTurnQueue(prev => [...prev, ...nextBatch]);
      }
  }, [turnQueue, playerStats, activeMonster, combatStatusEffects, isFighting]);

  // --- TRIGGERS ---
  const processTriggers = (trigger: CombatTrigger, actor: 'player' | 'enemy', damageDealt: number = 0): number => {
      if (!playerStats || !activeMonster) return 0;
      const newEffects: CombatStatusEffect[] = [];
      let triggerDamage = 0;

      // 1. PLAYER PASSIVES & SKILLS
      if (actor === 'player') {
          // Environmental Triggers
          if (environment) {
              const { terrain, activeSkillIds } = environment;
              if (trigger === 'onHit' && activeSkillIds.includes('forest_fire') && terrain === TerrainType.FOREST) {
                   if (Math.random() < 0.4) {
                       newEffects.push({
                           id: `wildfire-${Date.now()}`, type: 'burn', name: 'Wildfire', duration: 3, value: 0.1, stacks: 1, source: 'environment', target: 'enemy', description: 'Forest fueling fire'
                       });
                       addToCombatLog("🌲🔥 Wildfire spreads in the forest!");
                   }
              }
          }

          // A. Set Bonuses
          playerStats.activeSetBonuses.forEach(theme => {
              const bonus = PASSIVE_SET_BONUSES.find(b => b.theme === theme);
              if (bonus && bonus.triggerCondition === trigger && Math.random() < bonus.procChance) {
                  let target: 'player' | 'enemy' = 'enemy';
                  if (['regen', 'crit_boost', 'reflect'].includes(bonus.procEffect.type)) target = 'player';
                  
                  newEffects.push({
                      id: Date.now() + Math.random().toString(),
                      type: bonus.procEffect.type,
                      name: bonus.name,
                      duration: bonus.procEffect.duration,
                      value: bonus.procEffect.value,
                      stacks: 1,
                      source: 'set_bonus',
                      target: target,
                      description: `Proc from ${bonus.name}`
                  });
                  addToCombatLog(`>> ${bonus.name} Triggered!`);
              }
          });

          // B. Complex Skill Procs (Cooldowns, Costs, Conditions)
          const equippedSkills = PASSIVE_SKILLS_POOL.filter(s => playerStats.equippedSkillIds.includes(s.id));
          
          equippedSkills.forEach(skill => {
              if (skill.proc && skill.proc.trigger === trigger) {
                  // 1. Check Cooldown
                  if ((skillCooldowns[skill.id] || 0) > 0) return;
                  
                  // 2. Check Chance
                  if (Math.random() > skill.proc.chance) return;

                  // 3. Check Conditions
                  if (skill.proc.conditions) {
                      const conditionsMet = skill.proc.conditions.every(cond => {
                          if (cond.type === 'hp_below') return (playerHp / playerStats.maxHp) < Number(cond.value);
                          if (cond.type === 'hp_above') return (playerHp / playerStats.maxHp) > Number(cond.value);
                          if (cond.type === 'enemy_hp_below') return activeMonster ? (activeMonster.currentHp / activeMonster.maxHp) < Number(cond.value) : false;
                          if (cond.type === 'turn_count_multiple') return (turnCount % Number(cond.value)) === 0;
                          return true;
                      });
                      if (!conditionsMet) return;
                  }

                  // 4. Pay Cost (If applicable)
                  if (skill.proc.cost) {
                      let costVal = 0;
                      if (skill.proc.cost.type === 'hp_percent') costVal = Math.floor(playerStats.maxHp * skill.proc.cost.value);
                      if (skill.proc.cost.type === 'hp_flat') costVal = skill.proc.cost.value;
                      
                      if (playerHp <= costVal) return; // Cannot pay cost
                      
                      setPlayerHp(prev => Math.max(1, prev - costVal));
                      addToCombatLog(`🩸 ${skill.name} sacrifices ${costVal} HP!`);
                  }

                  // 5. Apply Effect
                  const eff = skill.proc.effect;
                  
                  if (eff.type === 'multi_hit') {
                       // Chained Attack: Immediate Damage
                       const chainedDmg = Math.floor(damageDealt * eff.value);
                       triggerDamage += chainedDmg;
                       if (activeMonster) setActiveMonster(prev => prev ? { ...prev, currentHp: prev.currentHp - chainedDmg } : null);
                       addToCombatLog(`⚔️ ${skill.name}: Echo strike for ${chainedDmg}!`);
                  } 
                  else if (eff.type === 'damage_phys' || eff.type === 'damage_magic') {
                       const dmg = Math.floor(playerStats.damage * eff.value);
                       triggerDamage += dmg;
                       if (activeMonster) setActiveMonster(prev => prev ? { ...prev, currentHp: prev.currentHp - dmg } : null);
                       addToCombatLog(`⚡ ${skill.name} triggers for ${dmg} damage!`);
                  }
                  else if (eff.type === 'heal') {
                       // Immediate Heal (e.g., Apex Predator)
                       const healVal = Math.floor(playerStats.maxHp * eff.value);
                       setPlayerHp(prev => Math.min(playerStats.maxHp, prev + healVal));
                       addToCombatLog(`💚 ${skill.name} heals you for ${healVal}!`);
                  }
                  else if (eff.type === 'cleanse') {
                       // Remove all debuffs from player
                       setCombatStatusEffects(prev => prev.filter(e => e.target !== 'player' || !['burn','poison','freeze','blind','chill','stun'].includes(e.type)));
                       addToCombatLog(`✨ ${skill.name} purifies you!`);
                  }
                  else if (eff.type === 'buff' || eff.type === 'debuff') {
                      let target: 'player' | 'enemy' = 'player';
                      if (eff.type === 'debuff') target = 'enemy';
                      if (eff.subType === 'burn' || eff.subType === 'poison') target = 'enemy';
                      
                      newEffects.push({
                          id: `${skill.id}-${Date.now()}`,
                          type: (eff.subType || 'buff') as any, // Cast to any to fit types loosely
                          name: skill.name,
                          duration: eff.duration || 3,
                          value: eff.value,
                          stacks: 1,
                          source: 'skill',
                          target: target,
                          description: skill.proc.description
                      });
                      addToCombatLog(`✨ ${skill.name} activates!`);
                  }
                  else if (eff.type === 'shield') {
                       newEffects.push({
                          id: `${skill.id}-${Date.now()}`,
                          type: 'shield',
                          name: skill.name,
                          duration: eff.duration || 1,
                          value: eff.value,
                          stacks: 1,
                          source: 'skill',
                          target: 'player',
                          description: 'Shielded'
                      });
                      addToCombatLog(`🛡️ ${skill.name} shields you!`);
                  }

                  // 6. Set Cooldown
                  if (skill.proc.cooldown > 0) {
                      setSkillCooldowns(prev => ({ ...prev, [skill.id]: skill.proc.cooldown }));
                  }
              }
          });

          // C. Synergies
          playerStats.activeSynergies.forEach(synId => {
              const synergy = COMPOSITE_SYNERGIES.find(s => s.id === synId);
              if (synergy && synergy.effect.trigger === trigger) {
                  if (synergy.id === 'frostburn') {
                      const isChilled = combatStatusEffects.some(e => e.target === 'enemy' && e.type === 'chill');
                      if (isChilled) {
                          const burst = Math.floor(playerStats.damage * synergy.effect.value);
                          triggerDamage += burst;
                          setActiveMonster(prev => prev ? { ...prev, currentHp: prev.currentHp - burst } : null);
                          addToCombatLog(`❄️🔥 FROSTBURN! Steam explosion deals ${burst} dmg!`);
                      }
                  }
                  else if (synergy.id === 'dark_momentum' && trigger === 'onCrit') {
                       addToCombatLog(`🌑 Dark Momentum: Speed increased!`);
                  }
              }
          });
      }

      // 2. ENEMY MALEDICTS (Active)
      if (actor === 'enemy') {
          activeMonster.maledicts.forEach(m => {
              if (m.trigger === trigger) {
                  // Existing maledict logic preserved...
                   if (m.id === 'arcane' && m.triggerEffect?.type === 'reflect') {
                       newEffects.push({
                           id: `arcane-shield-${Date.now()}`, type: 'shield', name: 'Arcane Shield', duration: 1, value: 1, stacks: 1, source: 'maledict', target: 'enemy', description: 'Nullifies next hit.'
                       });
                       addToCombatLog(`✨ ${m.name} activates!`);
                  }
                  else if (m.id === 'plague' && m.triggerEffect?.type === 'ground_hazard') {
                      newEffects.push({
                           id: `plague-${Date.now()}`, type: 'poison', name: 'Plague Cloud', duration: 3, value: m.triggerEffect.value, stacks: 1, source: 'maledict', target: 'player', description: 'Poisoned.'
                       });
                       addToCombatLog(`🤢 ${m.name} surrounds you!`);
                  }
                  else if (m.triggerEffect && Math.random() < m.triggerEffect.chance) {
                       const eff = m.triggerEffect;
                       if (eff.type === 'shuffle_turn') {
                           addToCombatLog(`⏳ ${m.name}: Turn queue shuffled.`);
                           setTurnQueue(prev => [...prev].sort(() => Math.random() - 0.5));
                       }
                       if (eff.type === 'debuff_player') {
                           newEffects.push({
                               id: Date.now() + Math.random().toString(), type: 'burn', name: m.name, duration: 3, value: eff.value, stacks: 1, source: 'maledict', target: 'player', description: 'Burned.'
                           });
                           addToCombatLog(`🔥 ${m.name} burns you!`);
                       }
                  }
              }
          });
      }

      // 3. ENEMY REACTIVE (Triggered by Player Action)
      if (actor === 'player' && trigger === 'onHit') {
           activeMonster.maledicts.forEach(m => {
                if (m.trigger === 'onTakeDamage' && m.triggerEffect && Math.random() < m.triggerEffect.chance) {
                     if (m.triggerEffect.type === 'debuff_player') {
                          newEffects.push({
                              id: Date.now() + Math.random().toString(), type: 'burn', name: m.name, duration: 2, value: m.triggerEffect.value, stacks: 1, source: 'maledict', target: 'player'
                          });
                          addToCombatLog(`⚠️ ${m.name} reacts!`);
                     }
                }
           });
      }

      if (newEffects.length > 0) {
          setCombatStatusEffects(prev => applyStatusEffects(prev, newEffects));
      }
      return triggerDamage;
  };

  const processCombatEffects = (target: 'player' | 'enemy') => {
      if (!activeMonster || !playerStats) return;
      let hp = target === 'player' ? playerHp : activeMonster.currentHp;
      let maxHp = target === 'player' ? playerStats.maxHp : activeMonster.maxHp;
      const name = target === 'player' ? 'Hero' : activeMonster.name;
      
      const effects = combatStatusEffects.filter(e => e.target === target);
      
      effects.forEach(effect => {
          const stacks = effect.stacks;
          const baseVal = effect.value;
          
          if (effect.type === 'burn' || effect.type === 'poison') {
              const dot = Math.max(1, Math.floor(maxHp * baseVal * stacks));
              hp -= dot;
              addToCombatLog(`${name} takes ${dot} ${effect.type} dmg (${stacks} stacks)`);
          }
          if (effect.type === 'regen') {
              const heal = Math.floor(maxHp * baseVal * stacks);
              hp = Math.min(maxHp, hp + heal);
              addToCombatLog(`${name} heals ${heal}.`);
          }
      });

      if (target === 'player') setPlayerHp(hp);
      else setActiveMonster(prev => prev ? { ...prev, currentHp: hp } : null);
      
      setCombatStatusEffects(prev => prev.map(e => (e.target === target ? { ...e, duration: e.duration - 1 } : e)).filter(e => e.duration > 0));
  };

  // --- TURN RESOLUTION ---
  const resolveCombatTurn = () => {
    if (!activeMonster || !playerStats) return;
    
    // Decrease skill cooldowns at start of player turn
    setSkillCooldowns(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => {
            if (next[k] > 0) next[k] -= 1;
            if (next[k] <= 0) delete next[k];
        });
        return next;
    });

    const isFrozen = combatStatusEffects.some(e => e.target === 'player' && (e.type === 'freeze' || e.type === 'stun'));
    if (isFrozen) {
        addToCombatLog("You are Frozen/Stunned and cannot act!");
        processCombatEffects('player');
        return;
    }

    const synergyDmg = processTriggers('onStartTurn', 'player');
    processCombatEffects('player');
    
    if (playerHp <= 0) { handleDefeatInternal(); return; }

    // Check for Arcane Shield on Enemy
    const isShielded = combatStatusEffects.some(e => e.target === 'enemy' && e.type === 'shield');

    let monsterHp = activeMonster.currentHp - synergyDmg;
    
    // Thorns Calculation
    if (activeMonster.thorns > 0 && !isShielded) { 
        const thorn = Math.floor(playerStats.damage * (activeMonster.thorns / 100));
        setPlayerHp(p => p - thorn);
        addToCombatLog(`Thorns: Took ${thorn} dmg.`);
    }

    // SCALING STRENGTH BUFF
    const scalingStrength = combatStatusEffects.find(e => e.target === 'player' && e.type === 'scaling_strength');
    let dynamicStr = 0;
    if (scalingStrength) {
        dynamicStr = scalingStrength.value;
        // Visual log only on high stacks or first app to avoid spam
        if (dynamicStr === 5 || dynamicStr % 15 === 0) addToCombatLog(`💪 Scaling Strength: +${dynamicStr} Dmg`);
    }

    let rawDmg = (playerStats.damage + dynamicStr) * (0.8 + Math.random() * 0.4);
    
    // Environmental Bonus
    if (environment) {
        if (environment.activeSkillIds.includes('forest_fire') && environment.terrain === TerrainType.FOREST) {
            rawDmg *= 1.2;
        }
    }

    const stanceMult = BALANCE.COMBAT.stanceMultipliers[combatStance] || BALANCE.COMBAT.stanceMultipliers[CombatStance.BALANCED];
    rawDmg *= stanceMult.damage;

    const isPoisoned = combatStatusEffects.some(e => e.target === 'enemy' && e.type === 'poison');
    const isFrozenEnemy = combatStatusEffects.some(e => e.target === 'enemy' && e.type === 'freeze');
    
    if (isPoisoned && playerStats.activeSynergies.includes('biohazard')) rawDmg *= 1.2;
    if (isFrozenEnemy) {
        rawDmg *= 1.5;
        addToCombatLog("Shattering strike!");
    }

    let critMult = BALANCE.COMBAT.critMultiplier;
    const critBoost = combatStatusEffects.find(e => e.type === 'crit_boost');
    if (critBoost) critMult += (critBoost.value / 100);

    let finalCritChance = playerStats.critChance;
    if (environment && environment.isNight && environment.activeSkillIds.includes('night_prowler')) {
        finalCritChance += 25;
    }

    const isCrit = Math.random() * 100 < finalCritChance;
    if (isCrit) rawDmg *= critMult;

    const onAttackDmg = processTriggers('onAttack', 'player');
    monsterHp -= onAttackDmg;

    const mitigation = activeMonster.armor * 0.5;
    let dmg = Math.max(1, Math.floor(rawDmg - mitigation));
    
    if (isShielded) {
        dmg = 0;
        addToCombatLog(`🚫 Blocked by ${activeMonster.name}'s Shield!`);
        setCombatStatusEffects(prev => prev.filter(e => !(e.target === 'enemy' && e.type === 'shield')));
    } else {
        monsterHp -= dmg;
        const onHitDmg = processTriggers('onHit', 'player', dmg);
        monsterHp -= onHitDmg;
        
        if (isCrit) {
            addToCombatLog(`CRITICAL! ${dmg} DMG!`);
            processTriggers('onCrit', 'player', dmg);
            generateCombatNarrative(activeMonster.name, 'Attack', 'crit').then(t => addToCombatLog(`> ${t}`));
        } else addToCombatLog(`Hit for ${dmg}.`);

        let lifeStealVal = playerStats.lifeSteal;
        if (environment && environment.activeSkillIds.includes('grave_born') && (environment.terrain === TerrainType.CRYPT || environment.terrain === TerrainType.RUINS)) {
            lifeStealVal += 15;
        }

        if (lifeStealVal > 0) {
            const heal = Math.floor(dmg * (lifeStealVal / 100));
            setPlayerHp(p => Math.min(playerStats.maxHp, p + heal));
        }
    }

    const updatedMonster = { ...activeMonster, currentHp: monsterHp };
    setActiveMonster(updatedMonster);

    if (updatedMonster.currentHp <= 0) {
        processTriggers('onKill', 'player');
        generateCombatNarrative(activeMonster.name, 'Attack', 'kill').then(t => addLog(t, 'combat'));
        handleVictoryInternal(updatedMonster);
    }
  };

  const executeEnemyTurn = () => {
      if (!activeMonster || !playerStats) return;
      
      const isStunned = combatStatusEffects.some(e => e.target === 'enemy' && (e.type === 'stun' || e.type === 'freeze'));
      if (isStunned) {
          addToCombatLog(`${activeMonster.name} is stunned!`);
          processCombatEffects('enemy');
          return;
      }

      processTriggers('onStartTurn', 'enemy');
      processCombatEffects('enemy');

      if (activeMonster.currentHp <= 0) { handleVictoryInternal(activeMonster); return; }

      let dodgeChance = playerStats.dodgeChance;
      // Apply Dodge Boost Buffs (e.g. Void Form)
      const dodgeBoost = combatStatusEffects.find(e => e.target === 'player' && e.type === 'dodge_boost');
      if (dodgeBoost) dodgeChance += dodgeBoost.value;

      const isDodge = Math.random() * 100 < dodgeChance;
      if (isDodge) {
          addToCombatLog("DODGED!");
          return;
      }

      let dmg = activeMonster.damage * (0.8 + Math.random() * 0.4);
      
      if (activeMonster.maledicts.some(m => m.id === 'executioner')) {
           if (playerHp < playerStats.maxHp * 0.3) {
                dmg *= 2;
                addToCombatLog("🪓 Executioner: DOUBLE DAMAGE!");
           }
      }

      if (Math.random() * 100 < activeMonster.critChance) { dmg *= BALANCE.COMBAT.critMultiplier; addToCombatLog("Enemy Crit!"); }
      
      let mit = playerStats.armor * 0.5;
      
      const stanceMult = BALANCE.COMBAT.stanceMultipliers[combatStance] || BALANCE.COMBAT.stanceMultipliers[CombatStance.BALANCED];
      mit *= stanceMult.mitigation;

      const final = Math.max(1, Math.floor(dmg - mit));
      
      // Check for Player Shield (Mana Shield)
      const playerShield = combatStatusEffects.find(e => e.target === 'player' && e.type === 'shield');
      let damageTaken = final;
      
      if (playerShield) {
          damageTaken = 0;
          addToCombatLog(`🛡️ Your shield absorbs the hit!`);
          setCombatStatusEffects(prev => prev.filter(e => !(e.target === 'player' && e.type === 'shield')));
      } else {
          setPlayerHp(p => p - damageTaken);
          processTriggers('onHit', 'enemy', damageTaken);
          processTriggers('onTakeDamage', 'player'); // Triggers reactive skills here
      }

      if (activeMonster.lifeSteal > 0 && damageTaken > 0) {
          const heal = Math.floor(damageTaken * (activeMonster.lifeSteal/100));
          setActiveMonster(p => p ? { ...p, currentHp: Math.min(p.maxHp, p.currentHp + heal) } : null);
      }

      if(damageTaken > 0) addToCombatLog(`${activeMonster.name} hits for ${damageTaken}.`);
      
      if (playerHp - damageTaken <= 0) handleDefeatInternal();
  };

  const handleVictoryInternal = (monster: Monster) => {
     onVictory(monster);
     setIsFighting(false);
     setActiveMonster(null);
     setCombatStatusEffects([]);
     setTurnQueue([]);
     setSkillCooldowns({});
  };

  const handleDefeatInternal = () => {
      onDefeat();
      setIsFighting(false);
      setActiveMonster(null);
      setTurnQueue([]);
      setCombatStatusEffects([]);
      setSkillCooldowns({});
  };

  const handleFlee = () => { 
      if (Math.random() < 0.5) { 
          setIsFighting(false); 
          setActiveMonster(null); 
          setTurnQueue([]); 
          addLog("Escaped!", 'combat'); 
      } else { 
          addToCombatLog("Failed to escape!"); 
          setTurnQueue(p => p.slice(1)); 
      } 
  };

  // --- COMBAT LOOP ---
  useEffect(() => {
    if (!isFighting || !activeMonster || !playerStats) return;
    if (turnQueue.length === 0) return;

    const currentActor = turnQueue[0];
    setIsPlayerTurn(currentActor === 'player');
    
    // Increment global turn counter for 'every X turns' logic logic
    if (currentActor === 'player') setTurnCount(prev => prev + 1);

    const timer = setTimeout(() => {
        if (!isFighting) return;

        if (currentActor === 'player') resolveCombatTurn();
        else executeEnemyTurn();
        
        setTurnQueue(prev => prev.slice(1));
    }, 1000); 

    return () => clearTimeout(timer);
  }, [isFighting, activeMonster, turnQueue, combatStance, playerHp]);

  return {
      battleState: {
          isFighting,
          activeMonster,
          turnQueue,
          isPlayerTurn,
          combatLog,
          combatStatusEffects,
          combatStance
      },
      battleActions: {
          startBattle,
          flee: handleFlee,
          setCombatStance
      }
  };
};

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Monster, PlayerStats, CombatStatusEffect, ActiveEffect, CombatStance, CombatTrigger, LogEntry } from '../types';
import { COMPOSITE_SYNERGIES, PASSIVE_SET_BONUSES } from '../constants';
import { BALANCE } from '../services/gameBalance';
import { generateCombatNarrative, generateEncounterDescription } from '../services/geminiService';

interface UseCombatEngineProps {
  playerStats: PlayerStats | null;
  playerHp: number;
  setPlayerHp: React.Dispatch<React.SetStateAction<number>>;
  onVictory: (monster: Monster) => void;
  onDefeat: () => void;
  addLog: (msg: string, type?: LogEntry['type']) => void;
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
        const existingIdx = next.findIndex(e => e.type === inc.type && e.target === inc.target);
        if (existingIdx >= 0) {
            const existing = next[existingIdx];
            // Determine if this effect type stacks
            const isHardCC = ['stun', 'freeze', 'shield'].includes(inc.type);
            
            next[existingIdx] = {
                ...existing,
                duration: inc.duration, // Refresh duration
                stacks: isHardCC ? 1 : existing.stacks + 1, // Hard CC/Shield doesn't stack intensity, just refreshes
                value: Math.max(existing.value, inc.value) // Take the stronger value
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
  addLog
}: UseCombatEngineProps) => {
  const [isFighting, setIsFighting] = useState(false);
  const [activeMonster, setActiveMonster] = useState<Monster | null>(null);
  const [combatLog, setCombatLog] = useState<string[]>([]);
  const [turnQueue, setTurnQueue] = useState<('player' | 'enemy')[]>([]);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [combatStance, setCombatStance] = useState<CombatStance>(CombatStance.BALANCED);
  const [combatStatusEffects, setCombatStatusEffects] = useState<CombatStatusEffect[]>([]);

  const addToCombatLog = (msg: string) => setCombatLog(prev => [...prev, msg]);

  // --- BATTLE START ---
  const startBattle = useCallback(async (monster: Monster, level: number) => {
    if (!playerStats) return;
    setActiveMonster(monster);
    setPlayerHp(playerStats.maxHp);
    setTurnQueue(generateTurnBatch(playerStats.dexterity, monster.dexterity));
    setCombatLog([`Encountered ${monster.name} (${monster.rarity})!`]);
    setCombatStatusEffects([]);
    setIsFighting(true);
    setCombatStance(CombatStance.BALANCED);
    
    generateEncounterDescription(monster, level).then(addToCombatLog);
  }, [playerStats, setPlayerHp]);

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

      // 1. PLAYER PASSIVES
      if (actor === 'player') {
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
              // Standard Trigger Check
              if (m.trigger === trigger) {
                  // Maledict Specific Logic Mapped from Type/ID
                  if (m.id === 'arcane' && m.triggerEffect?.type === 'reflect') {
                       newEffects.push({
                           id: `arcane-shield-${Date.now()}`,
                           type: 'shield',
                           name: 'Arcane Shield',
                           duration: 1,
                           value: 1,
                           stacks: 1,
                           source: 'maledict',
                           target: 'enemy',
                           description: 'Nullifies the next hit.'
                       });
                       addToCombatLog(`✨ ${m.name} activates!`);
                  }
                  else if (m.id === 'plague' && m.triggerEffect?.type === 'ground_hazard') {
                      newEffects.push({
                           id: `plague-${Date.now()}`,
                           type: 'poison',
                           name: 'Plague Cloud',
                           duration: 3,
                           value: m.triggerEffect.value,
                           stacks: 1,
                           source: 'maledict',
                           target: 'player',
                           description: 'Poisoned by the air.'
                       });
                       addToCombatLog(`🤢 ${m.name} surrounds you!`);
                  }
                  else if (m.triggerEffect && Math.random() < m.triggerEffect.chance) {
                       const eff = m.triggerEffect;
                       
                       if (eff.type === 'shuffle_turn') {
                           addToCombatLog(`⏳ ${m.name}: Time distorted! Turn queue shuffled.`);
                           setTurnQueue(prev => [...prev].sort(() => Math.random() - 0.5));
                       }
                       if (eff.type === 'debuff_player') {
                           newEffects.push({
                               id: Date.now() + Math.random().toString(),
                               type: 'burn', 
                               name: m.name,
                               duration: 3,
                               value: eff.value,
                               stacks: 1,
                               source: 'maledict',
                               target: 'player',
                               description: 'Burned by Molten skin'
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
                              id: Date.now() + Math.random().toString(),
                              type: 'burn',
                              name: m.name,
                              duration: 2,
                              value: m.triggerEffect.value,
                              stacks: 1,
                              source: 'maledict',
                              target: 'player'
                          });
                          addToCombatLog(`⚠️ ${m.name} reacts to your hit!`);
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
    if (activeMonster.thorns > 0 && !isShielded) { // Shield blocks hit, implies no contact damage? Assuming thorns requires damage.
        const thorn = Math.floor(playerStats.damage * (activeMonster.thorns / 100));
        setPlayerHp(p => p - thorn);
        addToCombatLog(`Thorns: Took ${thorn} dmg.`);
    }

    let rawDmg = playerStats.damage * (0.8 + Math.random() * 0.4);
    
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

    const isCrit = Math.random() * 100 < playerStats.critChance;
    if (isCrit) rawDmg *= critMult;

    const onAttackDmg = processTriggers('onAttack', 'player');
    monsterHp -= onAttackDmg;

    const mitigation = activeMonster.armor * 0.5;
    let dmg = Math.max(1, Math.floor(rawDmg - mitigation));
    
    // ARCANE SHIELD CHECK
    if (isShielded) {
        dmg = 0;
        addToCombatLog(`🚫 Blocked by ${activeMonster.name}'s Shield!`);
        // Remove shield
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

        if (playerStats.lifeSteal > 0) {
            const heal = Math.floor(dmg * (playerStats.lifeSteal / 100));
            setPlayerHp(p => Math.min(playerStats.maxHp, p + heal));
        }
    }

    // Create updated monster object for checking death
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

      const isDodge = Math.random() * 100 < playerStats.dodgeChance;
      if (isDodge) {
          addToCombatLog("DODGED!");
          return;
      }

      let dmg = activeMonster.damage * (0.8 + Math.random() * 0.4);
      
      // EXECUTIONER LOGIC
      if (activeMonster.maledicts.some(m => m.id === 'executioner')) {
           // Threshold check: 30% of max HP
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
      setPlayerHp(p => p - final);
      
      processTriggers('onHit', 'enemy', final);
      processTriggers('onTakeDamage', 'player');

      if (activeMonster.lifeSteal > 0) {
          const heal = Math.floor(final * (activeMonster.lifeSteal/100));
          setActiveMonster(p => p ? { ...p, currentHp: Math.min(p.maxHp, p.currentHp + heal) } : null);
      }

      addToCombatLog(`${activeMonster.name} hits for ${final}.`);
      
      if (playerHp - final <= 0) handleDefeatInternal();
  };

  const handleVictoryInternal = (monster: Monster) => {
     onVictory(monster);
     setIsFighting(false);
     setActiveMonster(null);
     setCombatStatusEffects([]);
     setTurnQueue([]);
  };

  const handleDefeatInternal = () => {
      onDefeat();
      setIsFighting(false);
      setActiveMonster(null);
      setTurnQueue([]);
      setCombatStatusEffects([]);
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

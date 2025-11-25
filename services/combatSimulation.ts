

import { Monster, PlayerStats, CombatStatusEffect, PassiveSkill, CombatStance, CombatTrigger } from '../types';
import { PASSIVE_SET_BONUSES, PASSIVE_SKILLS_POOL, COMPOSITE_SYNERGIES } from '../constants';
import { BALANCE } from './gameBalance';

interface SimulationResult {
    win: boolean;
    turns: number;
    finalPlayerHp: number;
    finalEnemyHp: number;
    damageDealt: number;
    damageTaken: number;
    log: string[];
}

export const SIMULATION_PRESETS = [
    {
        name: "Pyromancer (Glass Cannon)",
        theme: "Pyromancy",
        skills: ["magma_veins", "burning_rage", "inferno_touch", "forest_fire"]
    },
    {
        name: "Sentinel (Tank)",
        theme: "Sentinel",
        skills: ["iron_skin", "unyielding", "thorns_aura", "titans_gaze"]
    },
    {
        name: "Shadow Assassin (Crit/DoT)",
        theme: "Shadow",
        skills: ["venom_coating", "shadow_step", "void_hunger", "blood_rite"]
    },
    {
        name: "Cryomancer (Control)",
        theme: "Cryomancy",
        skills: ["glacial_ward", "crystalline_mind", "shatter_point", "static_discharge"]
    }
];

// Helper to clone stats to avoid mutating the actual game state during sim
const cloneStats = (stats: PlayerStats): PlayerStats => JSON.parse(JSON.stringify(stats));
const cloneMonster = (monster: Monster): Monster => JSON.parse(JSON.stringify(monster));

export const runSimulation = (
    baseStats: PlayerStats, 
    baseMonster: Monster, 
    iterations: number = 100
): { summary: any, results: SimulationResult[] } => {
    
    const results: SimulationResult[] = [];

    for (let i = 0; i < iterations; i++) {
        results.push(simulateSingleBattle(cloneStats(baseStats), cloneMonster(baseMonster)));
    }

    // Aggregate Data
    const wins = results.filter(r => r.win).length;
    const avgTurns = results.reduce((acc, r) => acc + r.turns, 0) / iterations;
    const avgDmgDealt = results.reduce((acc, r) => acc + r.damageDealt, 0) / iterations;
    const avgHpRemaining = results.reduce((acc, r) => acc + (r.win ? r.finalPlayerHp : 0), 0) / Math.max(1, wins);

    return {
        summary: {
            winRate: (wins / iterations) * 100,
            avgTurns: avgTurns.toFixed(1),
            avgDmgDealt: Math.floor(avgDmgDealt),
            avgHpRemaining: Math.floor(avgHpRemaining),
            rating: calculateBalanceRating((wins / iterations) * 100, avgTurns)
        },
        results
    };
};

const calculateBalanceRating = (winRate: number, avgTurns: number): string => {
    if (winRate < 10) return "Impossible (Buff Required)";
    if (winRate < 40) return "Hard / Unfair";
    if (winRate > 95 && avgTurns < 3) return "Broken OP (Nerf Required)";
    if (winRate > 90) return "Very Easy";
    return "Balanced";
};

// The Core Logic - deeply mirrors useCombatEngine.ts but without React state/effects
const simulateSingleBattle = (player: PlayerStats, monster: Monster): SimulationResult => {
    let playerHp = player.maxHp;
    let enemyHp = monster.maxHp;
    let turn = 0;
    let damageDealt = 0;
    let damageTaken = 0;
    let effects: CombatStatusEffect[] = [];
    let skillCooldowns: Record<string, number> = {};
    const log: string[] = [];

    // Helper for Turn Queue (Simplified for Sim)
    const { playerAttacks, enemyAttacks } = BALANCE.COMBAT.calculateTurns(player.dexterity, monster.dexterity);
    const queueSequence = [];
    for(let i=0; i<playerAttacks; i++) queueSequence.push('player');
    for(let i=0; i<enemyAttacks; i++) queueSequence.push('enemy');
    
    let queueIndex = 0;

    // --- HELPER FUNCTIONS ---
    
    const addEffect = (newEff: CombatStatusEffect) => {
        const existing = effects.find(e => e.type === newEff.type && e.target === newEff.target && e.name === newEff.name);
        if (existing) {
            existing.duration = newEff.duration;
            if (['stun', 'freeze', 'shield'].includes(newEff.type)) existing.stacks = 1;
            else if (newEff.type === 'scaling_strength') existing.value += newEff.value;
            else existing.stacks++;
        } else {
            effects.push(newEff);
        }
    };

    const processTriggers = (trigger: CombatTrigger, actor: 'player' | 'enemy', dmgVal: number = 0): number => {
        let triggerDmg = 0;

        if (actor === 'player') {
            // Skill Procs
            const skills = PASSIVE_SKILLS_POOL.filter(s => player.equippedSkillIds.includes(s.id));
            skills.forEach(skill => {
                if (skill.proc && skill.proc.trigger === trigger) {
                    if ((skillCooldowns[skill.id] || 0) > 0) return;
                    if (Math.random() > skill.proc.chance) return;
                    
                    // Conditions
                    if (skill.proc.conditions) {
                        const fail = skill.proc.conditions.some(c => {
                             if (c.type === 'hp_below') return (playerHp/player.maxHp) >= Number(c.value);
                             if (c.type === 'turn_count_multiple') return (turn % Number(c.value)) !== 0;
                             return false; 
                        });
                        if (fail) return;
                    }

                    // Cost
                    if (skill.proc.cost) {
                        const cost = skill.proc.cost.type === 'hp_percent' ? player.maxHp * skill.proc.cost.value : skill.proc.cost.value;
                        if (playerHp > cost) playerHp -= cost;
                        else return;
                    }

                    // Effect
                    const eff = skill.proc.effect;
                    if (eff.type === 'damage_phys' || eff.type === 'damage_magic') {
                        const d = Math.floor(player.damage * eff.value);
                        enemyHp -= d;
                        triggerDmg += d;
                    } else if (eff.type === 'multi_hit') {
                        // Multi Hit / Echo
                        const d = Math.floor(dmgVal * eff.value);
                        enemyHp -= d;
                        triggerDmg += d;
                    } else if (eff.type === 'heal') {
                        playerHp = Math.min(player.maxHp, playerHp + (player.maxHp * eff.value));
                    } else if (eff.type === 'cleanse') {
                        effects = effects.filter(e => e.target !== 'player' || !['burn','poison','freeze','blind','chill','stun'].includes(e.type));
                    } else if (eff.type === 'shield') {
                        addEffect({ id: 'sim', type: 'shield', name: skill.name, duration: eff.duration||1, value: eff.value, stacks: 1, source: 'skill', target: 'player' });
                    } else if (eff.type === 'buff' || eff.type === 'debuff') {
                         addEffect({ 
                             id: 'sim', 
                             type: (eff.subType || 'buff') as any, 
                             name: skill.name, 
                             duration: eff.duration||3, 
                             value: eff.value, 
                             stacks: 1, 
                             source: 'skill', 
                             target: eff.type === 'debuff' ? 'enemy' : 'player' 
                         });
                    }

                    if (skill.proc.cooldown) skillCooldowns[skill.id] = skill.proc.cooldown;
                }
            });

            // Set Bonuses
            player.activeSetBonuses.forEach(theme => {
                const bonus = PASSIVE_SET_BONUSES.find(b => b.theme === theme);
                if (bonus && bonus.triggerCondition === trigger && Math.random() < bonus.procChance) {
                    addEffect({
                        id: 'sim', type: bonus.procEffect.type, name: bonus.name, duration: bonus.procEffect.duration,
                        value: bonus.procEffect.value, stacks: 1, source: 'set_bonus',
                        target: ['regen','crit_boost'].includes(bonus.procEffect.type) ? 'player' : 'enemy'
                    });
                }
            });
        } 
        else if (actor === 'enemy') {
            monster.maledicts.forEach(m => {
                if (m.trigger === trigger && m.triggerEffect) {
                     if (m.triggerEffect.type === 'reflect' && m.id === 'arcane') {
                         addEffect({ id: 'sim', type: 'shield', name: 'Arcane Shield', duration: 1, value: 1, stacks: 1, source: 'maledict', target: 'enemy'});
                     }
                }
            });
        }
        return triggerDmg;
    };

    const processStatusEffects = (target: 'player' | 'enemy') => {
        const targetEffects = effects.filter(e => e.target === target);
        const maxHp = target === 'player' ? player.maxHp : monster.maxHp;
        
        targetEffects.forEach(e => {
            if (e.type === 'burn' || e.type === 'poison') {
                const dmg = Math.floor(maxHp * e.value * e.stacks);
                if (target === 'player') playerHp -= dmg; else enemyHp -= dmg;
            }
            if (e.type === 'regen') {
                const heal = Math.floor(maxHp * e.value * e.stacks);
                if (target === 'player') playerHp += heal; else enemyHp += heal;
            }
        });
        
        // Decrement durations
        effects = effects.map(e => e.target === target ? { ...e, duration: e.duration - 1 } : e).filter(e => e.duration > 0);
    };

    // --- MAIN LOOP ---

    while (playerHp > 0 && enemyHp > 0 && turn < 100) {
        const actor = queueSequence[queueIndex];
        
        // Cooldowns tick
        if (actor === 'player') {
            turn++;
            Object.keys(skillCooldowns).forEach(k => { if(skillCooldowns[k] > 0) skillCooldowns[k]--; });
        }

        // CC Check
        const isStunned = effects.some(e => e.target === actor && (e.type === 'stun' || e.type === 'freeze'));
        
        if (!isStunned) {
            processTriggers('onStartTurn', actor);
            processStatusEffects(actor); // DoTs happen here

            if (playerHp <= 0 || enemyHp <= 0) break;

            if (actor === 'player') {
                // PLAYER ACTION
                let rawDmg = player.damage;
                
                // Buffs
                const scaling = effects.find(e => e.target === 'player' && e.type === 'scaling_strength');
                if (scaling) rawDmg += scaling.value;

                // Crits
                let critChance = player.critChance;
                const critBoost = effects.find(e => e.target === 'player' && e.type === 'crit_boost');
                if (critBoost) critChance += critBoost.value;

                const isCrit = Math.random() * 100 < critChance;
                if (isCrit) rawDmg *= BALANCE.COMBAT.critMultiplier;

                // Enemy Mitigation
                const isShielded = effects.some(e => e.target === 'enemy' && e.type === 'shield');
                if (isShielded) {
                    rawDmg = 0;
                    effects = effects.filter(e => !(e.target === 'enemy' && e.type === 'shield'));
                } else {
                    rawDmg -= (monster.armor * 0.5);
                }

                const finalDmg = Math.max(1, Math.floor(rawDmg));
                enemyHp -= finalDmg;
                damageDealt += finalDmg;

                // On Hit Triggers
                if (finalDmg > 0) {
                    enemyHp -= processTriggers('onHit', 'player', finalDmg);
                    if (isCrit) processTriggers('onCrit', 'player', finalDmg);
                    
                    // Lifesteal
                    if (player.lifeSteal > 0) {
                        playerHp = Math.min(player.maxHp, playerHp + (finalDmg * (player.lifeSteal/100)));
                    }
                }

            } else {
                // ENEMY ACTION
                let dmg = monster.damage;
                if (Math.random() * 100 < monster.critChance) dmg *= BALANCE.COMBAT.critMultiplier;
                
                // Player Dodge (Check for Buffs like Void Form)
                let dodgeChance = player.dodgeChance;
                const dodgeBoost = effects.find(e => e.target === 'player' && e.type === 'dodge_boost');
                if (dodgeBoost) dodgeChance += dodgeBoost.value;

                if (Math.random() * 100 < dodgeChance) {
                    // Dodged
                } else {
                    const isShielded = effects.some(e => e.target === 'player' && e.type === 'shield');
                    if (isShielded) {
                        dmg = 0;
                        effects = effects.filter(e => !(e.target === 'player' && e.type === 'shield'));
                    } else {
                        dmg -= (player.armor * 0.5);
                    }
                    
                    const finalDmg = Math.max(1, Math.floor(dmg));
                    playerHp -= finalDmg;
                    damageTaken += finalDmg;

                    if (finalDmg > 0) {
                        processTriggers('onTakeDamage', 'player', finalDmg);
                    }
                }
            }
        } else {
            // Stunned logic (just process DoTs which happened above)
        }

        queueIndex = (queueIndex + 1) % queueSequence.length;
    }

    return {
        win: playerHp > 0,
        turns: turn,
        finalPlayerHp: Math.max(0, playerHp),
        finalEnemyHp: Math.max(0, enemyHp),
        damageDealt,
        damageTaken,
        log
    };
};
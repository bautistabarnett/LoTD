
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Item, ItemSlot, PlayerStats, EquipmentMap, LogEntry, Rarity, Monster, BaseAttributes, PassiveSkill, MapNode, ExplorationEvent, ActiveEffect, EventType, CombatStatusEffect, CombatStance, MonsterRarity, CombatTrigger, SaveData } from './types';
import { generateLoot, calculatePlayerStats, generateMonster, generatePassiveSkill, calculateItemValue } from './services/gameLogic';
import { identifyItemWithGemini, generateEncounterDescription, generatePassiveLore, generateCombatNarrative } from './services/geminiService';
import { RARITY_COLORS, SLOT_ICONS, MAX_INVENTORY_SIZE, INITIAL_WORLD_MAP, EXPLORATION_EVENTS, PASSIVE_SET_BONUSES, COMPOSITE_SYNERGIES } from './constants';
import { BALANCE } from './services/gameBalance';
import { storageService } from './services/storageService';
import InventorySlot from './components/InventorySlot';
import Tooltip from './components/Tooltip';
import CombatModal from './components/CombatModal';
import LevelUpModal from './components/LevelUpModal';
import GameIcon from './components/GameIcon';
import WorldMapModal from './components/WorldMapModal';
import EventModal from './components/EventModal';
import SmugglingModal from './components/SmugglingModal';
import SkillsModal from './components/SkillsModal';
import StatsModal from './components/StatsModal';
import VisualizerModal from './components/VisualizerModal';
import { MainMenu } from './components/MainMenu';
import SystemModal from './components/SystemModal';
import { useCombatEngine, generateTurnBatch } from './hooks/useCombatEngine';

type MobileTab = 'hero' | 'adventure' | 'merchant';
type GameStatus = 'MENU' | 'PLAYING';

export default function App() {
  const [gameStatus, setGameStatus] = useState<GameStatus>('MENU');
  const [currentSlotId, setCurrentSlotId] = useState<number>(1);
  
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [gold, setGold] = useState(0);
  const [baseAttributes, setBaseAttributes] = useState<BaseAttributes>({
    strength: BALANCE.STATS.base.strength, dexterity: BALANCE.STATS.base.dexterity,
    intelligence: BALANCE.STATS.base.intelligence, vitality: BALANCE.STATS.base.vitality
  });
  const [statPoints, setStatPoints] = useState(0);
  const [passiveSkills, setPassiveSkills] = useState<PassiveSkill[]>([]);
  const [activeEffects, setActiveEffects] = useState<ActiveEffect[]>([]);
  const [currentEvent, setCurrentEvent] = useState<ExplorationEvent | null>(null);
  const [inventory, setInventory] = useState<(Item | null)[]>(Array(MAX_INVENTORY_SIZE).fill(null));
  const [equipment, setEquipment] = useState<EquipmentMap>({});
  
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [groundItems, setGroundItems] = useState<Item[]>([]);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [merchantStock, setMerchantStock] = useState<Item[]>([]);
  const [merchantMode, setMerchantMode] = useState<'buy' | 'sell'>('sell');
  const [sellStaging, setSellStaging] = useState<Item[]>([]);
  const [worldDifficulty, setWorldDifficulty] = useState(1.0);
  const [mapNodes, setMapNodes] = useState<MapNode[]>(INITIAL_WORLD_MAP);
  const [currentAreaId, setCurrentAreaId] = useState<string>('town');
  const [areaProgress, setAreaProgress] = useState<number>(0); 
  
  const [showMapModal, setShowMapModal] = useState(false);
  const [showSmugglingModal, setShowSmugglingModal] = useState(false);
  const [showSkillsModal, setShowSkillsModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showSystemModal, setShowSystemModal] = useState(false);

  const [isVisualizeMode, setIsVisualizeMode] = useState(false);
  const [visualizingItem, setVisualizingItem] = useState<Item | null>(null);
  const [isVisualizingHero, setIsVisualizingHero] = useState(false);
  const [isUIBlocked, setIsUIBlocked] = useState(false);
  const [playerCurrentHp, setPlayerCurrentHp] = useState(100);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [lastGainedPassive, setLastGainedPassive] = useState<{ skill: PassiveSkill, isNew: boolean } | null>(null);
  const [passiveFlavorText, setPassiveFlavorText] = useState<string>("");
  const [hoverItem, setHoverItem] = useState<Item | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [heroImageUrl, setHeroImageUrl] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<MobileTab>('adventure');

  // --- SAVE / LOAD LOGIC ---
  const handleSaveGame = useCallback(() => {
      const saveData: SaveData = {
          level, xp, gold, baseAttributes, statPoints, passiveSkills, activeEffects,
          inventory, equipment, mapNodes, currentAreaId, areaProgress, worldDifficulty,
          merchantStock, groundItems, heroImageUrl, timestamp: Date.now()
      };
      storageService.saveGame(currentSlotId, saveData);
      addLog("Game Saved.", 'system');
  }, [level, xp, gold, baseAttributes, statPoints, passiveSkills, activeEffects, inventory, equipment, mapNodes, currentAreaId, areaProgress, worldDifficulty, merchantStock, groundItems, heroImageUrl, currentSlotId]);

  const handleLoadGame = useCallback((slotId: number) => {
      const data = storageService.loadGame(slotId);
      if (!data) return;
      
      setLevel(data.level);
      setXp(data.xp);
      setGold(data.gold);
      setBaseAttributes(data.baseAttributes);
      setStatPoints(data.statPoints);
      setPassiveSkills(data.passiveSkills);
      setActiveEffects(data.activeEffects);
      setInventory(data.inventory);
      setEquipment(data.equipment);
      setMapNodes(data.mapNodes);
      setCurrentAreaId(data.currentAreaId);
      setAreaProgress(data.areaProgress);
      setWorldDifficulty(data.worldDifficulty);
      setMerchantStock(data.merchantStock);
      setGroundItems(data.groundItems);
      setHeroImageUrl(data.heroImageUrl);
      
      setCurrentSlotId(slotId);
      setGameStatus('PLAYING');
  }, []);

  const handleStartNewGame = useCallback((slotId: number) => {
      // Reset all state to defaults
      setLevel(1);
      setXp(0);
      setGold(0);
      setBaseAttributes({
        strength: BALANCE.STATS.base.strength, dexterity: BALANCE.STATS.base.dexterity,
        intelligence: BALANCE.STATS.base.intelligence, vitality: BALANCE.STATS.base.vitality
      });
      setStatPoints(0);
      setPassiveSkills([]);
      setActiveEffects([]);
      setInventory(Array(MAX_INVENTORY_SIZE).fill(null));
      setEquipment({});
      setMapNodes(INITIAL_WORLD_MAP);
      setCurrentAreaId('town');
      setAreaProgress(0);
      setWorldDifficulty(1.0);
      setGroundItems([]);
      setHeroImageUrl(undefined);
      setLogs([]);
      
      // Generate fresh merchant stock
      const s = []; 
      for(let i=0; i<4; i++) { 
          const it = generateLoot(1); 
          if(it) { it.isIdentified = true; s.push(it); } 
      } 
      setMerchantStock(s);

      setCurrentSlotId(slotId);
      setGameStatus('PLAYING');
      
      // Initial Save
      setTimeout(() => {
           const initialSave: SaveData = {
              level: 1, xp: 0, gold: 0, 
              baseAttributes: { strength: BALANCE.STATS.base.strength, dexterity: BALANCE.STATS.base.dexterity, intelligence: BALANCE.STATS.base.intelligence, vitality: BALANCE.STATS.base.vitality },
              statPoints: 0, passiveSkills: [], activeEffects: [], inventory: Array(MAX_INVENTORY_SIZE).fill(null), equipment: {}, 
              mapNodes: INITIAL_WORLD_MAP, currentAreaId: 'town', areaProgress: 0, worldDifficulty: 1.0, merchantStock: s, groundItems: [], timestamp: Date.now()
           };
           storageService.saveGame(slotId, initialSave);
      }, 100);
  }, []);

  // --- MEMOIZED STATS ---
  const derivedStats = useMemo(() => {
    return calculatePlayerStats(
      baseAttributes, 
      equipment, 
      passiveSkills, 
      level, 
      statPoints, 
      activeEffects
    );
  }, [baseAttributes, equipment, passiveSkills, level, statPoints, activeEffects]);

  const stats: PlayerStats = useMemo(() => ({
    ...derivedStats,
    xp,
    xpToNextLevel: level * 100,
    gold,
    heroImageUrl
  }), [derivedStats, xp, level, gold, heroImageUrl]);

  // --- HELPERS ---
  const addLog = useCallback((msg: string, type: LogEntry['type'] = 'system') => {
      setLogs(prev => [{ id: Date.now(), message: msg, type, timestamp: Date.now() }, ...prev].slice(30));
  }, []);

  const addToInventory = useCallback((item: Item): boolean => {
    let success = false;
    setInventory(prev => {
        const idx = prev.findIndex(i => i === null);
        if (idx !== -1) {
            const n = [...prev];
            n[idx] = item;
            success = true;
            return n;
        }
        return prev;
    });
    
    const idx = inventory.findIndex(i => i === null);
    if (idx !== -1) {
         addLog(`Picked up: ${item.name}`, 'loot');
         return true;
    }
    addLog("Inventory is full!", 'system');
    return false;
  }, [inventory, addLog]);

  const handleLevelUp = useCallback((overflowXp: number) => {
    const newLevel = level + 1; 
    setLevel(newLevel); 
    setXp(overflowXp); 
    setStatPoints(prev => prev + BALANCE.STATS.perLevel.statPoints);
    
    const res = generatePassiveSkill(passiveSkills); 
    setLastGainedPassive(res);
    setPassiveFlavorText("..."); 
    generatePassiveLore(res.skill).then(setPassiveFlavorText);
    
    if (res.isNew) setPassiveSkills(prev => [...prev, res.skill]);
    else setPassiveSkills(prev => prev.map(p => p.id === res.skill.id ? res.skill : p));
    
    addLog(`Level Up! ${newLevel}`, 'system'); 
    setShowLevelUpModal(true);
  }, [level, passiveSkills, addLog]);

  // --- CALLBACKS FOR COMBAT ENGINE ---
  const onVictory = useCallback((monster: Monster) => {
     const conf = BALANCE.MONSTER.rarityConfig[monster.rarity];
     const xpG = Math.floor((20 + level * 5) * conf.xpMult);
     const goldG = Math.floor((Math.random() * 50 + level * 10) * conf.goldMult);
     
     setWorldDifficulty(p => Math.min(3.5, p + (monster.rarity === MonsterRarity.UNIQUE ? 0.05 : 0.02)));
     setGold(p => p + goldG);
     addLog(`Slain ${monster.name}! +${xpG} XP`, 'combat');
     
     // Update Active Effects: Decrement duration and remove if expired
     const nextActiveEffects: ActiveEffect[] = [];
     activeEffects.forEach(eff => {
         if (eff.duration > 1) {
             nextActiveEffects.push({ ...eff, duration: eff.duration - 1 });
         } else {
             addLog(`${eff.name} has faded.`, 'system');
         }
     });
     setActiveEffects(nextActiveEffects);
     
     const nStock: Item[] = [];
     for(let i=0; i<2; i++) { 
         const it = generateLoot(level, worldDifficulty * 1.2); 
         if (it) { it.isIdentified = true; nStock.push(it); } 
     }
     setMerchantStock(p => [...p, ...nStock].slice(-8));

     const area = mapNodes.find(n => n.id === currentAreaId)!;
     if (!area.isCleared) {
         if (monster.rarity === MonsterRarity.UNIQUE && monster.name.includes('Overlord')) {
             setMapNodes(prev => prev.map(n => n.id === area.id ? { ...n, isCleared: true } : area.connections.includes(n.id) ? { ...n, isUnlocked: true } : n));
             addLog("Area Cleared!", 'system');
         } else setAreaProgress(p => Math.min(100, p + (monster.rarity === MonsterRarity.MYTHIC ? 40 : 10)));
     }
     
     if (xp + xpG >= level * 100) handleLevelUp(xp + xpG - level * 100); else setXp(p => p + xpG);
     
     const drops: Item[] = [];
     const rolls = monster.rarity === MonsterRarity.UNIQUE ? 5 : monster.rarity === MonsterRarity.RARE ? 2 : 1;
     for(let i=0; i<rolls; i++) { 
         const l = generateLoot(level, worldDifficulty * conf.statMult, stats.magicFind || 0); 
         if (l) drops.push(l); 
     }
     if (drops.length) setGroundItems(p => [...p, ...drops]);
  }, [level, worldDifficulty, mapNodes, currentAreaId, xp, stats, handleLevelUp, addLog, activeEffects]);

  const onDefeat = useCallback(() => {
      addLog("You have fallen...", 'combat');
      setGold(p => Math.floor(p * 0.8)); setXp(p => Math.floor(p * 0.5));
      setWorldDifficulty(p => Math.max(0.6, p - 0.15));
      setPlayerCurrentHp(1);

      // Decrement durations on defeat as well (end of battle)
      const nextActiveEffects: ActiveEffect[] = [];
      activeEffects.forEach(eff => {
         if (eff.duration > 1) {
             nextActiveEffects.push({ ...eff, duration: eff.duration - 1 });
         } else {
             addLog(`${eff.name} has faded.`, 'system');
         }
      });
      setActiveEffects(nextActiveEffects);
  }, [addLog, activeEffects]);

  const { battleState, battleActions } = useCombatEngine({
      playerStats: stats,
      playerHp: playerCurrentHp,
      setPlayerHp: setPlayerCurrentHp,
      onVictory,
      onDefeat,
      addLog
  });

  useEffect(() => {
    if (!battleState.isFighting) {
        setPlayerCurrentHp(prev => Math.min(prev, stats.maxHp));
    }
  }, [stats.maxHp, battleState.isFighting]);

  useEffect(() => {
      const anyModalOpen = showMapModal || showSmugglingModal || showSkillsModal || showLevelUpModal || showStatsModal || !!currentEvent || !!visualizingItem || isVisualizingHero || showSystemModal;
      setIsUIBlocked(anyModalOpen);
  }, [showMapModal, showSmugglingModal, showSkillsModal, showLevelUpModal, showStatsModal, currentEvent, visualizingItem, isVisualizingHero, showSystemModal]);

  const handleDragStart = useCallback((e: React.DragEvent, source: 'inventory' | 'equipment' | 'sell', index: number | string) => {
    if (isUIBlocked || isVisualizeMode) { e.preventDefault(); return; }
    e.dataTransfer.setData('application/json', JSON.stringify({ source, index }));
    e.dataTransfer.effectAllowed = 'move';
    setHoverItem(null); 
  }, [isUIBlocked, isVisualizeMode]);

  const handleDragOver = useCallback((e: React.DragEvent) => e.preventDefault(), []);

  const moveItemToInventory = useCallback((item: Item, source: string, sourceIndex: number | string, targetIndex: number) => {
    const newInv = [...inventory]; const targetItem = newInv[targetIndex];
    if (source === 'inventory') newInv[sourceIndex as number] = null;
    if (source === 'equipment') { 
        setEquipment(prev => {
            const n = { ...prev }; 
            delete n[sourceIndex as ItemSlot]; 
            return n;
        }); 
    }
    
    if (targetItem) {
      if (source === 'inventory') { 
          newInv[sourceIndex as number] = targetItem; 
          newInv[targetIndex] = item; 
      }
      else if (source === 'equipment') {
         if (targetItem.type === (sourceIndex as ItemSlot)) { 
             setEquipment(prev => ({ ...prev, [sourceIndex as string]: targetItem })); 
             newInv[targetIndex] = item; 
         }
         else { 
             if (source === 'equipment') setEquipment(prev => ({ ...prev, [sourceIndex as string]: item })); 
             return; 
         }
      }
    } else {
        newInv[targetIndex] = item;
    }
    setInventory(newInv);
  }, [inventory]);

  const moveItemToEquipment = useCallback((item: Item, source: string, sourceIndex: number | string, targetSlot: ItemSlot) => {
    if (item.type !== targetSlot) return;
    const currentEquipped = equipment[targetSlot];
    setEquipment(prev => ({ ...prev, [targetSlot]: item }));
    
    if (source === 'inventory') { 
        const n = [...inventory]; 
        n[sourceIndex as number] = currentEquipped || null; 
        setInventory(n); 
    }
    else if (source === 'equipment' && sourceIndex !== targetSlot) {
        setEquipment(prev => {
            const n = { ...prev }; 
            delete n[sourceIndex as ItemSlot]; 
            n[targetSlot] = item;
            return n;
        });
        if (currentEquipped) addToInventory(currentEquipped); 
    }
    addLog(`Equipped ${item.name}`, 'system');
  }, [equipment, inventory, addToInventory, addLog]);

  const moveItemToSell = useCallback((item: Item, source: string, sourceIndex: number | string) => {
      if (source === 'sell') return;
      setSellStaging(prev => [...prev, item]);
      if (source === 'inventory') { 
          const n = [...inventory]; 
          n[sourceIndex as number] = null; 
          setInventory(n); 
      }
      else if (source === 'equipment') { 
          setEquipment(prev => {
              const n = { ...prev }; 
              delete n[sourceIndex as ItemSlot]; 
              return n;
          });
      }
  }, [inventory]);

  const handleDrop = useCallback((e: React.DragEvent, targetContext: 'inventory' | 'equipment' | 'sell', targetIndex?: number | string) => {
    e.preventDefault();
    if (isUIBlocked || isVisualizeMode) return;
    const json = e.dataTransfer.getData('application/json');
    if (!json) return;
    const { source, index } = JSON.parse(json);
    let item: Item | null = null;
    if (source === 'inventory') item = inventory[index as number];
    else if (source === 'equipment') item = equipment[index as ItemSlot] || null;
    else if (source === 'sell') item = sellStaging[index as number];
    if (!item) return;

    if (targetContext === 'inventory') {
        if (source === 'sell') {
             const newSell = [...sellStaging]; newSell.splice(index as number, 1); setSellStaging(newSell);
             const newInv = [...inventory];
             if (typeof targetIndex === 'number' && !newInv[targetIndex]) newInv[targetIndex] = item;
             else { const empty = newInv.findIndex(x => x === null); if (empty !== -1) newInv[empty] = item; else { setSellStaging(prev => [...prev, item as Item]); return; } }
             setInventory(newInv);
        } else moveItemToInventory(item, source, index, targetIndex as number);
    } else if (targetContext === 'equipment') {
       if (source === 'sell') return; 
       moveItemToEquipment(item, source, index, targetIndex as ItemSlot);
    } else if (targetContext === 'sell' && merchantMode === 'sell') moveItemToSell(item, source, index);
  }, [isUIBlocked, isVisualizeMode, inventory, equipment, sellStaging, merchantMode, moveItemToInventory, moveItemToEquipment, moveItemToSell]);
  
  const handleConfirmSell = useCallback(() => {
      if (sellStaging.length === 0) return;
      const val = sellStaging.reduce((sum, i) => sum + calculateItemValue(i), 0);
      setGold(prev => prev + val); 
      addLog(`Sold ${sellStaging.length} items for ${val}g`, 'loot'); 
      setSellStaging([]);
  }, [sellStaging, addLog]);

  const handleBuyItem = useCallback((item: Item, idx: number) => {
      const price = calculateItemValue(item) * BALANCE.ITEM_VALUE.buyMarkup;
      if (gold < price) { addLog("Not enough gold!", 'system'); return; }
      if (addToInventory(item)) { 
          setGold(prev => prev - price); 
          setMerchantStock(prev => {
              const n = [...prev]; 
              n.splice(idx, 1); 
              return n;
          });
      }
  }, [gold, addToInventory, addLog]);

  const handleAllocatePoint = useCallback((attr: keyof BaseAttributes) => {
    if (statPoints > 0) { 
        setBaseAttributes(prev => ({ ...prev, [attr]: prev[attr] + 1 })); 
        setStatPoints(prev => prev - 1); 
    }
  }, [statPoints]);

  const handleTravel = useCallback((id: string) => {
    const node = mapNodes.find(n => n.id === id);
    if (node && node.isUnlocked) { 
        setCurrentAreaId(id); 
        setAreaProgress(node.isCleared ? 100 : 0); 
        setShowMapModal(false); 
    }
  }, [mapNodes]);

  const triggerRandomEvent = useCallback(() => {
    const event = EXPLORATION_EVENTS[Math.floor(Math.random() * EXPLORATION_EVENTS.length)];
    setCurrentEvent(event);
    if (event.effect.goldMin) { 
        const amt = Math.floor(Math.random() * (event.effect.goldMax! - event.effect.goldMin + 1)) + event.effect.goldMin; 
        setGold(p => p + amt); 
    }
    if (event.effect.itemChance && Math.random() < event.effect.itemChance) { 
        const loot = generateLoot(level, 1, (stats.magicFind || 0) + 20); 
        if (loot) addToInventory(loot); 
    }
    if (event.effect.hpLossPercent) {
        setPlayerCurrentHp(p => Math.max(1, p - Math.floor(stats.maxHp * event.effect.hpLossPercent!)));
    }
    if (event.effect.xpMultiplier) { 
        const gain = Math.floor(stats.xpToNextLevel * event.effect.xpMultiplier * 0.1); 
        const n = xp + gain; 
        if (n >= level * 100) handleLevelUp(n - level * 100); else setXp(n); 
    }
    if (event.effect.statType) { 
        setActiveEffects(p => [...p, { id: Date.now().toString(), name: event.title, description: event.description, statType: event.effect.statType, value: event.effect.value || 0, duration: event.effect.duration!, isDebuff: (event.effect.value||0) < 0, icon: event.icon }]); 
    }
  }, [level, xp, stats, handleLevelUp, addToInventory]);

  const handleExplore = useCallback(async () => {
    if (battleState.isFighting || isUIBlocked || !stats) return;
    setGroundItems([]);
    const area = mapNodes.find(n => n.id === currentAreaId)!;
    const isBoss = areaProgress >= 100 && !area.isCleared;
    if (!isBoss && Math.random() < 0.20) { triggerRandomEvent(); return; }
    
    const diff = isBoss ? worldDifficulty * 1.5 : worldDifficulty;
    const monster = generateMonster(Math.max(area.level, Math.floor((level + area.level)/2)), diff);
    if (isBoss) { monster.rarity = MonsterRarity.UNIQUE; monster.name = `Overlord of ${area.name}`; monster.icon = 'boss'; monster.maxHp *= 2; monster.currentHp = monster.maxHp; }
    
    battleActions.startBattle(monster, level);
  }, [battleState.isFighting, isUIBlocked, stats, mapNodes, currentAreaId, areaProgress, worldDifficulty, level, battleActions, triggerRandomEvent]);

  const handleIdentifyAll = useCallback(async () => {
      const unID = inventory.filter(i => i && !i.isIdentified) as Item[];
      if (!unID.length) return;
      const cost = unID.reduce((s, i) => s + BALANCE.COSTS.identify[i.rarity], 0);
      if (gold < cost) { addLog("Not enough gold", 'system'); return; }
      setIsIdentifying(true);
      const nInv = [...inventory];
      for (let i=0; i<nInv.length; i++) {
          const it = nInv[i];
          if (it && !it.isIdentified) {
              try { const res = await identifyItemWithGemini(it); nInv[i] = { ...it, ...res, isIdentified: true }; }
              catch { nInv[i] = { ...it, isIdentified: true, name: it.name.replace('Unidentified ', '') }; }
          }
      }
      setInventory(nInv); setGold(p => p - cost); setIsIdentifying(false);
  }, [inventory, gold, addLog]);

  const handleEquip = useCallback((item: Item, idx: number) => { 
      if (isVisualizeMode) { setVisualizingItem(item); return; } 
      if (!item.isIdentified) return; 
      moveItemToEquipment(item, 'inventory', idx, item.type); 
  }, [isVisualizeMode, moveItemToEquipment]);

  const handleUnequip = useCallback((slot: ItemSlot) => { 
      const i = equipment[slot]; 
      if (!i) return; 
      if (isVisualizeMode) { setVisualizingItem(i); return; } 
      if (addToInventory(i)) { 
          setEquipment(prev => {
              const n = { ...prev }; 
              delete n[slot]; 
              return n;
          });
      } 
  }, [equipment, isVisualizeMode, addToInventory]);

  const handleSaveVisual = useCallback((url: string) => { 
      if (isVisualizingHero) { 
          setHeroImageUrl(url); 
          setIsVisualizingHero(false); 
      } else if (visualizingItem) { 
          const n = { ...visualizingItem, imageUrl: url }; 
          if (equipment[n.type]?.id === n.id) {
              setEquipment(p => ({ ...p, [n.type]: n })); 
          } else { 
              const idx = inventory.findIndex(x => x?.id === n.id); 
              if (idx !== -1) { 
                  setInventory(prev => {
                      const inv = [...prev]; 
                      inv[idx] = n; 
                      return inv;
                  }); 
              } 
          } 
          setVisualizingItem(null); 
      } 
  }, [isVisualizingHero, visualizingItem, equipment, inventory]);

  const threat = (diff: number) => {
      if (diff < 0.8) return { text: "Feeble", color: "text-green-400" };
      if (diff < 1.1) return { text: "Normal", color: "text-stone-400" };
      if (diff < 1.5) return { text: "Dangerous", color: "text-yellow-500" };
      if (diff < 2.0) return { text: "Torment", color: "text-orange-500" };
      return { text: "Hell", color: "text-red-600" };
  };
  const area = mapNodes.find(n => n.id === currentAreaId)!;
  const unIDCount = inventory.filter(i => i && !i.isIdentified).length;
  const IDCost = inventory.reduce((s, i) => (i && !i.isIdentified ? s + BALANCE.COSTS.identify[i.rarity] : s), 0);
  const sellVal = sellStaging.reduce((s, i) => s + calculateItemValue(i), 0);
  
  const renderEquipSlot = (slot: ItemSlot) => {
      const item = equipment[slot];
      return (
          <div className="flex flex-col items-center relative group" onClick={() => handleUnequip(slot)} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 'equipment', slot)}>
              <div className={`w-12 h-12 border rounded-[4px] ${item ? (item.rarity === 'Unique' ? 'border-amber-500' : 'border-stone-600') : 'border-stone-800 bg-[#0a0a0a]'} flex items-center justify-center relative shadow-inner transition-all hover:border-stone-400`}>
                 {item ? <GameIcon name={item.icon} imageUrl={item.imageUrl} className={`w-8 h-8 ${RARITY_COLORS[item.rarity]}`} /> : <GameIcon name={SLOT_ICONS[slot]} className="w-6 h-6 opacity-20 text-stone-500" />}
              </div>
          </div>
      );
  };

  if (gameStatus === 'MENU') {
      return (
          <MainMenu 
            onStartGame={(slotId, isNew) => {
                if (isNew) handleStartNewGame(slotId);
                else handleLoadGame(slotId);
            }}
          />
      );
  }

  // Main 1280x720 Fixed Ratio Container
  return (
    <div className="relative w-full h-full max-w-[1280px] max-h-[720px] aspect-video bg-[#0c0a09] shadow-2xl overflow-hidden grid grid-cols-12 panel-border">
      {hoverItem && <Tooltip item={hoverItem} comparedItem={equipment[hoverItem.type]} position={cursorPos} />}
      {currentEvent && <EventModal event={currentEvent} onClose={() => setCurrentEvent(null)} />}
      {showLevelUpModal && lastGainedPassive && <LevelUpModal newPassive={lastGainedPassive.skill} isUpgrade={!lastGainedPassive.isNew} pointsAvailable={statPoints} baseAttributes={baseAttributes} flavorText={passiveFlavorText} onAllocate={handleAllocatePoint} onClose={() => setShowLevelUpModal(false)} />}
      {showMapModal && <WorldMapModal nodes={mapNodes} currentNodeId={currentAreaId} areaProgress={areaProgress} onTravel={handleTravel} onClose={() => setShowMapModal(false)} />}
      {showSmugglingModal && <SmugglingModal gold={gold} onPurchase={(c) => setGold(p => p - c)} onGenerateLoot={(d) => generateLoot(level, d, stats.magicFind||0)} onClose={() => setShowSmugglingModal(false)} addToInventory={addToInventory} />}
      {showSkillsModal && <SkillsModal passiveSkills={passiveSkills} activeEffects={activeEffects} onClose={() => setShowSkillsModal(false)} />}
      {showStatsModal && <StatsModal stats={stats} baseAttributes={baseAttributes} statPoints={statPoints} passiveSkills={passiveSkills} onAllocate={handleAllocatePoint} onClose={() => setShowStatsModal(false)} />}
      {(visualizingItem || isVisualizingHero) && <VisualizerModal target={isVisualizingHero ? { name: "Hero", type: "Hero", imageUrl: heroImageUrl, icon: "hero" } : visualizingItem} onSave={handleSaveVisual} onClose={() => { setVisualizingItem(null); setIsVisualizingHero(false); }} />}
      {showSystemModal && <SystemModal currentSlotId={currentSlotId} onSave={handleSaveGame} onQuit={() => setGameStatus('MENU')} onClose={() => setShowSystemModal(false)} />}
      
      {battleState.isFighting && battleState.activeMonster && stats && (
          <CombatModal 
            playerStats={stats} 
            playerHp={playerCurrentHp} 
            monster={battleState.activeMonster} 
            onFlee={battleActions.flee} 
            combatLog={battleState.combatLog} 
            isPlayerTurn={battleState.isPlayerTurn} 
            combatStatusEffects={battleState.combatStatusEffects} 
            activeEffects={activeEffects} 
            combatStance={battleState.combatStance} 
            onSetStance={battleActions.setCombatStance} 
            turnQueue={battleState.turnQueue} 
          />
      )}

      {/* LEFT PANEL: Character (3 Cols) */}
      <div className={`col-span-12 md:col-span-3 bg-texture-leather border-r border-[#292524] relative flex flex-col z-10 shadow-xl overflow-hidden ${activeTab === 'hero' ? 'block' : 'hidden md:flex'}`}>
          <div className="h-full flex flex-col p-4">
              <h2 className="text-xl text-gold-gradient diablo-font text-center mb-4 tracking-widest border-b border-stone-800 pb-2">
                {level} <span className="text-xs text-stone-500 align-middle ml-2">Lv</span>
              </h2>
              
              {/* Avatar & Slots */}
              <div className="relative flex-grow flex flex-col items-center">
                  <div className="w-full aspect-square max-w-[240px] bg-[#080808] rounded-t-full border border-stone-800 relative overflow-visible mb-4 shadow-inner">
                    {heroImageUrl && <img src={heroImageUrl} className="absolute inset-0 w-full h-full object-cover rounded-t-full opacity-40" />}
                    <div className="absolute inset-0 grid grid-cols-3 gap-2 content-center justify-items-center p-2 z-10">
                        <div className="col-start-2 -mt-2">{renderEquipSlot(ItemSlot.HEAD)}</div>
                        <div className="col-start-1 mt-4">{renderEquipSlot(ItemSlot.MAIN_HAND)}</div>
                        <div className="col-start-2">{renderEquipSlot(ItemSlot.CHEST)}</div>
                        <div className="col-start-3 mt-4">{renderEquipSlot(ItemSlot.OFF_HAND)}</div>
                        <div className="col-start-1">{renderEquipSlot(ItemSlot.GLOVES)}</div>
                        <div className="col-start-2">{renderEquipSlot(ItemSlot.LEGS)}</div>
                        <div className="col-start-3">{renderEquipSlot(ItemSlot.BOOTS)}</div>
                        <div className="col-start-1 translate-x-4">{renderEquipSlot(ItemSlot.RING)}</div>
                        <div className="col-start-3 -translate-x-4">{renderEquipSlot(ItemSlot.AMULET)}</div>
                    </div>
                  </div>
                  
                  {/* Compact Stats Summary */}
                  <div className="w-full grid grid-cols-2 gap-2 text-xs font-mono text-stone-400 bg-black/30 p-2 rounded border border-stone-800">
                     <div className="flex justify-between"><span>STR</span><span className="text-red-400">{stats.strength}</span></div>
                     <div className="flex justify-between"><span>DMG</span><span className="text-white">{stats.damage}</span></div>
                     <div className="flex justify-between"><span>DEX</span><span className="text-green-400">{stats.dexterity}</span></div>
                     <div className="flex justify-between"><span>ARM</span><span className="text-white">{stats.armor}</span></div>
                     <div className="flex justify-between"><span>INT</span><span className="text-blue-400">{stats.intelligence}</span></div>
                     <div className="flex justify-between"><span>HP</span><span className="text-white">{stats.maxHp}</span></div>
                  </div>
              </div>
              
              <button onClick={() => setShowStatsModal(true)} className="w-full mt-4 py-3 bg-stone-900 hover:bg-stone-800 border border-stone-700 text-amber-500 font-bold uppercase tracking-widest text-xs transition-colors">
                Full Stats {statPoints > 0 && <span className="text-green-500 ml-1">(+{statPoints})</span>}
              </button>
          </div>
      </div>

      {/* CENTER PANEL: Adventure (6 Cols) */}
      <div className={`col-span-12 md:col-span-6 flex flex-col bg-texture-stone relative z-0 shadow-inner ${activeTab === 'adventure' ? 'block' : 'hidden md:flex'}`}>
          {/* Header */}
          <div className="h-16 shrink-0 bg-stone-950/90 border-b border-stone-800 flex items-center justify-between px-6 backdrop-blur-sm z-20">
              <div>
                 <div className="text-xs text-stone-500 font-mono uppercase tracking-wider mb-0.5">Current Location</div>
                 <div className="text-lg text-stone-200 diablo-font leading-none">{area.name}</div>
              </div>
              <div className="flex flex-col items-end">
                  <div className="text-amber-400 font-mono font-bold text-lg drop-shadow-sm">{gold.toLocaleString()}g</div>
                  <div className={`text-[10px] uppercase font-bold ${threat(worldDifficulty).color}`}>{threat(worldDifficulty).text}</div>
              </div>
          </div>

          {/* Action Bar */}
          <div className="p-4 bg-[#0c0a09]/90 flex gap-4 border-b border-stone-800 items-center z-10">
              <div className="flex-grow h-2 bg-stone-900 border border-stone-700 rounded-full relative overflow-hidden">
                <div className="absolute h-full bg-gradient-to-r from-amber-900 to-amber-600" style={{ width: `${area.isCleared ? 100 : areaProgress}%` }}></div>
              </div>
              <button 
                onClick={handleExplore} 
                disabled={battleState.isFighting} 
                className="px-8 py-2 bg-gradient-to-b from-stone-800 to-stone-900 border border-stone-600 text-stone-200 font-bold uppercase tracking-[0.15em] hover:from-stone-700 hover:to-stone-800 hover:text-white hover:border-stone-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg text-sm"
              >
                Explore
              </button>
          </div>

          {/* Main Content Area */}
          <div className="flex-grow relative overflow-hidden flex flex-col p-4 gap-4">
              
              {/* Ground Items (Horizontal Scroll) */}
              {groundItems.length > 0 && (
                <div className="shrink-0 h-16 bg-black/40 border border-stone-800 rounded flex items-center px-2 gap-2 overflow-x-auto custom-scrollbar">
                   <span className="text-[10px] text-stone-500 uppercase font-bold mr-2 shrink-0">Ground:</span>
                   {groundItems.map((i,idx) => (
                     <div key={idx} onClick={() => { addToInventory(i); setGroundItems(g => g.filter((_,ix) => ix !== idx)); }} className="shrink-0 scale-75 cursor-pointer hover:scale-90 transition-transform">
                       <InventorySlot item={i} onClick={()=>{}} onRightClick={()=>{}} setHoverItem={()=>{}} />
                     </div>
                   ))}
                </div>
              )}

              {/* Adventure Log (Placeholder for visuals) */}
              <div className="flex-grow border border-stone-800 bg-black/20 rounded p-4 overflow-y-auto custom-scrollbar font-mono text-xs space-y-1 shadow-inner">
                  {logs.map((log) => (
                      <div key={log.id} className={`${log.type === 'combat' ? 'text-red-400' : log.type === 'loot' ? 'text-amber-400' : 'text-stone-500'} border-b border-white/5 pb-1 mb-1`}>
                          <span className="opacity-50 mr-2">[{new Date(log.timestamp).toLocaleTimeString().slice(0,5)}]</span>
                          {log.message}
                      </div>
                  ))}
                  {logs.length === 0 && <div className="text-stone-600 italic text-center mt-10">The journey begins...</div>}
              </div>

              {/* Bottom Controls */}
              <div className="h-12 grid grid-cols-4 gap-2">
                  <button onClick={() => setShowMapModal(true)} className="bg-stone-900 border border-stone-700 hover:border-amber-500 hover:text-amber-500 text-stone-400 rounded flex items-center justify-center gap-2 transition-colors">
                    <span className="text-lg">🗺️</span> <span className="hidden lg:inline text-xs uppercase font-bold">Map</span>
                  </button>
                  <button onClick={() => setShowSmugglingModal(true)} className="bg-stone-900 border border-stone-700 hover:border-amber-500 hover:text-amber-500 text-stone-400 rounded flex items-center justify-center gap-2 transition-colors">
                    <span className="text-lg">💰</span> <span className="hidden lg:inline text-xs uppercase font-bold">Smuggler</span>
                  </button>
                  <button onClick={() => setShowSkillsModal(true)} className="bg-stone-900 border border-stone-700 hover:border-amber-500 hover:text-amber-500 text-stone-400 rounded flex items-center justify-center gap-2 transition-colors">
                    <span className="text-lg">📜</span> <span className="hidden lg:inline text-xs uppercase font-bold">Skills</span>
                  </button>
                   <button onClick={() => setShowSystemModal(true)} className="bg-stone-900 border border-stone-700 hover:border-red-500 hover:text-red-500 text-stone-400 rounded flex items-center justify-center gap-2 transition-colors">
                    <span className="text-lg">⚙️</span> <span className="hidden lg:inline text-xs uppercase font-bold">System</span>
                  </button>
              </div>
          </div>
      </div>

      {/* RIGHT PANEL: Inventory/Shop (3 Cols) */}
      <div 
        className={`col-span-12 md:col-span-3 bg-[#080808] border-l border-[#292524] flex flex-col z-10 relative shadow-xl ${activeTab === 'merchant' ? 'block' : 'hidden md:flex'}`} 
        onDragOver={handleDragOver} 
        onDrop={(e) => handleDrop(e, 'sell')}
      >
           {/* Header */}
           <div className="h-16 shrink-0 border-b border-stone-800 flex items-center justify-between px-4 bg-stone-950/50">
               <h2 className="text-stone-300 diablo-font text-lg">Inventory</h2>
               <div className="flex gap-1">
                    <button onClick={() => setIsVisualizeMode(!isVisualizeMode)} className={`w-8 h-8 rounded flex items-center justify-center border transition-all ${isVisualizeMode ? 'bg-purple-900/50 border-purple-500 text-purple-300' : 'bg-stone-900 border-stone-700 text-stone-500 hover:text-stone-300'}`}>👁️</button>
                    <button onClick={handleIdentifyAll} disabled={unIDCount === 0} className="h-8 px-3 text-[10px] bg-stone-900 border border-stone-700 text-amber-500 rounded hover:bg-stone-800 disabled:opacity-30 uppercase font-bold">Identify</button>
               </div>
           </div>

           {/* Grid Container */}
           <div className="flex-grow p-4 overflow-y-auto custom-scrollbar bg-black/20">
               {/* Standard Inventory Grid */}
               <div className="grid grid-cols-5 gap-2 content-start">
                  {inventory.map((item, idx) => (
                      <InventorySlot 
                        key={idx} 
                        item={item} 
                        onClick={() => item && (activeTab === 'merchant' && merchantMode === 'sell' ? moveItemToSell(item, 'inventory', idx) : handleEquip(item, idx))} 
                        onRightClick={() => {}} 
                        setHoverItem={(i, p) => { setHoverItem(i); if(p) setCursorPos(p); }} 
                        draggable={!!item} 
                        onDragStart={(e) => item && handleDragStart(e, 'inventory', idx)} 
                        onDragOver={handleDragOver} 
                        onDrop={(e) => handleDrop(e, 'inventory', idx)} 
                        isVisualizeMode={isVisualizeMode} 
                      />
                  ))}
               </div>
               
               <div className="mt-4 pt-4 border-t border-stone-800">
                   <div className="text-[10px] text-stone-600 uppercase text-center mb-2 font-bold tracking-widest">Merchant Exchange</div>
                   <div className="flex bg-stone-900 rounded p-1 mb-2">
                       <button onClick={() => setMerchantMode('sell')} className={`flex-1 text-[10px] uppercase py-1 rounded transition-colors ${merchantMode === 'sell' ? 'bg-amber-900 text-white font-bold shadow' : 'text-stone-500 hover:text-stone-300'}`}>Sell</button>
                       <button onClick={() => setMerchantMode('buy')} className={`flex-1 text-[10px] uppercase py-1 rounded transition-colors ${merchantMode === 'buy' ? 'bg-amber-900 text-white font-bold shadow' : 'text-stone-500 hover:text-stone-300'}`}>Buy</button>
                   </div>

                   {merchantMode === 'sell' ? (
                       <div className="bg-black/40 border border-stone-800 rounded p-2 min-h-[100px] flex flex-col gap-2">
                            <div className="grid grid-cols-5 gap-1">
                                {sellStaging.map((i, idx) => (
                                    <div key={idx} onClick={() => { const n = [...sellStaging]; n.splice(idx, 1); setSellStaging(n); addToInventory(i); }}>
                                        <InventorySlot item={i} onClick={()=>{}} onRightClick={()=>{}} setHoverItem={()=>{}} />
                                    </div>
                                ))}
                                {Array(5 - (sellStaging.length % 5)).fill(null).map((_, i) => <div key={i} className="w-12 h-12 border border-stone-800/30 rounded-[3px]"></div>)}
                            </div>
                            <button onClick={handleConfirmSell} disabled={!sellStaging.length} className="mt-auto w-full py-2 bg-amber-700 hover:bg-amber-600 text-white text-xs uppercase font-bold rounded shadow disabled:opacity-50 disabled:bg-stone-800">
                                Confirm {sellVal > 0 && `(${sellVal}g)`}
                            </button>
                       </div>
                   ) : (
                       <div className="grid grid-cols-2 gap-2">
                           {merchantStock.map((i, idx) => (
                               <button key={idx} onClick={() => handleBuyItem(i, idx)} className="bg-stone-900 border border-stone-700 p-1 rounded hover:border-amber-500 flex flex-col items-center gap-1 group">
                                   <InventorySlot item={i} onClick={()=>{}} onRightClick={()=>{}} setHoverItem={(itm, p) => { setHoverItem(itm); if(p) setCursorPos(p); }} />
                                   <span className="text-[9px] text-amber-500 font-mono group-hover:text-white">{calculateItemValue(i)*BALANCE.ITEM_VALUE.buyMarkup}g</span>
                               </button>
                           ))}
                       </div>
                   )}
               </div>
           </div>
      </div>

      {/* Mobile Portrait Tab Bar (Visible only on portrait mobile via CSS logic, but currently hidden in landscape desktop/mobile) */}
      <div className="md:hidden col-span-12 h-16 bg-[#0c0a09] border-t border-stone-700 flex items-center justify-around z-50 lg:hidden">
          <button onClick={() => setActiveTab('hero')} className={activeTab === 'hero' ? 'text-amber-500 scale-110' : 'text-stone-500'}>👤</button>
          <button onClick={() => setActiveTab('adventure')} className={activeTab === 'adventure' ? 'text-amber-500 scale-110' : 'text-stone-500'}>⚔️</button>
          <button onClick={() => setActiveTab('merchant')} className={activeTab === 'merchant' ? 'text-amber-500 scale-110' : 'text-stone-500'}>⚖️</button>
      </div>
    </div>
  );
}

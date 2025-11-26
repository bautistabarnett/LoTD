
import React, { useState } from 'react';
import { SmugglingBundle, Item, Rarity } from '../types';
import { SMUGGLING_BUNDLES, RARITY_COLORS } from '../constants';
import GameIcon from './GameIcon';
import InventorySlot from './InventorySlot';
import { BaseModal } from './BaseModal';

interface SmugglingModalProps {
  gold: number;
  onPurchase: (cost: number) => void;
  onGenerateLoot: (difficulty: number) => Item | null;
  onClose: () => void;
  addToInventory: (item: Item) => boolean;
}

const SmugglingModal: React.FC<SmugglingModalProps> = ({ 
  gold, 
  onPurchase, 
  onGenerateLoot, 
  onClose,
  addToInventory
}) => {
  const [selectedBundle, setSelectedBundle] = useState<SmugglingBundle | null>(null);
  const [purchasedItem, setPurchasedItem] = useState<Item | null>(null);
  const [isOpening, setIsOpening] = useState(false);

  const handleBuy = (bundle: SmugglingBundle) => {
    if (gold < bundle.cost) return;
    
    setSelectedBundle(bundle);
    onPurchase(bundle.cost);
    setIsOpening(true);
    setPurchasedItem(null);

    setTimeout(() => {
        let diff = 1;
        if (bundle.id === 'crate') diff = 4;
        if (bundle.id === 'chest') diff = 8;

        let item = onGenerateLoot(diff);
        let attempts = 0;
        while (attempts < 10) {
             if (item) break;
             item = onGenerateLoot(diff + (attempts * 0.5));
             attempts++;
        }
        if (!item) item = onGenerateLoot(1) as Item; 

        setPurchasedItem(item);
        setIsOpening(false);
    }, 2000);
  };

  const handleKeep = () => {
      if (purchasedItem) {
          const success = addToInventory(purchasedItem);
          if (success) {
              handleDiscard();
          }
      }
  };

  const handleDiscard = () => {
      setPurchasedItem(null);
      setSelectedBundle(null);
  };

  return (
    <BaseModal.Container zIndex="z-[60]" maxWidth="max-w-5xl" className="h-[90dvh] md:h-[80vh] border-stone-600">
        <BaseModal.Header 
            title="The Black Market" 
            subtitle='"No questions asked..."' 
            icon="🕵️‍♂️" 
            onClose={onClose} 
        />

        {/* Gold Display inside body or use custom placement? Sticking to body for simplicity or custom header content */}
        <div className="absolute top-3 right-16 md:right-24 z-20 bg-black/50 px-2 md:px-4 py-1 md:py-2 rounded border border-amber-900/50 flex items-center gap-2">
            <span className="text-amber-500 font-bold text-sm md:text-base">{gold.toLocaleString()}</span>
            <span className="text-[10px] text-stone-500 uppercase hidden md:inline">Gold Available</span>
        </div>

        <BaseModal.Body className="bg-[url('https://www.transparenttextures.com/patterns/dark-leather.png')] bg-stone-950 flex items-center justify-center">
            
            {/* Bundle Selection */}
            {!isOpening && !purchasedItem && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 w-full max-w-4xl">
                    {SMUGGLING_BUNDLES.map(bundle => {
                        const canAfford = gold >= bundle.cost;
                        return (
                            <div 
                                key={bundle.id}
                                onClick={() => canAfford && handleBuy(bundle)}
                                className={`
                                    relative group border-2 rounded-lg p-4 md:p-6 flex flex-col items-center text-center transition-all duration-300
                                    ${canAfford 
                                        ? 'border-stone-700 bg-stone-900/80 hover:border-amber-500 hover:bg-stone-800 hover:-translate-y-1 cursor-pointer shadow-lg' 
                                        : 'border-red-900/30 bg-stone-950/50 opacity-60 cursor-not-allowed grayscale'
                                    }
                                `}
                            >
                                <div className="mb-4 relative">
                                    <div className={`w-20 h-20 md:w-24 md:h-24 flex items-center justify-center rounded-full bg-black/40 border border-stone-800 shadow-inner group-hover:scale-110 transition-transform duration-300`}>
                                        <GameIcon name={bundle.icon} className="w-12 h-12 md:w-16 md:h-16 text-stone-400 group-hover:text-amber-100" />
                                    </div>
                                </div>

                                <h3 className="text-lg md:text-xl font-bold text-stone-200 mb-2 diablo-font">{bundle.name}</h3>
                                <p className="text-stone-500 text-xs md:text-sm mb-4 flex-grow italic px-2">{bundle.description}</p>

                                <div className="w-full border-t border-stone-800 pt-4 mt-auto">
                                    {bundle.guaranteedRarity && (
                                        <div className={`text-xs uppercase tracking-widest mb-2 font-bold ${RARITY_COLORS[bundle.guaranteedRarity]}`}>
                                            Guaranteed {bundle.guaranteedRarity}
                                        </div>
                                    )}
                                    <div className={`text-base md:text-lg font-mono font-bold ${canAfford ? 'text-amber-500' : 'text-red-500'}`}>
                                        {bundle.cost.toLocaleString()} Gold
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Opening Animation */}
            {isOpening && selectedBundle && (
                <div className="flex flex-col items-center justify-center animate-in zoom-in duration-500">
                    <div className="w-24 h-24 md:w-32 md:h-32 mb-8 animate-bounce relative">
                        <GameIcon name={selectedBundle.icon} className="w-full h-full text-stone-200" />
                        <div className="absolute inset-0 bg-amber-500/20 blur-xl animate-pulse rounded-full"></div>
                    </div>
                    <h3 className="text-2xl diablo-font text-amber-500 animate-pulse">Smuggling...</h3>
                    <p className="text-stone-500 mt-2">The guards are looking the other way.</p>
                </div>
            )}

            {/* Result Reveal */}
            {purchasedItem && (
                <div className="flex flex-col items-center justify-center w-full max-w-md animate-in zoom-in duration-300">
                    <div className="text-stone-400 uppercase tracking-widest text-xs md:text-sm mb-4 md:mb-6">Transaction Complete</div>
                    
                    <div className="scale-150 mb-6 md:mb-8 p-4 bg-black/50 rounded-lg border border-stone-700 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
                        <InventorySlot 
                            item={purchasedItem} 
                            onClick={() => {}} 
                            onRightClick={() => {}} 
                            setHoverItem={() => {}} 
                        />
                    </div>

                    <div className={`text-xl md:text-2xl diablo-font mb-2 ${RARITY_COLORS[purchasedItem.rarity]}`}>
                        {purchasedItem.name}
                    </div>
                    <div className="text-stone-500 text-xs md:text-sm mb-8">
                        {purchasedItem.rarity} {purchasedItem.type}
                    </div>

                    <div className="button-group md:flex md:flex-row md:gap-4 w-full">
                        <button 
                            onClick={handleDiscard}
                            className="flex-1 py-3 border border-stone-600 text-stone-400 hover:bg-stone-800 hover:text-white font-bold uppercase tracking-widest rounded transition-colors text-xs md:text-sm"
                        >
                            Discard
                        </button>
                        <button 
                            onClick={handleKeep}
                            className="flex-1 py-3 bg-amber-900 border border-amber-700 text-amber-100 hover:bg-amber-800 font-bold uppercase tracking-widest rounded shadow-lg hover:shadow-amber-900/20 transition-all text-xs md:text-sm"
                        >
                            Keep Item
                        </button>
                    </div>
                </div>
            )}
        </BaseModal.Body>
    </BaseModal.Container>
  );
};

export default React.memo(SmugglingModal);

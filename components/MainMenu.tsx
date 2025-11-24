
import React, { useState, useEffect } from 'react';
import { SaveSlotMetadata } from '../types';
import { storageService } from '../services/storageService';
import GameIcon from './GameIcon';

interface MainMenuProps {
    onStartGame: (slotId: number, isNew: boolean) => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onStartGame }) => {
    const [slots, setSlots] = useState<SaveSlotMetadata[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
    const [showConfirmOverride, setShowConfirmOverride] = useState(false);

    const refreshSlots = () => {
        setSlots(storageService.getSlots());
    };

    useEffect(() => {
        refreshSlots();
    }, []);

    const handleSlotClick = (slotId: number) => {
        setSelectedSlot(slotId);
        setShowConfirmOverride(false);
    };

    const handlePlay = () => {
        if (selectedSlot === null) return;
        const slot = slots.find(s => s.id === selectedSlot);
        if (!slot) return;

        if (slot.isEmpty) {
            onStartGame(selectedSlot, true);
        } else {
            onStartGame(selectedSlot, false);
        }
    };

    const handleNewGameOverride = () => {
        if (selectedSlot === null) return;
        onStartGame(selectedSlot, true); // Force new game
    };

    const handleDelete = () => {
        if (selectedSlot === null) return;
        if (window.confirm("Are you sure you want to delete this save? This cannot be undone.")) {
            storageService.deleteGame(selectedSlot);
            refreshSlots();
            setSelectedSlot(null);
        }
    };

    const selectedSlotData = slots.find(s => s.id === selectedSlot);

    return (
        <div className="w-full h-full flex items-center justify-center relative overflow-hidden bg-[#050505]">
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-20 animate-pulse"></div>
             
             <div className="relative z-10 w-full max-w-4xl p-4 md:p-8 flex flex-col items-center">
                 <h1 className="text-4xl md:text-6xl diablo-font text-transparent bg-clip-text bg-gradient-to-b from-amber-400 to-amber-700 mb-2 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                     LOOT OF THE VOID
                 </h1>
                 <p className="text-stone-500 font-serif italic mb-12">Choose your destiny...</p>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-12">
                     {slots.map(slot => (
                         <div 
                            key={slot.id}
                            onClick={() => handleSlotClick(slot.id)}
                            className={`
                                relative border-2 p-6 h-48 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group
                                ${selectedSlot === slot.id 
                                    ? 'border-amber-500 bg-amber-950/30 shadow-[0_0_30px_rgba(245,158,11,0.2)] scale-105' 
                                    : 'border-stone-800 bg-stone-950/50 hover:border-stone-600'
                                }
                            `}
                         >
                             <div className="text-3xl mb-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                 {slot.isEmpty ? '🕸️' : '🦸'}
                             </div>
                             <div className="diablo-font text-xl text-stone-300 mb-1">Slot {slot.id}</div>
                             
                             {slot.isEmpty ? (
                                 <div className="text-stone-600 text-sm">Empty</div>
                             ) : (
                                 <>
                                     <div className="text-amber-500 font-bold">{slot.label}</div>
                                     <div className="text-stone-500 text-xs mt-2">
                                         {new Date(slot.timestamp).toLocaleDateString()}
                                     </div>
                                     <div className="text-stone-600 text-[10px]">
                                         {new Date(slot.timestamp).toLocaleTimeString()}
                                     </div>
                                 </>
                             )}
                         </div>
                     ))}
                 </div>

                 {selectedSlotData && (
                     <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                         {!selectedSlotData.isEmpty ? (
                             <>
                                 <button 
                                    onClick={handlePlay}
                                    className="px-8 py-3 bg-amber-900 hover:bg-amber-800 border border-amber-600 text-amber-100 font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(180,83,9,0.4)] transition-all"
                                 >
                                     Load Game
                                 </button>
                                 {!showConfirmOverride ? (
                                     <button 
                                        onClick={() => setShowConfirmOverride(true)}
                                        className="px-8 py-3 bg-stone-800 hover:bg-stone-700 border border-stone-600 text-stone-300 font-bold uppercase tracking-widest transition-all"
                                     >
                                         New Game
                                     </button>
                                 ) : (
                                     <div className="flex gap-2">
                                         <button 
                                            onClick={handleNewGameOverride}
                                            className="px-4 py-3 bg-red-900 hover:bg-red-800 border border-red-600 text-red-100 font-bold uppercase tracking-widest transition-all"
                                         >
                                             Confirm Overwrite
                                         </button>
                                         <button 
                                            onClick={() => setShowConfirmOverride(false)}
                                            className="px-4 py-3 bg-black border border-stone-700 text-stone-400 font-bold uppercase tracking-widest"
                                         >
                                             Cancel
                                         </button>
                                     </div>
                                 )}
                                 <button 
                                    onClick={handleDelete}
                                    className="px-4 py-3 border border-red-900/50 text-red-900 hover:text-red-500 hover:border-red-500 font-bold uppercase tracking-widest transition-all"
                                 >
                                     Delete
                                 </button>
                             </>
                         ) : (
                             <button 
                                onClick={handlePlay}
                                className="px-12 py-4 bg-amber-900 hover:bg-amber-800 border border-amber-600 text-amber-100 font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(180,83,9,0.4)] transition-all text-xl"
                             >
                                 Start Adventure
                             </button>
                         )}
                     </div>
                 )}
             </div>
             
             <div className="absolute bottom-4 text-stone-700 text-xs">
                 v1.0.0 • Loot of the Void
             </div>
        </div>
    );
};

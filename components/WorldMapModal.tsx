import React from 'react';
import { MapNode } from '../types';
import GameIcon from './GameIcon';
import { BaseModal } from './BaseModal';

interface WorldMapModalProps {
  nodes: MapNode[];
  currentNodeId: string;
  areaProgress: number; // 0-100
  onTravel: (nodeId: string) => void;
  onClose: () => void;
}

const WorldMapModal: React.FC<WorldMapModalProps> = ({ 
  nodes, 
  currentNodeId, 
  areaProgress, 
  onTravel, 
  onClose 
}) => {
  
  const getNode = (id: string) => nodes.find(n => n.id === id);

  const renderConnections = () => {
    const lines: React.ReactNode[] = [];
    const processedConnections = new Set<string>();

    nodes.forEach(node => {
      node.connections.forEach(targetId => {
        const target = getNode(targetId);
        if (!target) return;

        const key = [node.id, targetId].sort().join('-');
        if (processedConnections.has(key)) return;
        processedConnections.add(key);

        const isPathUnlocked = node.isUnlocked && target.isUnlocked;
        
        lines.push(
          <line 
            key={key}
            x1={`${node.coordinates.x}%`} 
            y1={`${node.coordinates.y}%`} 
            x2={`${target.coordinates.x}%`} 
            y2={`${target.coordinates.y}%`} 
            stroke={isPathUnlocked ? "#d97706" : "#44403c"} 
            strokeWidth="2"
            strokeDasharray={isPathUnlocked ? "0" : "5 5"}
            className="transition-all duration-500"
          />
        );
      });
    });
    return lines;
  };

  const currentNode = getNode(currentNodeId);

  return (
    <BaseModal.Container zIndex="z-[70]" maxWidth="max-w-5xl" className="h-[90dvh] md:h-[80vh]">
        <BaseModal.Header 
            title="World Map" 
            onClose={onClose} 
            textColor="text-amber-500"
        />

        {/* Map Container - Scrollable on Mobile */}
        <BaseModal.Body noPadding className="bg-stone-950">
           {/* Inner Container - Fixed min-size to ensure map logic works and is scrollable if screen small */}
           <div className="relative w-[150%] h-[150%] md:w-full md:h-full bg-[url('https://www.transparenttextures.com/patterns/cartographer.png')]">
              {/* Background SVG for Lines */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                {renderConnections()}
              </svg>

              {/* Nodes */}
              {nodes.map(node => {
                const isCurrent = node.id === currentNodeId;
                const isLocked = !node.isUnlocked;
                
                return (
                  <div 
                    key={node.id}
                    className={`
                      absolute w-12 h-12 md:w-16 md:h-16 -ml-6 -mt-6 md:-ml-8 md:-mt-8 rounded-full border-2 flex items-center justify-center z-10 transition-all duration-300
                      ${isCurrent 
                        ? 'border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.6)] bg-amber-950' 
                        : isLocked 
                          ? 'border-stone-700 bg-stone-900/80 grayscale opacity-60 cursor-not-allowed' 
                          : node.isCleared
                            ? 'border-green-600 bg-green-950/50 hover:scale-110 cursor-pointer'
                            : 'border-stone-500 bg-stone-800 hover:border-amber-300 hover:scale-110 cursor-pointer'
                      }
                    `}
                    style={{ left: `${node.coordinates.x}%`, top: `${node.coordinates.y}%` }}
                    onClick={() => !isLocked && onTravel(node.id)}
                  >
                    <GameIcon 
                      name={node.icon} 
                      className={`
                        w-8 h-8 md:w-10 md:h-10 
                        ${isCurrent ? 'text-amber-500' : isLocked ? 'text-stone-600' : node.isCleared ? 'text-green-500' : 'text-stone-400'}
                      `} 
                    />
                    
                    {/* Label */}
                    <div className={`
                      absolute top-full mt-1 md:mt-2 whitespace-nowrap text-[10px] md:text-xs font-bold px-2 py-1 rounded bg-black/80 border border-stone-700
                      ${isCurrent ? 'text-amber-500' : 'text-stone-400'}
                    `}>
                      {node.name}
                    </div>
                    
                    {/* Cleared Checkmark */}
                    {node.isCleared && (
                      <div className="absolute -top-1 -right-1 bg-green-900 text-green-400 rounded-full w-4 h-4 md:w-5 md:h-5 flex items-center justify-center text-[10px] border border-green-700">
                        ✓
                      </div>
                    )}
                  </div>
                );
              })}
           </div>
        </BaseModal.Body>

        <BaseModal.Footer className="bg-stone-900 border-t border-stone-700 flex flex-col md:flex-row justify-between items-center gap-4">
          {currentNode ? (
            <div className="flex-grow w-full">
              <h3 className="text-lg md:text-xl text-stone-200 font-bold diablo-font flex items-center gap-3">
                {currentNode.name}
                {currentNode.isCleared && <span className="text-[10px] bg-green-900 text-green-300 px-2 py-0.5 rounded border border-green-700">CLEARED</span>}
              </h3>
              <p className="text-stone-500 italic text-xs md:text-sm mb-2 truncate">{currentNode.description}</p>
              
              {/* Progress Bar */}
              <div className="w-full max-w-md bg-stone-950 h-3 md:h-4 rounded border border-stone-700 relative overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-900 to-amber-600 transition-all duration-500"
                  style={{ width: `${areaProgress}%` }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-center text-[8px] md:text-[10px] text-white font-bold tracking-widest shadow-black drop-shadow-md">
                  MASTERY: {Math.floor(areaProgress)}%
                </div>
              </div>
              {areaProgress >= 100 && !currentNode.isCleared && (
                 <p className="text-red-500 text-[10px] mt-1 font-bold animate-pulse">⚠️ BOSS REVEALED! DEFEAT TO UNLOCK.</p>
              )}
            </div>
          ) : (
            <div>Select an area...</div>
          )}

          <div className="text-right text-[10px] text-stone-500 space-y-1 w-full md:w-auto flex md:block justify-between md:justify-end gap-2 border-t md:border-t-0 border-stone-800 pt-2 md:pt-0">
             <div className="flex items-center gap-1 justify-end"><div className="w-2 h-2 bg-amber-950 border border-amber-500 rounded-full"></div> Current</div>
             <div className="flex items-center gap-1 justify-end"><div className="w-2 h-2 bg-green-950 border border-green-600 rounded-full"></div> Cleared</div>
             <div className="flex items-center gap-1 justify-end"><div className="w-2 h-2 bg-stone-800 border border-stone-500 rounded-full"></div> Unlocked</div>
             <div className="flex items-center gap-1 justify-end"><div className="w-2 h-2 bg-stone-900 border border-stone-700 rounded-full opacity-50"></div> Locked</div>
          </div>
        </BaseModal.Footer>
    </BaseModal.Container>
  );
};

export default WorldMapModal;

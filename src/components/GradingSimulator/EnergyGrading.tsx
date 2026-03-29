
import React from 'react';
import { Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  score: number;
}

export const EnergyGrading: React.FC<Props> = ({ score }) => {
  const energyPoints = Math.floor(score / 10); // 0-10 energy points
  
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap gap-1 justify-center w-full">
        <AnimatePresence mode="popLayout">
          {Array.from({ length: energyPoints }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 45 }}
              className="w-8 h-8 bg-yellow-400 rounded-lg border-2 border-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/30"
            >
              <Zap size={16} className="text-yellow-800 fill-yellow-800" />
            </motion.div>
          ))}
        </AnimatePresence>
        {energyPoints === 0 && <div className="text-slate-300 italic text-xs">Энергия жоқ</div>}
      </div>
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        {energyPoints} Energy Points
      </div>
    </div>
  );
};

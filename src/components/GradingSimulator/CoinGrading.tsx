
import React from 'react';
import { Coins } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  score: number;
}

export const CoinGrading: React.FC<Props> = ({ score }) => {
  const coins = Math.floor(score / 10); // 0-10 coins
  
  return (
    <div className="flex flex-wrap gap-1 justify-center w-full">
      <AnimatePresence mode="popLayout">
        {Array.from({ length: coins }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ y: -20, opacity: 0, rotateY: 180 }}
            animate={{ y: 0, opacity: 1, rotateY: 0 }}
            exit={{ y: 20, opacity: 0 }}
            className="w-8 h-8 bg-amber-400 rounded-full border-2 border-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30"
          >
            <span className="text-amber-800 font-black text-sm">$</span>
          </motion.div>
        ))}
      </AnimatePresence>
      {coins === 0 && <div className="text-slate-300 italic text-xs">Монета жоқ</div>}
    </div>
  );
};

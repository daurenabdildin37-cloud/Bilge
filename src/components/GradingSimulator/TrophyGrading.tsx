
import React from 'react';
import { Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  score: number;
}

export const TrophyGrading: React.FC<Props> = ({ score }) => {
  const trophies = Math.floor(score / 25); // 0-4 trophies
  const trophyColors = [
    'text-slate-400', // Bronze
    'text-slate-500', // Silver
    'text-amber-500', // Gold
    'text-emerald-500' // Diamond
  ];

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((t) => (
          <motion.div
            key={t}
            initial={{ scale: 0, rotate: -45 }}
            animate={{ 
              scale: t <= trophies ? 1.1 : 0.7, 
              rotate: 0,
              opacity: t <= trophies ? 1 : 0.2
            }}
            transition={{ type: "spring", stiffness: 200, damping: 10 }}
            className={`transition-all duration-500 ${t <= trophies ? trophyColors[t-1] : 'text-slate-200'}`}
          >
            <Trophy size={28} className={t <= trophies ? 'fill-current drop-shadow-lg' : ''} />
          </motion.div>
        ))}
      </div>
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        {trophies === 0 ? 'Жетістік жоқ' : trophies === 4 ? 'Чемпион!' : 'Жетістіктер'}
      </div>
    </div>
  );
};

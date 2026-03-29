
import React from 'react';
import { Brain } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  score: number;
}

export const BrainGrading: React.FC<Props> = ({ score }) => {
  const level = Math.floor(score / 20) + 1; // 1-6 levels
  const glowColor = () => {
    if (level > 4) return 'shadow-purple-500/50 text-purple-600';
    if (level > 2) return 'shadow-blue-500/50 text-blue-600';
    return 'shadow-slate-500/50 text-slate-400';
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <motion.div
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.8, 1, 0.8]
        }}
        transition={{ 
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className={`w-16 h-16 rounded-full bg-white border-[4px] border-slate-100 flex items-center justify-center shadow-xl transition-all duration-500 ${glowColor()}`}
      >
        <Brain size={32} className="transition-all duration-500" />
      </motion.div>
      <div className="flex flex-col items-center">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">IQ Level</span>
        <div className="px-4 py-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full text-white font-black text-xs shadow-lg shadow-purple-500/30">
          Level {level}
        </div>
      </div>
    </div>
  );
};

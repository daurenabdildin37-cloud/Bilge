
import React from 'react';
import { motion } from 'motion/react';
import { Flame } from 'lucide-react';

interface Props {
  score: number;
}

export const ProgressBarGrading: React.FC<Props> = ({ score }) => {
  const getColor = () => {
    if (score > 80) return 'from-rose-500 to-orange-500';
    if (score > 50) return 'from-orange-500 to-amber-500';
    return 'from-amber-500 to-yellow-500';
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Energy Level</span>
        <Flame size={20} className={score > 80 ? 'text-rose-500 animate-pulse' : 'text-slate-300'} />
      </div>
      <div className="w-full h-10 bg-slate-100 rounded-full p-1 border border-slate-200 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          className={`h-full rounded-full bg-gradient-to-r ${getColor()} relative shadow-lg shadow-orange-500/20`}
        >
          <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white font-black text-sm drop-shadow-md">{score}%</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

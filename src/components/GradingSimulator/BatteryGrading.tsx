
import React from 'react';
import { motion } from 'motion/react';

interface Props {
  score: number;
}

export const BatteryGrading: React.FC<Props> = ({ score }) => {
  const getColor = () => {
    if (score > 70) return 'bg-emerald-500';
    if (score > 30) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="relative w-18 h-24 border-[3px] border-slate-300 rounded-xl p-1 flex flex-col justify-end overflow-hidden">
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-7 h-2 bg-slate-300 rounded-t-md"></div>
      <motion.div
        initial={{ height: 0 }}
        animate={{ height: `${score}%` }}
        className={`w-full rounded-lg transition-colors duration-500 ${getColor()} relative`}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white font-black text-sm drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">{score}%</span>
        </div>
      </motion.div>
    </div>
  );
};

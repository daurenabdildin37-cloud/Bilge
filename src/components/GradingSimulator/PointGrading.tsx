
import React from 'react';
import { Target } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  score: number;
}

export const PointGrading: React.FC<Props> = ({ score }) => {
  const points = Math.floor(score / 10); // 0-10 points
  
  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div className="flex flex-wrap justify-center gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
          <motion.div
            key={p}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: p * 0.05 }}
            className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center text-xs font-black transition-all duration-300 ${
              p <= points 
                ? 'bg-blue-600 border-blue-700 text-white scale-110 shadow-lg shadow-blue-500/30' 
                : 'bg-slate-50 border-slate-200 text-slate-300'
            }`}
          >
            {p}
          </motion.div>
        ))}
      </div>
      <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-100 rounded-xl border border-slate-200">
        <Target size={16} className="text-blue-600" />
        <span className="text-xs font-bold text-slate-700">{points} / 10 ұпай</span>
      </div>
    </div>
  );
};

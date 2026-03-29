
import React from 'react';
import { Star } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  score: number;
}

export const StarGrading: React.FC<Props> = ({ score }) => {
  const stars = Math.ceil(score / 20); // 0-5 stars
  
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <motion.div
          key={s}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: s * 0.1 }}
        >
          <Star 
            size={28} 
            className={`transition-all duration-300 ${
              s <= stars 
                ? 'fill-amber-400 text-amber-500 scale-110 drop-shadow-lg' 
                : 'text-slate-200'
            }`} 
          />
        </motion.div>
      ))}
    </div>
  );
};


import React from 'react';
import { Heart } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  score: number;
}

export const HeartGrading: React.FC<Props> = ({ score }) => {
  const hearts = Math.ceil(score / 20); // 0-5 hearts
  
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((h) => (
        <motion.div
          key={h}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: h * 0.1 }}
        >
          <Heart 
            size={28} 
            className={`transition-all duration-300 ${
              h <= hearts 
                ? 'fill-rose-500 text-rose-600 scale-110 drop-shadow-lg' 
                : 'text-slate-200'
            }`} 
          />
        </motion.div>
      ))}
    </div>
  );
};

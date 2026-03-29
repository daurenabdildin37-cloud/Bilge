
import React from 'react';
import { Leaf, Sprout, Flower2, TreeDeciduous } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  score: number;
}

export const GrowthGrading: React.FC<Props> = ({ score }) => {
  const getStage = () => {
    if (score > 80) return <TreeDeciduous size={48} className="text-emerald-600 fill-emerald-500/20" />;
    if (score > 50) return <Flower2 size={40} className="text-rose-500 fill-rose-500/20" />;
    if (score > 20) return <Sprout size={32} className="text-emerald-500" />;
    return <Leaf size={24} className="text-slate-300" />;
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20 bg-slate-50 rounded-full border-2 border-slate-100 flex items-center justify-center overflow-hidden shadow-inner">
        <motion.div
          key={score}
          initial={{ y: 20, opacity: 0, scale: 0.5 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 100 }}
          className="transition-all duration-500"
        >
          {score > 80 ? <TreeDeciduous size={48} className="text-emerald-600 fill-emerald-500/20" /> :
           score > 50 ? <Flower2 size={40} className="text-rose-500 fill-rose-500/20" /> :
           score > 20 ? <Sprout size={32} className="text-emerald-500" /> :
           <Leaf size={24} className="text-slate-300" />}
        </motion.div>
        <div className="absolute bottom-0 left-0 right-0 h-3 bg-amber-900/10"></div>
      </div>
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        {score > 80 ? 'Үлкен ағаш' : score > 50 ? 'Гүл' : score > 20 ? 'Өскін' : 'Тұқым'}
      </div>
    </div>
  );
};

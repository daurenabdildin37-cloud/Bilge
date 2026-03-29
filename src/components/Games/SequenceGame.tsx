
import React, { useState, useEffect } from 'react';
import { motion, Reorder } from 'motion/react';
import { ArrowLeft, Trophy, GripVertical, Check } from 'lucide-react';

interface SequenceGameProps {
  data: {
    items: Array<{ text: string; order: number }>;
  };
  onBack: (score?: number) => void;
}

export const SequenceGame: React.FC<SequenceGameProps> = ({ data, onBack }) => {
  const [items, setItems] = useState<any[]>([]);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const shuffled = [...(data.items || [])].sort(() => Math.random() - 0.5);
    setItems(shuffled);
  }, [data]);

  const checkSequence = () => {
    const isSorted = items.every((item, idx) => {
      // Check if current item's order is correct relative to its position
      // The items should be in ascending order of their 'order' property
      if (idx === 0) return true;
      return item.order > items[idx - 1].order;
    });

    if (isSorted) {
      setIsCorrect(true);
      setScore(500);
      setTimeout(() => setShowResult(true), 1500);
    } else {
      // Shake animation or feedback
    }
  };

  if (showResult) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800"
      >
        <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600">
          <Trophy size={40} />
        </div>
        <h2 className="text-2xl font-bold mb-2">Керемет!</h2>
        <p className="text-slate-500 mb-6">Реттілік дұрыс сақталды.</p>
        <div className="text-5xl font-black text-blue-600 mb-8">{score} XP</div>
        <button className="btn btn-primary btn-wide" onClick={() => onBack(score)}>Мәзірге қайту</button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <button onClick={() => onBack()} className="btn btn-ghost btn-sm"><ArrowLeft size={18} /> Шығу</button>
        <div className="text-sm font-bold text-slate-400">Дұрыс ретпен қойыңыз</div>
        <div className="text-blue-600 font-bold">{score} XP</div>
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
        <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-3">
          {items.map((item, idx) => (
            <Reorder.Item 
              key={item.text} 
              value={item}
              className={`flex items-center gap-4 p-4 bg-white dark:bg-slate-900 rounded-2xl border-2 shadow-sm cursor-grab active:cursor-grabbing transition-colors ${isCorrect ? 'border-emerald-500 bg-emerald-50' : 'border-transparent hover:border-blue-200'}`}
            >
              <div className="text-slate-300"><GripVertical size={20} /></div>
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500">
                {idx + 1}
              </div>
              <div className="flex-1 font-medium text-slate-700 dark:text-slate-200">{item.text}</div>
              {isCorrect && <Check className="text-emerald-500" size={20} />}
            </Reorder.Item>
          ))}
        </Reorder.Group>

        <button 
          className="btn btn-primary w-full mt-8 py-4 h-auto text-lg shadow-lg shadow-blue-200 dark:shadow-none"
          onClick={checkSequence}
          disabled={isCorrect}
        >
          {isCorrect ? 'Дұрыс! ✨' : 'Тексеру'}
        </button>
      </div>
    </div>
  );
};

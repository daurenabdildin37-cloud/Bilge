
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Trophy, Check, X, FolderOpen } from 'lucide-react';

interface CategorizationGameProps {
  data: {
    categories: Array<{ name: string; items: string[] }>;
  };
  onBack: (score?: number) => void;
}

export const CategorizationGame: React.FC<CategorizationGameProps> = ({ data, onBack }) => {
  const [allItems, setAllItems] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [placedItems, setPlacedItems] = useState<Record<string, string[]>>({});

  const categories = data.categories || [];

  useEffect(() => {
    const items = categories.flatMap(cat => 
      cat.items.map(item => ({ text: item, category: cat.name }))
    ).sort(() => Math.random() - 0.5);
    setAllItems(items);
    
    const initialPlaced: Record<string, string[]> = {};
    categories.forEach(cat => initialPlaced[cat.name] = []);
    setPlacedItems(initialPlaced);
  }, [data]);

  const handleCategorySelect = (categoryName: string) => {
    if (feedback || currentIndex >= allItems.length) return;

    const currentItem = allItems[currentIndex];
    const isCorrect = currentItem.category === categoryName;

    if (isCorrect) {
      setScore(s => s + 100);
      setFeedback('correct');
      setPlacedItems(prev => ({
        ...prev,
        [categoryName]: [...prev[categoryName], currentItem.text]
      }));
    } else {
      setFeedback('wrong');
    }

    setTimeout(() => {
      setFeedback(null);
      if (currentIndex < allItems.length - 1) {
        setCurrentIndex(c => c + 1);
      } else {
        setShowResult(true);
      }
    }, 1000);
  };

  if (showResult) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800"
      >
        <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-yellow-600">
          <Trophy size={40} />
        </div>
        <h2 className="text-2xl font-bold mb-2">Ойын аяқталды!</h2>
        <p className="text-slate-500 mb-6">Барлық элементтер сұрыпталды.</p>
        <div className="text-5xl font-black text-blue-600 mb-8">{score} XP</div>
        <button className="btn btn-primary btn-wide" onClick={() => onBack(score)}>Мәзірге қайту</button>
      </motion.div>
    );
  }

  const currentItem = allItems[currentIndex];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <button onClick={() => onBack()} className="btn btn-ghost btn-sm"><ArrowLeft size={18} /> Шығу</button>
        <div className="text-sm font-bold text-slate-400">Элементті сәйкес санатқа бағыттаңыз</div>
        <div className="text-blue-600 font-bold">{score} XP</div>
      </div>

      <div className="flex flex-col items-center gap-12">
        <AnimatePresence mode="wait">
          {currentItem && (
            <motion.div 
              key={currentIndex}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.2, opacity: 0 }}
              className={`p-10 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-4 flex items-center justify-center text-2xl font-bold text-center min-w-[280px] ${feedback === 'correct' ? 'border-emerald-500 text-emerald-600' : feedback === 'wrong' ? 'border-red-500 text-red-600' : 'border-blue-500 text-slate-800 dark:text-slate-100'}`}
            >
              {currentItem.text}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-3xl">
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => handleCategorySelect(cat.name)}
              disabled={!!feedback}
              className="group relative p-8 bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-100 dark:border-slate-800 hover:border-blue-500 hover:shadow-xl transition-all flex flex-col items-center gap-4"
            >
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                <FolderOpen size={32} />
              </div>
              <div className="font-bold text-lg">{cat.name}</div>
              <div className="flex flex-wrap justify-center gap-1 mt-2">
                {placedItems[cat.name]?.map((item, i) => (
                  <span key={i} className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded text-[10px]">
                    {item}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

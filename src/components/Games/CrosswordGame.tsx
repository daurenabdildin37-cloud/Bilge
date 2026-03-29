
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Trophy, HelpCircle } from 'lucide-react';

interface CrosswordGameProps {
  data: {
    clues: Array<{ word: string; clue: string; x: number; y: number; dir: 'across' | 'down' }>;
  };
  onBack: (score?: number) => void;
}

export const CrosswordGame: React.FC<CrosswordGameProps> = ({ data, onBack }) => {
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, 'correct' | 'wrong' | null>>({});

  const clues = data?.clues || [];

  const handleInputChange = (clueIdx: number, val: string) => {
    setUserAnswers(prev => ({ ...prev, [clueIdx]: val.toUpperCase() }));
    setFeedback(prev => ({ ...prev, [clueIdx]: null }));
  };

  const checkAnswers = () => {
    if (clues.length === 0) return;
    
    let correctCount = 0;
    const newFeedback: Record<string, 'correct' | 'wrong'> = {};
    
    clues.forEach((clue, idx) => {
      const isCorrect = userAnswers[idx]?.trim().toUpperCase() === clue.word.toUpperCase();
      if (isCorrect) {
        correctCount++;
        newFeedback[idx] = 'correct';
      } else {
        newFeedback[idx] = 'wrong';
      }
    });

    setFeedback(newFeedback);
    const finalScore = Math.round((correctCount / clues.length) * 1000);
    setScore(finalScore);
    
    if (correctCount === clues.length) {
      setTimeout(() => setShowResult(true), 1000);
    }
  };

  if (clues.length === 0) {
    return (
      <div className="text-center p-12">
        <p className="text-slate-500">Сөзжұмбақ мәліметтері табылмады.</p>
        <button onClick={() => onBack()} className="btn btn-primary mt-4">Артқа қайту</button>
      </div>
    );
  }

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
        <h2 className="text-2xl font-bold mb-2">Ойын аяқталды!</h2>
        <p className="text-slate-500 mb-6">Сөзжұмбақ шешілді.</p>
        <div className="text-5xl font-black text-blue-600 mb-8">{score} XP</div>
        <button className="btn btn-primary btn-wide" onClick={() => onBack(score)}>Мәзірге қайту</button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <button onClick={() => onBack()} className="btn btn-ghost btn-sm"><ArrowLeft size={18} /> Шығу</button>
        <div className="text-sm font-bold text-slate-400">Сөзжұмбақты шешіңіз</div>
        <div className="text-blue-600 font-bold">{score} XP</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h4 className="font-bold flex items-center gap-2">
            <HelpCircle size={18} className="text-blue-500" />
            Сұрақтар
          </h4>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {clues.map((clue, i) => (
              <div key={i} className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                <div className="text-xs font-bold text-blue-500 uppercase">{i + 1}. {clue.dir === 'across' ? 'Көлденең' : 'Тігінен'}</div>
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{clue.clue}</div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className={`inp !py-2 text-sm flex-1 ${feedback[i] === 'correct' ? '!border-emerald-500 bg-emerald-50' : feedback[i] === 'wrong' ? '!border-red-500 bg-red-50' : ''}`} 
                    placeholder="Жауап..." 
                    value={userAnswers[i] || ''}
                    onChange={e => handleInputChange(i, e.target.value)}
                  />
                  {feedback[i] === 'correct' && <span className="text-emerald-500 flex items-center">✅</span>}
                  {feedback[i] === 'wrong' && <span className="text-red-500 flex items-center">❌</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/30 rounded-3xl flex items-center justify-center text-blue-600 mx-auto">
              <HelpCircle size={48} />
            </div>
            <h3 className="font-bold text-lg">Барлық сөздерді енгізіп болған соң тексеріңіз</h3>
            <p className="text-sm text-slate-500">Әрбір дұрыс сөз үшін 200 XP беріледі.</p>
            <button className="btn btn-primary btn-wide mt-4" onClick={checkAnswers}>Тексеру</button>
          </div>
        </div>
      </div>
    </div>
  );
};

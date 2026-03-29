
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, ArrowLeft, Trophy } from 'lucide-react';

interface TrueFalseGameProps {
  data: {
    questions: Array<{ q: string; a: boolean; imageUrl?: string }>;
  };
  onBack: (score?: number) => void;
}

export const TrueFalseGame: React.FC<TrueFalseGameProps> = ({ data, onBack }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  const questions = data.questions || [];

  const handleAnswer = (answer: boolean) => {
    if (feedback) return;
    
    const isCorrect = answer === questions[currentIdx].a;
    if (isCorrect) {
      setScore(s => s + 100);
      setFeedback('correct');
    } else {
      setFeedback('wrong');
    }

    setTimeout(() => {
      setFeedback(null);
      if (currentIdx < questions.length - 1) {
        setCurrentIdx(c => c + 1);
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
        <p className="text-slate-500 mb-6">Сіздің нәтижеңіз:</p>
        <div className="text-5xl font-black text-blue-600 mb-8">{score} XP</div>
        <button className="btn btn-primary btn-wide" onClick={() => onBack(score)}>Мәзірге қайту</button>
      </motion.div>
    );
  }

  const currentQ = questions[currentIdx];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <button onClick={() => onBack()} className="btn btn-ghost btn-sm"><ArrowLeft size={18} /> Шығу</button>
        <div className="text-sm font-bold text-slate-400">Сұрақ {currentIdx + 1} / {questions.length}</div>
        <div className="text-blue-600 font-bold">{score} XP</div>
      </div>

      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <motion.div 
          className="h-full bg-blue-500"
          initial={{ width: 0 }}
          animate={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div 
          key={currentIdx}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-800 min-h-[300px] flex flex-col items-center justify-center text-center"
        >
          <h3 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">
            {currentQ?.q}
          </h3>
          {currentQ?.imageUrl && (
            <div className="mb-8 max-w-sm mx-auto">
              <img 
                src={currentQ.imageUrl} 
                alt="Сұрақ суреті" 
                className="w-full rounded-2xl border-4 border-white dark:border-slate-800 shadow-xl" 
                referrerPolicy="no-referrer"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-6 w-full max-w-md">
            <button 
              onClick={() => handleAnswer(true)}
              disabled={!!feedback}
              className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all ${feedback === 'correct' && currentQ.a === true ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : feedback === 'wrong' && currentQ.a === false ? 'bg-red-50 border-red-500 text-red-600' : 'bg-slate-50 dark:bg-slate-800 border-transparent hover:border-blue-500'}`}
            >
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                <Check size={24} />
              </div>
              <span className="font-bold">Ақиқат</span>
            </button>

            <button 
              onClick={() => handleAnswer(false)}
              disabled={!!feedback}
              className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all ${feedback === 'correct' && currentQ.a === false ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : feedback === 'wrong' && currentQ.a === true ? 'bg-red-50 border-red-500 text-red-600' : 'bg-slate-50 dark:bg-slate-800 border-transparent hover:border-blue-500'}`}
            >
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600">
                <X size={24} />
              </div>
              <span className="font-bold">Жалған</span>
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {feedback && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className={`fixed inset-0 pointer-events-none flex items-center justify-center z-50`}
          >
            <div className={`p-8 rounded-full ${feedback === 'correct' ? 'bg-emerald-500' : 'bg-red-500'} text-white shadow-2xl`}>
              {feedback === 'correct' ? <Check size={64} /> : <X size={64} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

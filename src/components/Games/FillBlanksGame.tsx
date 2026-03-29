
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Trophy, Check, X, HelpCircle } from 'lucide-react';

interface FillBlanksGameProps {
  data: {
    questions: Array<{ text: string; answer: string }>;
  };
  onBack: (score?: number) => void;
}

export const FillBlanksGame: React.FC<FillBlanksGameProps> = ({ data, onBack }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  const questions = data.questions || [];

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (feedback || !userInput.trim()) return;

    const isCorrect = userInput.trim().toLowerCase() === questions[currentIdx].answer.toLowerCase();
    
    if (isCorrect) {
      setScore(s => s + 150);
      setFeedback('correct');
    } else {
      setFeedback('wrong');
    }

    setTimeout(() => {
      setFeedback(null);
      setUserInput('');
      if (currentIdx < questions.length - 1) {
        setCurrentIdx(c => c + 1);
      } else {
        setShowResult(true);
      }
    }, 1500);
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
        <p className="text-slate-500 mb-6">Жақсы жұмыс!</p>
        <div className="text-5xl font-black text-blue-600 mb-8">{score} XP</div>
        <button className="btn btn-primary btn-wide" onClick={() => onBack(score)}>Мәзірге қайту</button>
      </motion.div>
    );
  }

  const currentQ = questions[currentIdx];
  const parts = currentQ?.text.split(/\[.*?\]/);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <button onClick={() => onBack()} className="btn btn-ghost btn-sm"><ArrowLeft size={18} /> Шығу</button>
        <div className="text-sm font-bold text-slate-400">Тапсырма {currentIdx + 1} / {questions.length}</div>
        <div className="text-blue-600 font-bold">{score} XP</div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-800 min-h-[300px] flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 mb-8">
          <HelpCircle size={32} />
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-2xl text-center space-y-8">
          <div className="text-xl md:text-2xl font-medium leading-relaxed text-slate-700 dark:text-slate-200">
            {parts?.map((part, i) => (
              <React.Fragment key={i}>
                {part}
                {i < parts.length - 1 && (
                  <span className="inline-block mx-2 border-b-2 border-blue-500 min-w-[100px] text-blue-600 font-bold">
                    {feedback === 'correct' ? currentQ.answer : feedback === 'wrong' ? currentQ.answer : userInput || '...'}
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="flex gap-2">
            <input 
              type="text" 
              className={`flex-1 inp text-center text-lg ${feedback === 'correct' ? 'border-emerald-500 bg-emerald-50' : feedback === 'wrong' ? 'border-red-500 bg-red-50' : ''}`}
              placeholder="Жауапты жазыңыз..."
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              disabled={!!feedback}
              autoFocus
            />
            <button 
              type="submit" 
              className="btn btn-primary px-8"
              disabled={!!feedback || !userInput.trim()}
            >
              Тексеру
            </button>
          </div>

          <AnimatePresence>
            {feedback && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-sm font-bold ${feedback === 'correct' ? 'text-emerald-600' : 'text-red-600'}`}
              >
                {feedback === 'correct' ? 'Дұрыс! ✨' : `Қате. Дұрыс жауап: ${currentQ.answer}`}
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </div>
    </div>
  );
};

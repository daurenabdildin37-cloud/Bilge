
import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface QuizGameProps {
  onBack: (score?: number) => void;
  data: any;
}

export const QuizGame: React.FC<QuizGameProps> = ({ onBack, data }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [selectedOpt, setSelectedOpt] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(15);
  const [shuffledOpts, setShuffledOpts] = useState<string[]>([]);

  const questions = data?.questions || [
    { q: "Қазақстанның астанасы қай қала?", a: "Астана", opts: ["Алматы", "Астана", "Шымкент", "Атырау"] },
    { q: "Абай Құнанбаевтың туған жылы?", a: "1845", opts: ["1835", "1845", "1855", "1865"] },
    { q: "Судың химиялық формуласы?", a: "H2O", opts: ["CO2", "H2O", "O2", "NaCl"] }
  ];

  useEffect(() => {
    if (questions[currentStep]) {
      const opts = [...questions[currentStep].opts];
      // Fisher-Yates shuffle
      for (let i = opts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [opts[i], opts[j]] = [opts[j], opts[i]];
      }
      setShuffledOpts(opts);
    }
  }, [currentStep, questions]);

  useEffect(() => {
    if (isFinished) return;
    if (timeLeft === 0) {
      handleOptClick(""); // Time's up
      return;
    }
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, isFinished]);

  const handleOptClick = (opt: string) => {
    if (selectedOpt) return;
    setSelectedOpt(opt);
    if (opt === questions[currentStep].a) {
      setScore(s => s + 100 + (timeLeft * 5)); // Bonus for speed
    }

    setTimeout(() => {
      if (currentStep < questions.length - 1) {
        setCurrentStep(s => s + 1);
        setSelectedOpt(null);
        setTimeLeft(15);
      } else {
        setIsFinished(true);
      }
    }, 1000);
  };

  if (isFinished) {
    return (
      <div className="fu text-center py-10">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-black mb-2">Ойын аяқталды!</h2>
        <p className="text-slate-500 mb-6">Сіздің нәтижеңіз: <span className="text-blue-600 font-black">{score} XP</span></p>
        <div className="flex gap-4 justify-center">
          <button className="btn btn-primary btn-wide" onClick={() => onBack(score)}>Мәзірге қайту</button>
        </div>
      </div>
    );
  }

  const q = questions[currentStep];

  return (
    <div className="fu">
      <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
        <div className="font-bold text-blue-600">Сұрақ {currentStep + 1}/{questions.length}</div>
        <div className={`font-black flex items-center gap-1 ${timeLeft < 5 ? 'text-red-500 animate-pulse' : 'text-slate-600'}`}>
          <Clock size={16} /> {timeLeft}с
        </div>
        <div className="font-black text-orange-500">{score} XP</div>
      </div>
      
      <div className="kq-card">
        <div className="kq-num">СҰРАҚ</div>
        <div className="kq-text">{q.q}</div>
        {q.imageUrl && (
          <div className="mt-4 max-w-md mx-auto">
            <img 
              src={q.imageUrl} 
              alt="Сұрақ суреті" 
              className="w-full rounded-2xl border-4 border-white shadow-xl" 
              referrerPolicy="no-referrer"
            />
          </div>
        )}
      </div>

      <div className="kq-opts mt-6">
        {shuffledOpts.map((opt: string, i: number) => (
          <button 
            key={i} 
            className={`kq-opt ${selectedOpt === opt ? (opt === q.a ? 'correct' : 'wrong') : selectedOpt && opt === q.a ? 'correct' : ''}`}
            onClick={() => handleOptClick(opt)}
            data-c={String.fromCharCode(65 + i)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
};

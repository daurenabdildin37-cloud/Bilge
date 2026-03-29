
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Trophy, RefreshCw } from 'lucide-react';

interface MemoryGameProps {
  data: {
    cards: Array<{ id: number; content: string }>;
  };
  onBack: (score?: number) => void;
}

interface Card {
  id: number;
  content: string;
  uniqueId: number;
  isFlipped: boolean;
  isMatched: boolean;
  imageUrl?: string;
}

export const MemoryGame: React.FC<MemoryGameProps> = ({ data, onBack }) => {
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    initializeGame();
  }, [data]);

  const initializeGame = () => {
    const baseCards = data.cards || [];
    if (baseCards.length === 0) return;

    // We need pairs. If baseCards has pairs already, use them.
    // If it's just unique items, double them.
    // A simple way is to check if there are duplicate contents.
    const contents = baseCards.map(c => c.content);
    const uniqueContents = new Set(contents);
    
    let gameCards: any[] = [];
    if (uniqueContents.size === baseCards.length) {
      // All unique, double them
      gameCards = [...baseCards, ...baseCards.map(c => ({ ...c, id: c.id + 1000 }))];
    } else {
      // Already has duplicates, use as is (but ensure even number)
      gameCards = baseCards.length % 2 === 0 ? baseCards : [...baseCards, baseCards[0]];
    }

    const shuffled = gameCards
      .map((card, index) => ({
        ...card,
        uniqueId: index,
        isFlipped: false,
        isMatched: false
      }))
      .sort(() => Math.random() - 0.5);
    
    setCards(shuffled);
    setFlippedCards([]);
    setMoves(0);
    setMatches(0);
    setShowResult(false);
  };

  const handleCardClick = (uniqueId: number) => {
    if (flippedCards.length === 2) return;
    const card = cards.find(c => c.uniqueId === uniqueId);
    if (!card || card.isFlipped || card.isMatched) return;

    const newCards = cards.map(c => 
      c.uniqueId === uniqueId ? { ...c, isFlipped: true } : c
    );
    setCards(newCards);

    const newFlipped = [...flippedCards, uniqueId];
    setFlippedCards(newFlipped);

    if (newFlipped.length === 2) {
      setMoves(m => m + 1);
      const [firstId, secondId] = newFlipped;
      const firstCard = cards.find(c => c.uniqueId === firstId);
      const secondCard = newCards.find(c => c.uniqueId === secondId);

      if (firstCard?.content === secondCard?.content) {
        // Match
        setTimeout(() => {
          setCards(prev => prev.map(c => 
            c.uniqueId === firstId || c.uniqueId === secondId 
              ? { ...c, isMatched: true } 
              : c
          ));
          setFlippedCards([]);
          setMatches(m => {
            const newMatches = m + 1;
            if (newMatches === cards.length / 2) {
              setTimeout(() => setShowResult(true), 500);
            }
            return newMatches;
          });
        }, 500);
      } else {
        // No match
        setTimeout(() => {
          setCards(prev => prev.map(c => 
            c.uniqueId === firstId || c.uniqueId === secondId 
              ? { ...c, isFlipped: false } 
              : c
          ));
          setFlippedCards([]);
        }, 1000);
      }
    }
  };

  const calculateScore = () => {
    const baseScore = matches * 100;
    const penalty = Math.max(0, (moves - matches) * 10);
    return Math.max(100, baseScore - penalty);
  };

  if (showResult) {
    const score = calculateScore();
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800"
      >
        <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-yellow-600">
          <Trophy size={40} />
        </div>
        <h2 className="text-2xl font-bold mb-2">Керемет!</h2>
        <p className="text-slate-500 mb-2">Барлық жұптар табылды.</p>
        <p className="text-xs text-slate-400 mb-6">Жүрістер саны: {moves}</p>
        <div className="text-5xl font-black text-blue-600 mb-8">{score} XP</div>
        <div className="flex gap-4">
          <button className="flex-1 btn btn-ghost" onClick={initializeGame}><RefreshCw size={18} className="mr-2" /> Қайталау</button>
          <button className="flex-1 btn btn-primary" onClick={() => onBack(score)}>Мәзірге қайту</button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <button onClick={() => onBack()} className="btn btn-ghost btn-sm"><ArrowLeft size={18} /> Шығу</button>
        <div className="flex gap-4 text-sm font-bold">
          <div className="text-slate-400">Жұптар: {matches} / {cards.length / 2}</div>
          <div className="text-slate-400">Жүрістер: {moves}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {cards.map((card) => (
          <motion.div
            key={card.uniqueId}
            layout
            onClick={() => handleCardClick(card.uniqueId)}
            className={`aspect-square cursor-pointer perspective-1000`}
          >
            <motion.div
              initial={false}
              animate={{ rotateY: card.isFlipped || card.isMatched ? 180 : 0 }}
              transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
              className="relative w-full h-full preserve-3d"
            >
              {/* Front (Hidden state) */}
              <div className={`absolute inset-0 backface-hidden rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 shadow-sm`}>
                <div className="text-2xl font-bold opacity-20">?</div>
              </div>
              {/* Back (Revealed state) */}
              <div className={`absolute inset-0 backface-hidden rounded-xl border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center text-center p-2 text-xs font-bold rotate-y-180 shadow-inner ${card.isMatched ? 'opacity-50 grayscale' : ''}`}>
                {card.imageUrl ? (
                  <img src={card.imageUrl} alt="card" className="max-w-full max-h-full object-contain rounded-lg" referrerPolicy="no-referrer" />
                ) : card.content && (card.content.startsWith('http') || card.content.startsWith('data:image')) ? (
                  <img src={card.content} alt="card" className="max-w-full max-h-full object-contain rounded-lg" referrerPolicy="no-referrer" />
                ) : (
                  <span className="break-words">{card.content || '...'}</span>
                )}
              </div>
            </motion.div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

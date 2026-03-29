
import React, { useState } from 'react';

interface FlashcardsGameProps {
  onBack: () => void;
  data: any;
}

export const FlashcardsGame: React.FC<FlashcardsGameProps> = ({ onBack, data }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const cards = data?.cards || [
    { q: "Derivative (Туынды)", a: "Функцияның өзгеру жылдамдығын сипаттайтын шама." },
    { q: "Photosynthesis", a: "Жарық энергиясының көмегімен органикалық заттардың түзілуі." },
    { q: "Inertia", a: "Дененің өз күйін сақтау қасиеті." }
  ];

  const nextCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIdx((currentIdx + 1) % cards.length);
    }, 150);
  };

  return (
    <div className="fu">
      <div className="fc-prog">
        <div className="fc-prog-bar" style={{ width: `${((currentIdx + 1) / cards.length) * 100}%` }}></div>
      </div>

      <div className="fc-scene" onClick={() => setIsFlipped(!isFlipped)}>
        <div className={`fc-card ${isFlipped ? 'flipped' : ''}`}>
          <div className="fc-front">
            {cards[currentIdx].imageUrl && (
              <div className="mb-4 w-full h-32 overflow-hidden rounded-xl">
                <img 
                  src={cards[currentIdx].imageUrl} 
                  alt="Карта суреті" 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
            <div className="fc-word">{cards[currentIdx].q}</div>
            <div className="fc-hint">Аудару үшін басыңыз</div>
          </div>
          <div className="fc-back">
            <div className="text-center px-4">
              <div className="font-bold text-lg mb-2">Анықтама:</div>
              <p className="text-slate-600 leading-relaxed">{cards[currentIdx].a}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="fc-nav">
        <button className="btn btn-ghost" onClick={onBack}>Шығу</button>
        <button className="btn btn-primary" onClick={nextCard}>Келесі карта</button>
      </div>
    </div>
  );
};


import React, { useState, useEffect } from 'react';

interface MatchingGameProps {
  onBack: () => void;
  data: any;
}

export const MatchingGame: React.FC<MatchingGameProps> = ({ onBack, data }) => {
  const [leftItems, setLeftItems] = useState<any[]>([]);
  const [rightItems, setRightItems] = useState<any[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [selectedRight, setSelectedRight] = useState<number | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [wrong, setWrong] = useState<number | null>(null);

  useEffect(() => {
    const pairs = data?.pairs || [
      { left: "Apple", right: "Алма" },
      { left: "Book", right: "Кітап" },
      { left: "School", right: "Мектеп" }
    ];
    
    setLeftItems(pairs.map((p: any, i: number) => ({ id: i, text: p.left, imageUrl: p.imageUrl })));
    setRightItems([...pairs].map((p: any, i: number) => ({ id: i, text: p.right, imageUrl: p.imageUrl })).sort(() => Math.random() - 0.5));
  }, [data]);

  const handleLeftClick = (id: number) => {
    if (matched.includes(id)) return;
    setSelectedLeft(id);
    if (selectedRight !== null) checkMatch(id, selectedRight);
  };

  const handleRightClick = (id: number) => {
    if (matched.includes(id)) return;
    setSelectedRight(id);
    if (selectedLeft !== null) checkMatch(selectedLeft, id);
  };

  const checkMatch = (lId: number, rId: number) => {
    if (lId === rId) {
      setMatched([...matched, lId]);
      setSelectedLeft(null);
      setSelectedRight(null);
    } else {
      setWrong(lId);
      setTimeout(() => {
        setWrong(null);
        setSelectedLeft(null);
        setSelectedRight(null);
      }, 500);
    }
  };

  if (matched.length === leftItems.length && leftItems.length > 0) {
    return (
      <div className="fu text-center py-10">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-black mb-2">Керемет!</h2>
        <p className="text-slate-500 mb-6">Барлық жұптарды таптыңыз!</p>
        <button className="btn btn-primary" onClick={onBack}>Мәзірге қайту</button>
      </div>
    );
  }

  return (
    <div className="fu">
      <div className="match-grid">
        <div className="match-col">
          {leftItems.map(item => (
            <div 
              key={item.id} 
              className={`match-item flex items-center gap-2 ${selectedLeft === item.id ? 'selected' : ''} ${matched.includes(item.id) ? 'matched' : ''} ${wrong === item.id ? 'wrong' : ''}`}
              onClick={() => handleLeftClick(item.id)}
            >
              {item.imageUrl && <img src={item.imageUrl} className="w-8 h-8 object-cover rounded shadow-sm" referrerPolicy="no-referrer" />}
              <span className="flex-1">{item.text}</span>
            </div>
          ))}
        </div>
        <div className="match-col">
          {rightItems.map(item => (
            <div 
              key={item.id} 
              className={`match-item flex items-center gap-2 ${selectedRight === item.id ? 'selected' : ''} ${matched.includes(item.id) ? 'matched' : ''}`}
              onClick={() => handleRightClick(item.id)}
            >
              {item.imageUrl && <img src={item.imageUrl} className="w-8 h-8 object-cover rounded shadow-sm" referrerPolicy="no-referrer" />}
              <span className="flex-1">{item.text}</span>
            </div>
          ))}
        </div>
      </div>
      <button className="btn btn-ghost btn-wide mt-4" onClick={onBack}>Шығу</button>
    </div>
  );
};

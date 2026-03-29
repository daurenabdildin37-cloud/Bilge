
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Trophy, CheckCircle2 } from 'lucide-react';

interface WordSearchGameProps {
  data: {
    words: string[];
    gridSize?: number;
  };
  onBack: (score?: number) => void;
}

export const WordSearchGame: React.FC<WordSearchGameProps> = ({ data, onBack }) => {
  const [grid, setGrid] = useState<string[][]>([]);
  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [selection, setSelection] = useState<{ r: number; c: number }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const words = (data.words || []).map(w => w.toUpperCase());
  const size = data.gridSize || 10;

  useEffect(() => {
    generateGrid();
  }, [data]);

  const generateGrid = () => {
    const newGrid = Array(size).fill(null).map(() => Array(size).fill(''));
    
    // Place words
    words.forEach(word => {
      let placed = false;
      let attempts = 0;
      while (!placed && attempts < 100) {
        const dir = Math.random() > 0.5 ? { r: 0, c: 1 } : { r: 1, c: 0 }; // Horizontal or Vertical
        const startR = Math.floor(Math.random() * (size - (dir.r * word.length)));
        const startC = Math.floor(Math.random() * (size - (dir.c * word.length)));
        
        let canPlace = true;
        for (let i = 0; i < word.length; i++) {
          const r = startR + i * dir.r;
          const c = startC + i * dir.c;
          if (newGrid[r][c] !== '' && newGrid[r][c] !== word[i]) {
            canPlace = false;
            break;
          }
        }

        if (canPlace) {
          for (let i = 0; i < word.length; i++) {
            newGrid[startR + i * dir.r][startC + i * dir.c] = word[i];
          }
          placed = true;
        }
        attempts++;
      }
    });

    // Fill empty cells
    const alphabet = 'АӘБВГҒДЕЁЖЗИЙКҚЛМНҢОӨПРСТУҰҮФХҺЦЧШЩЪЫІЬЭЮЯ';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (newGrid[r][c] === '') {
          newGrid[r][c] = alphabet[Math.floor(Math.random() * alphabet.length)];
        }
      }
    }
    setGrid(newGrid);
  };

  const handleMouseDown = (r: number, c: number) => {
    setIsDragging(true);
    setSelection([{ r, c }]);
  };

  const handleMouseEnter = (r: number, c: number) => {
    if (!isDragging || selection.length === 0) return;
    
    const start = selection[0];
    const dr = r - start.r;
    const dc = c - start.c;
    
    // Check if it's a straight line (horizontal, vertical, or 45-degree diagonal)
    const isHorizontal = dr === 0;
    const isVertical = dc === 0;
    const isDiagonal = Math.abs(dr) === Math.abs(dc);
    
    if (isHorizontal || isVertical || isDiagonal) {
      const steps = Math.max(Math.abs(dr), Math.abs(dc));
      const stepR = dr === 0 ? 0 : dr / steps;
      const stepC = dc === 0 ? 0 : dc / steps;
      
      const newSelection = [];
      for (let i = 0; i <= steps; i++) {
        newSelection.push({ 
          r: start.r + i * stepR, 
          c: start.c + i * stepC 
        });
      }
      setSelection(newSelection);
    }
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    
    const selectedWord = selection.map(s => grid[Math.round(s.r)][Math.round(s.c)]).join('');
    const reversedWord = selectedWord.split('').reverse().join('');
    
    const found = words.find(w => w === selectedWord || w === reversedWord);
    
    if (found && !foundWords.includes(found)) {
      setFoundWords(prev => [...prev, found]);
      setScore(s => s + 200);
      if (foundWords.length + 1 === words.length) {
        setTimeout(() => setShowResult(true), 1000);
      }
    }
    setSelection([]);
  };

  // Touch support
  const handleTouchStart = (e: React.TouchEvent, r: number, c: number) => {
    e.preventDefault();
    handleMouseDown(r, c);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const cell = element?.closest('[data-cell]');
    if (cell) {
      const r = parseInt(cell.getAttribute('data-r') || '0');
      const c = parseInt(cell.getAttribute('data-c') || '0');
      handleMouseEnter(r, c);
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
        <h2 className="text-2xl font-bold mb-2">Тамаша!</h2>
        <p className="text-slate-500 mb-6">Барлық сөздерді таптыңыз.</p>
        <div className="text-5xl font-black text-blue-600 mb-8">{score} XP</div>
        <button className="btn btn-primary btn-wide" onClick={() => onBack(score)}>Мәзірге қайту</button>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <div className="flex-1 space-y-4">
        <div className="flex justify-between items-center">
          <button onClick={() => onBack()} className="btn btn-ghost btn-sm"><ArrowLeft size={18} /> Шығу</button>
          <div className="text-blue-600 font-bold">{score} XP</div>
        </div>

        <div 
          className="grid gap-1 bg-slate-200 dark:bg-slate-800 p-2 rounded-xl select-none touch-none relative"
          style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
          onMouseLeave={() => { setIsDragging(false); setSelection([]); }}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUp}
        >
          {grid.map((row, r) => row.map((char, c) => {
            const isSelected = selection.some(s => Math.round(s.r) === r && Math.round(s.c) === c);
            return (
              <div
                key={`${r}-${c}`}
                data-cell
                data-r={r}
                data-c={c}
                onMouseDown={() => handleMouseDown(r, c)}
                onMouseEnter={() => handleMouseEnter(r, c)}
                onMouseUp={handleMouseUp}
                onTouchStart={(e) => handleTouchStart(e, r, c)}
                className={`aspect-square flex items-center justify-center text-xs md:text-sm font-bold rounded-md transition-all cursor-pointer ${isSelected ? 'bg-blue-500 text-white shadow-lg scale-110 z-10' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'}`}
              >
                {char}
              </div>
            );
          }))}
        </div>
      </div>

      <div className="w-full md:w-64 space-y-4">
        <div className="card p-4">
          <h4 className="font-bold mb-4 flex items-center gap-2">
            <CheckCircle2 size={18} className="text-blue-500" />
            Сөздер тізімі ({foundWords.length}/{words.length})
          </h4>
          <div className="space-y-2">
            {words.map((word, i) => (
              <div 
                key={i} 
                className={`flex items-center justify-between p-2 rounded-lg text-sm ${foundWords.includes(word) ? 'bg-emerald-50 text-emerald-600 line-through' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
              >
                {word}
                {foundWords.includes(word) && <CheckCircle2 size={14} />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

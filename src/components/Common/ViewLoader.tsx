import React from 'react';

export const ViewLoader = () => (
  <div className="flex items-center justify-center p-20 h-full w-full">
    <div className="flex gap-1">
      <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
      <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
      <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce"></div>
    </div>
  </div>
);

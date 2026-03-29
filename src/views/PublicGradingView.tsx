import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import GradingSimulatorView from './GradingSimulatorView';
import { ViewLoader } from '../components/Common/ViewLoader';

interface PublicGradingViewProps {
  gradingId: string;
  addNotification?: (title: string, message: string, type?: any) => void;
  showToast?: (message: string) => void;
}

const PublicGradingView: React.FC<PublicGradingViewProps> = ({ gradingId, addNotification, showToast }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gradingData, setGradingData] = useState<any>(null);

  useEffect(() => {
    const fetchGrading = async () => {
      try {
        const docRef = doc(db, 'library', gradingId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.type === 'Бағалау') {
            setGradingData(data.data);
          } else {
            setError('Бұл бағалау материалы емес.');
          }
        } else {
          setError('Бағалау табылмады.');
        }
      } catch (err) {
        console.error("Error fetching public grading:", err);
        setError('Деректерді жүктеу кезінде қате кетті.');
      } finally {
        setLoading(false);
      }
    };

    fetchGrading();
  }, [gradingId]);

  if (loading) return <ViewLoader />;
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4 text-center bg-slate-50">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">{error}</h1>
        <p className="text-slate-500 mb-6">Сілтеменің дұрыстығын тексеріңіз немесе автормен хабарласыңыз.</p>
        <button 
          onClick={() => window.location.href = '/'}
          className="btn btn-primary"
        >
          Басты бетке өту
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white z-[1000]">
      <GradingSimulatorView 
        initialData={gradingData}
        isPublic={true}
        addNotification={addNotification}
        showToast={showToast}
      />
    </div>
  );
};

export default PublicGradingView;

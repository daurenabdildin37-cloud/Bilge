
import React, { useState } from 'react';
import { Send, MessageSquare, Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/error-handling';
import { Feedback } from '../types';

interface FeedbackViewProps {
  showToast: (message: string) => void;
}

const FeedbackView: React.FC<FeedbackViewProps> = ({ showToast }) => {
  const [category, setCategory] = useState<Feedback['category']>('General Feedback');
  const [message, setMessage] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      showToast('Пікіріңізді жазыңыз! ⚠️');
      return;
    }

    setIsSubmitting(true);
    try {
      const user = auth.currentUser;
      const feedbackData: any = {
        category,
        message,
        status: 'new',
        createdAt: serverTimestamp()
      };

      if (user?.uid) feedbackData.userId = user.uid;
      if (user?.displayName) feedbackData.userName = user.displayName;
      if (user?.email) feedbackData.userEmail = user.email;
      if (contactInfo.trim()) feedbackData.contactInfo = contactInfo.trim();

      await addDoc(collection(db, 'feedback'), feedbackData);
      
      setIsSuccess(true);
      showToast('Пікіріңіз қабылданды! Рақмет! ❤️');
      setMessage('');
      setContactInfo('');
    } catch (err) {
      console.error('Feedback submission error:', err);
      handleFirestoreError(err, OperationType.CREATE, 'feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={40} />
        </div>
        <h1 className="text-3xl font-black text-slate-900 mb-4">Рақмет!</h1>
        <p className="text-slate-600 mb-8 text-lg">
          Сіздің пікіріңіз сәтті қабылданды. Біз оны міндетті түрде қарастырамыз және платформаны жақсартуға қолданамыз.
        </p>
        <button 
          onClick={() => setIsSuccess(false)}
          className="btn btn-primary px-8"
        >
          Тағы пікір қалдыру
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-10">
        <div className="w-16 h-16 rounded-3xl bg-blue-50 flex items-center justify-center text-blue-600 border-2 border-blue-100 shadow-sm">
          <MessageSquare size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900">Кері байланыс</h1>
          <p className="text-slate-500 text-lg">Платформаны бірге жақсартайық</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="card card-pad shadow-xl border-slate-100">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="fg">
                <label className="flabel text-base">Пікір санаты</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(['Bug Report', 'Suggestion', 'General Feedback'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`flex items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all font-bold ${
                        category === cat 
                          ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-md' 
                          : 'bg-white border-slate-100 text-slate-500 hover:border-blue-200'
                      }`}
                    >
                      {cat === 'Bug Report' && <AlertCircle size={18} />}
                      {cat === 'Suggestion' && <Shield size={18} />}
                      {cat === 'General Feedback' && <MessageSquare size={18} />}
                      <span>
                        {cat === 'Bug Report' ? 'Қате' : cat === 'Suggestion' ? 'Ұсыныс' : 'Жалпы'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="fg">
                <label className="flabel text-base">Сіздің хабарламаңыз</label>
                <textarea
                  className="inp min-h-[200px] text-lg p-5"
                  placeholder="Өз ойыңызбен бөлісіңіз, ұсыныс айтыңыз немесе табылған қате туралы толық жазыңыз..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  required
                />
              </div>

              <div className="fg">
                <label className="flabel text-base">Байланыс мәліметтері (міндетті емес)</label>
                <input
                  type="text"
                  className="inp h-14 px-5"
                  placeholder="Email немесе телефон нөмірі (сізбен хабарласуымыз үшін)"
                  value={contactInfo}
                  onChange={e => setContactInfo(e.target.value)}
                />
              </div>

              <div className="pt-4">
                <button 
                  type="submit" 
                  className="btn btn-primary w-full h-14 text-lg font-black shadow-lg shadow-blue-500/20"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Жіберілуде...
                    </div>
                  ) : (
                    <>
                      <Send size={20} className="mr-2" />
                      Пікірді жіберу
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card card-pad bg-slate-900 text-white border-none shadow-xl">
            <h3 className="text-xl font-black mb-4 flex items-center gap-2">
              <Shield className="text-blue-400" size={24} />
              Біз үшін маңызды
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              Әрбір пікір мұқият оқылады. Біз Bilge AI платформасын мұғалімдер үшін ең ыңғайлы құрал етуге тырысамыз.
            </p>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                  <CheckCircle2 size={14} />
                </div>
                <p className="text-xs text-slate-400">Қателерді тез арада түзетеміз</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                  <CheckCircle2 size={14} />
                </div>
                <p className="text-xs text-slate-400">Жаңа функциялар қосамыз</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                  <CheckCircle2 size={14} />
                </div>
                <p className="text-xs text-slate-400">Интерфейсті жақсартамыз</p>
              </div>
            </div>
          </div>

          <div className="card card-pad border-blue-100 bg-blue-50/30">
            <h4 className="font-bold text-blue-900 mb-2">Көмек керек пе?</h4>
            <p className="text-sm text-blue-700 mb-4">
              Егер сізде шұғыл сұрақ болса, техникалық қолдау көрсету орталығына хабарласа аласыз.
            </p>
            <a 
              href="mailto:support@bilge.ai" 
              className="text-blue-600 font-bold text-sm hover:underline"
            >
              support@bilge.ai
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedbackView;

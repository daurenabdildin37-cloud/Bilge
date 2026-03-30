
import * as React from 'react';
import { 
  Lightbulb, 
  ClipboardList, 
  History, 
  Plus, 
  Star, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  FileCode, 
  ListChecks,
  Loader2,
  Github,
  Copy,
  Terminal,
  Users,
  FileText,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  loadProposals, 
  approveProposal, 
  rejectProposal, 
  generateIdeas, 
  createProposalFromIdea, 
  pushToGitHub,
  ExtensionProposal,
  ExtensionIdea
} from '../services/codeExtensionService';

interface ExtensionsViewProps {
  addNotification: (title: string, message: string, type: string) => void;
}

const ExtensionsView = ({ addNotification }: ExtensionsViewProps) => {
  const [proposals, setProposals] = React.useState<ExtensionProposal[]>([]);
  const [ideas, setIdeas] = React.useState<ExtensionIdea[]>([]);
  const [isGeneratingIdeas, setIsGeneratingIdeas] = React.useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = React.useState<string | null>(null);
  const [isPushing, setIsPushing] = React.useState<string | null>(null);
  const [selectedProposal, setSelectedProposal] = React.useState<{ proposal: ExtensionProposal, index: number } | null>(null);
  const [activeTab, setActiveTab] = React.useState<'ideas' | 'proposals' | 'history'>('ideas');

  React.useEffect(() => {
    setProposals(loadProposals());
  }, []);

  const handleGenerateIdeas = async () => {
    setIsGeneratingIdeas(true);
    try {
      const newIdeas = await generateIdeas();
      setIdeas(newIdeas);
      if (newIdeas.length > 0) {
        addNotification('Идеялар дайын 💡', `${newIdeas.length} жаңа мүмкіндік ұсынылды.`, 'success');
      } else {
        addNotification('Мәлімет аз', 'Жаңа идеялар үшін көбірек аналитика қажет.', 'info');
      }
    } catch (error) {
      addNotification('Қате', 'Идеяларды жасау мүмкін болмады.', 'error');
    } finally {
      setIsGeneratingIdeas(false);
    }
  };

  const handleCreatePlan = async (idea: ExtensionIdea) => {
    setIsGeneratingPlan(idea.id);
    try {
      const proposal = await createProposalFromIdea(idea);
      setProposals(loadProposals());
      setActiveTab('proposals');
      addNotification('Жоспар дайын 📋', 'AI техникалық жоспар мен кодты дайындады.', 'success');
    } catch (error) {
      addNotification('Қате', 'Жоспар жасау сәтсіз аяқталды.', 'error');
    } finally {
      setIsGeneratingPlan(null);
    }
  };

  const handleApprove = async (index: number) => {
    const proposal = proposals[index];
    if (!proposal || !proposal.plan) return;

    const approved = approveProposal(index);
    if (approved) {
      setProposals(loadProposals());
      
      if (proposal.plan.generatedCode) {
        setIsPushing(proposal.plan.idea.id);
        const success = await pushToGitHub(proposal, proposal.plan.generatedCode);
        setIsPushing(null);
        
        if (success) {
          addNotification('GitHub-қа жіберілді! 🚀', 'Код feature/ai-extension бұтағына сәтті push жасалды.', 'success');
        } else {
          addNotification('GitHub қатесі ❌', 'Кодты жіберу мүмкін болмады. Токенді тексеріңіз.', 'error');
        }
      }
    }
  };

  const handleReject = (index: number) => {
    rejectProposal(index);
    setProposals(loadProposals());
    setSelectedProposal(null);
    addNotification('Қабылданбады', 'Ұсыныс тарихқа жіберілді.', 'info');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addNotification('Көшірілді', 'Код алмасу буферіне сақталды.', 'success');
  };

  const truncate = (text: string, limit: number = 200) => {
    if (text.length <= limit) return text;
    return text.slice(0, limit) + '...';
  };

  const renderStars = (priority: number) => {
    return Array.from({ length: 10 }).map((_, i) => (
      <Star 
        key={i} 
        size={14} 
        className={i < priority ? 'text-amber-400 fill-amber-400' : 'text-slate-200 dark:text-slate-700'} 
      />
    ));
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20';
      case 'medium': return 'text-amber-500 bg-amber-50 dark:bg-amber-900/20';
      case 'high': return 'text-rose-500 bg-rose-50 dark:bg-rose-900/20';
      default: return 'text-slate-500 bg-slate-50 dark:bg-slate-900/20';
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black mb-2 flex items-center gap-3">
          <span className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-2xl">🧠</span>
          AI Кеңейту Жүйесі
        </h1>
        <p className="text-slate-500 dark:text-slate-400">AI платформаңды өзі жетілдіреді. Сен тек бекітесің.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-2xl mb-8 w-fit">
        {[
          { id: 'ideas', label: '💡 Идеялар' },
          { id: 'proposals', label: '📋 Ұсыныстар' },
          { id: 'history', label: '📜 Тарих' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-2.5 rounded-xl font-bold transition-all ${
              activeTab === tab.id 
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'ideas' && (
          <motion.div
            key="ideas"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Жаңа мүмкіндіктер</h2>
              <button
                onClick={handleGenerateIdeas}
                disabled={isGeneratingIdeas}
                className="btn btn-primary flex items-center gap-2"
              >
                {isGeneratingIdeas ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                Жаңа идеялар жасау
              </button>
            </div>

            {ideas.length === 0 ? (
              <div className="card p-12 text-center">
                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                  <Lightbulb size={32} />
                </div>
                <h3 className="text-lg font-bold mb-2">Идеялар әлі жоқ</h3>
                <p className="text-slate-500">Аналитика негізінде жаңа мүмкіндіктер жасау үшін батырманы басыңыз.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {ideas.map(idea => (
                  <motion.div 
                    key={idea.id}
                    layout
                    className="card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-lg">{idea.title}</h3>
                        <div className="flex gap-0.5">{renderStars(idea.priority)}</div>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-sm">{idea.description}</p>
                    </div>
                    <button
                      onClick={() => handleCreatePlan(idea)}
                      disabled={!!isGeneratingPlan}
                      className="btn bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-none hover:bg-indigo-100 dark:hover:bg-indigo-900/50 flex items-center gap-2 whitespace-nowrap"
                    >
                      {isGeneratingPlan === idea.id ? (
                        <Loader2 className="animate-spin" size={18} />
                      ) : (
                        <>Жоспар жасау <ArrowRight size={18} /></>
                      )}
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'proposals' && (
          <motion.div
            key="proposals"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <h2 className="text-xl font-bold">Бекітуді күтуде</h2>
            
            {proposals.filter(p => p.status === 'pending').length === 0 ? (
              <div className="card p-12 text-center">
                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                  <ClipboardList size={32} />
                </div>
                <h3 className="text-lg font-bold mb-2">Ұсыныстар жоқ</h3>
                <p className="text-slate-500">Алдымен идеялардан техникалық жоспар жасаңыз.</p>
              </div>
            ) : (
              <div className="grid gap-6">
                {proposals.map((proposal, idx) => {
                  if (proposal.status !== 'pending' || !proposal.plan) return null;
                  return (
                    <div 
                      key={idx} 
                      className="card overflow-hidden border-2 border-indigo-100 dark:border-indigo-900/30 cursor-pointer hover:border-indigo-300 transition-all"
                      onClick={() => setSelectedProposal({ proposal, index: idx })}
                    >
                      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-xl mb-1">{proposal.plan.idea.title}</h3>
                          <p className="text-slate-500 text-sm">{proposal.plan.idea.description}</p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${getRiskColor(proposal.plan.riskLevel)}`}>
                          <AlertTriangle size={12} />
                          {proposal.plan.riskLevel === 'low' ? 'Төмен тәуекел' : proposal.plan.riskLevel === 'medium' ? 'Орташа тәуекел' : 'Жоғары тәуекел'}
                        </div>
                      </div>
                      
                      <div className="p-6 grid md:grid-cols-2 gap-8 bg-slate-50/50 dark:bg-slate-800/20">
                        <div>
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <ListChecks size={14} /> Іске асыру қадамдары
                          </h4>
                          <ul className="space-y-3">
                            {proposal.plan.steps.map((step, i) => (
                              <li key={i} className="flex gap-3 text-sm">
                                <span className="w-5 h-5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                                  {i + 1}
                                </span>
                                <span className="text-slate-600 dark:text-slate-300">{step}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        <div>
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <FileCode size={14} /> Өзгеретін файлдар
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {proposal.plan.affectedFiles.map((file, i) => (
                              <span key={i} className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-[11px] font-mono text-slate-500">
                                {file}
                              </span>
                            ))}
                          </div>
                          
                          <div className="mt-8 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold mb-1">AI Болжамы:</p>
                            <p className="text-sm font-medium">~{proposal.plan.estimatedChanges} жол код қосылады</p>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-white dark:bg-slate-900 flex justify-end gap-3">
                        <button
                          onClick={() => handleReject(idx)}
                          className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2"
                        >
                          <XCircle size={18} /> Қабылдамау
                        </button>
                        <button
                          onClick={() => handleApprove(idx)}
                          disabled={isPushing === proposal.plan.idea.id}
                          className="px-8 py-2.5 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          {isPushing === proposal.plan.idea.id ? (
                            <Loader2 className="animate-spin" size={18} />
                          ) : (
                            <><CheckCircle2 size={18} /> Бекіту және Push</>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <h2 className="text-xl font-bold">Тарих</h2>
            
            {proposals.filter(p => p.status !== 'pending').length === 0 ? (
              <div className="card p-12 text-center">
                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                  <History size={32} />
                </div>
                <h3 className="text-lg font-bold mb-2">Тарих бос</h3>
                <p className="text-slate-500">Әлі ешқандай ұсыныс өңделмеді.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {proposals.filter(p => p.status !== 'pending').reverse().map((proposal, idx) => (
                  <div key={idx} className="card p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        proposal.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                        proposal.status === 'rejected' ? 'bg-rose-50 text-rose-600' :
                        'bg-blue-50 text-blue-600'
                      }`}>
                        {proposal.status === 'approved' ? <CheckCircle2 size={20} /> : 
                         proposal.status === 'rejected' ? <XCircle size={20} /> : 
                         <Github size={20} />}
                      </div>
                      <div>
                        <h4 className="font-bold">{proposal.plan?.idea.title || 'Белгісіз мүмкіндік'}</h4>
                        <p className="text-xs text-slate-400">{new Date(proposal.createdAt).toLocaleString('kk-KZ')}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      proposal.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                      proposal.status === 'rejected' ? 'bg-rose-100 text-rose-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {proposal.status === 'approved' ? 'Бекітілген' : 
                       proposal.status === 'rejected' ? 'Қабылданбаған' : 
                       'Іске асырылған'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Proposal Detail Modal */}
      <AnimatePresence>
        {selectedProposal && (
          <div className="modal-ov show flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="modal-box max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col p-0"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 sticky top-0 z-10">
                <h3 className="text-xl font-bold">{selectedProposal.proposal.plan?.idea.title}</h3>
                <button 
                  onClick={() => setSelectedProposal(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-8 space-y-10">
                {/* 1. Three Agent Consensus */}
                <section>
                  <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Users size={16} /> 🤖 Үш Агент Келісімі
                  </h4>
                  <div className="grid md:grid-cols-3 gap-4">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="text-[10px] font-black text-indigo-500 uppercase mb-3">Агент {i + 1}</div>
                        <div className="space-y-4">
                          <div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Идея нұсқасы:</div>
                            <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400 italic">
                              "{truncate(selectedProposal.proposal.ideaVersions?.[i] || '')}"
                            </p>
                          </div>
                          <div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Логика нұсқасы:</div>
                            <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                              {truncate(selectedProposal.proposal.logicVersions?.[i] || '')}
                            </p>
                          </div>
                          <div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Жоспар нұсқасы:</div>
                            <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                              {truncate(selectedProposal.proposal.planVersions?.[i] || '')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* 2. Changes */}
                <section>
                  <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <FileText size={16} /> 📝 Өзгерістер
                  </h4>
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="text-xs font-bold text-slate-500">Іске асыру қадамдары:</div>
                      <ol className="space-y-3">
                        {selectedProposal.proposal.plan?.steps.map((step, i) => (
                          <li key={i} className="flex gap-3 text-sm">
                            <span className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                              {i + 1}
                            </span>
                            <span className="text-slate-600 dark:text-slate-300">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                    <div className="space-y-6">
                      <div>
                        <div className="text-xs font-bold text-slate-500 mb-3">📁 Өзгеретін файлдар:</div>
                        <div className="space-y-2">
                          {selectedProposal.proposal.plan?.affectedFiles.map((file, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs font-mono text-slate-500 bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                              <FileCode size={14} className="text-indigo-400" />
                              {file}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold mb-1">Көлем болжамы:</p>
                        <p className="text-sm font-medium">Шамамен өзгерістер саны: {selectedProposal.proposal.plan?.estimatedChanges} жол</p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 3. Risk Level */}
                <section>
                  <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <AlertTriangle size={16} /> ⚠️ Тәуекел деңгейі
                  </h4>
                  <div className={`p-6 rounded-2xl border-2 ${
                    selectedProposal.proposal.plan?.riskLevel === 'low' ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30' :
                    selectedProposal.proposal.plan?.riskLevel === 'medium' ? 'bg-amber-50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/30' :
                    'bg-rose-50 border-rose-100 dark:bg-rose-900/10 dark:border-rose-900/30'
                  }`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${getRiskColor(selectedProposal.proposal.plan?.riskLevel || 'low')}`}>
                        {selectedProposal.proposal.plan?.riskLevel === 'low' ? '🟢 Төмен тәуекел' : 
                         selectedProposal.proposal.plan?.riskLevel === 'medium' ? '🟡 Орташа тәуекел' : 
                         '🔴 Жоғары тәуекел'}
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {selectedProposal.proposal.plan?.riskLevel === 'high' 
                        ? 'Бұл өзгеріс бар функционалға әсер етуі мүмкін. Мұқият тексеріңіз. Кодтың маңызды бөліктерін қамтиды.' 
                        : selectedProposal.proposal.plan?.riskLevel === 'medium'
                        ? 'Орташа деңгейдегі өзгерістер. Жаңа файлдар қосылады және кейбір бар файлдар жаңартылады.'
                        : 'Қауіпсіз өзгеріс. Негізінен жаңа функционал қосылады, бар кодқа әсері минималды.'}
                    </p>
                  </div>
                </section>

                {/* 4. Generated Code */}
                <section>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Terminal size={16} /> 💻 Жасалған Код
                    </h4>
                    <button 
                      onClick={() => copyToClipboard(selectedProposal.proposal.plan?.generatedCode || '')}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5"
                    >
                      <Copy size={14} /> Кодты көшіру
                    </button>
                  </div>
                  <div className="relative group">
                    <div className="max-h-[400px] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-900 p-6 font-mono text-[12px] leading-relaxed text-slate-300 scrollbar-thin scrollbar-thumb-slate-700">
                      <pre className="whitespace-pre-wrap">{selectedProposal.proposal.plan?.generatedCode}</pre>
                    </div>
                  </div>
                </section>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-4 sticky bottom-0 z-10">
                <button
                  onClick={() => handleReject(selectedProposal.index)}
                  className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center gap-2"
                >
                  <XCircle size={20} /> Қабылдамау
                </button>
                <button
                  onClick={() => handleApprove(selectedProposal.index)}
                  disabled={!!isPushing}
                  className="px-10 py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-200 dark:shadow-none transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isPushing === selectedProposal.proposal.plan?.idea.id ? (
                    <><Loader2 className="animate-spin" size={20} /> Жіберілуде...</>
                  ) : (
                    <><Github size={20} /> Бекіту және GitHub-қа жіберу</>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExtensionsView;

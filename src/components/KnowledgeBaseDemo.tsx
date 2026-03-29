
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Search, Save, Sparkles, BookOpen, Loader2 } from 'lucide-react';

export const KnowledgeBaseDemo: React.FC = () => {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [materials, setMaterials] = useState<any[]>([]);
  const [prompt, setPrompt] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Search materials
  const handleSearch = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/search-material?userId=${user.uid}&query=${query}`);
      const data = await res.json();
      setMaterials(data);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate content with RAG
  const handleGenerate = async () => {
    if (!user || !prompt) return;
    setLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          prompt,
          options: { topic: query || 'General Education' }
        }),
      });
      const data = await res.json();
      setGeneratedContent(data.text);
      // Refresh materials list since it's auto-saved
      handleSearch();
    } catch (error) {
      console.error('Generation error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Manual save
  const handleSave = async () => {
    if (!user || !generatedContent) return;
    setSaving(true);
    try {
      await fetch('/api/save-material', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          title: `Manual Save: ${query || 'New Material'}`,
          content: generatedContent,
          topic: query
        }),
      });
      alert('Material saved to Knowledge Base!');
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-3 mb-6">
        <BookOpen className="w-8 h-8 text-emerald-600" />
        <h1 className="text-2xl font-bold">Teacher's Knowledge Base (RAG)</h1>
      </div>

      {/* Search Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Search className="w-5 h-5" /> Search Existing Materials
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by topic, title, or content..."
            className="flex-1 px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="bg-emerald-600 text-white px-6 py-2 rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>

        {materials.length > 0 && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {materials.map((m) => (
              <div key={m.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                <p className="font-medium truncate">{m.title}</p>
                <p className="text-slate-500 text-xs mt-1 truncate">{m.topic || 'No topic'}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Generation Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" /> Generate New Content with RAG
        </h2>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what you want to generate (e.g., 'Create a lesson plan about photosynthesis'). The system will automatically use related materials from your Knowledge Base."
          className="w-full h-32 px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4"
        />
        <button
          onClick={handleGenerate}
          disabled={loading || !prompt}
          className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          Generate Improved Content
        </button>

        {generatedContent && (
          <div className="mt-6 space-y-4">
            <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 whitespace-pre-wrap text-slate-700">
              {generatedContent}
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 text-emerald-600 font-medium hover:text-emerald-700"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save to Knowledge Base
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

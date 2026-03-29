
import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, Globe, Trash2, MapPin, Edit2, Share2, X, ChevronRight } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { handleFirestoreError, OperationType } from '../lib/error-handling';

// Fix for default marker icon in Leaflet with React
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Pin {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  lat: number;
  lng: number;
}

interface MapViewProps {
  addNotification?: (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

const EMOJIS = ['📍','🔴','🟡','🟢','🔵','🏙️','🌊','⛰️','🌿','🏛️','⭐','❗','🔎','✏️','🏠','🌍'];

const MapEvents = ({ onMapClick }: { onMapClick: (e: L.LeafletMouseEvent) => void }) => {
  const map = useMap();
  useEffect(() => {
    map.on('click', onMapClick);
    return () => {
      map.off('click', onMapClick);
    };
  }, [map, onMapClick]);
  return null;
};

const FlyToLocation = ({ center, zoom }: { center: [number, number], zoom: number }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom, { duration: 1.2 });
    }
  }, [center, zoom, map]);
  return null;
};

const MapView = ({ addNotification }: MapViewProps) => {
  const { user } = useAuth();
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingPin, setPendingPin] = useState<{ lat: number; lng: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedEmoji, setSelectedEmoji] = useState('📍');
  const [pinName, setPinName] = useState('');
  const [pinDesc, setPinDesc] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([48, 66]);
  const [mapZoom, setMapZoom] = useState(5);
  const [showHint, setShowHint] = useState(false);

  // Firestore Sync & Migration
  useEffect(() => {
    if (!user) {
      setPins([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'pins'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pinsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Pin[];
      setPins(pinsData);
      setLoading(false);
      if (pinsData.length === 0) setShowHint(true);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'pins');
      setLoading(false);
    });

    // Migration from localStorage
    const migrate = async () => {
      const saved = localStorage.getItem('bilge_pins');
      if (saved) {
        try {
          const localPins = JSON.parse(saved);
          if (localPins.length > 0) {
            const batch = writeBatch(db);
            localPins.forEach((p: any) => {
              const newDoc = doc(collection(db, 'pins'));
              batch.set(newDoc, {
                userId: user.uid,
                name: p.name,
                desc: p.desc || '',
                emoji: p.emoji || '📍',
                lat: p.lat,
                lng: p.lng,
                createdAt: serverTimestamp()
              });
            });
            await batch.commit();
            localStorage.removeItem('bilge_pins');
            if (addNotification) {
              addNotification('Көшірілді! 🗺️', 'Жергілікті белгілер бұлттық қоймаға көшірілді.', 'success');
            }
          }
        } catch (e) {
          console.error('Migration error:', e);
        }
      }
    };
    migrate();

    return () => unsubscribe();
  }, [user, addNotification]);

  const handleMapClick = (e: L.LeafletMouseEvent) => {
    setPendingPin({ lat: e.latlng.lat, lng: e.latlng.lng });
    setEditingId(null);
    setPinName('');
    setPinDesc('');
    setSelectedEmoji('📍');
    setIsModalOpen(true);
    setShowHint(false);
  };

  const savePin = async () => {
    if (!pinName.trim() || !user) return;

    try {
      if (editingId) {
        await updateDoc(doc(db, 'pins', editingId), {
          name: pinName,
          desc: pinDesc,
          emoji: selectedEmoji,
          updatedAt: serverTimestamp()
        });
      } else if (pendingPin) {
        await addDoc(collection(db, 'pins'), {
          userId: user.uid,
          name: pinName,
          desc: pinDesc,
          emoji: selectedEmoji,
          lat: pendingPin.lat,
          lng: pendingPin.lng,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      setEditingId(null);
      setPendingPin(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'pins');
    }
  };

  const deletePin = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'pins', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `pins/${id}`);
    }
  };

  const clearAll = async () => {
    if (!user || pins.length === 0) return;
    if (!window.confirm('Барлық белгілерді өшіруге сенімдісіз бе?')) return;
    
    try {
      const batch = writeBatch(db);
      pins.forEach(p => {
        batch.delete(doc(db, 'pins', p.id));
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'pins');
    }
  };

  const flyToPin = (pin: Pin) => {
    setMapCenter([pin.lat, pin.lng]);
    setMapZoom(12);
  };

  const doSearch = async (q: string) => {
    if (!q.trim()) return;
    setIsSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=6&accept-language=kk,ru,en`);
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const selectSearchResult = (item: any) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    const name = item.display_name.split(',')[0];
    
    setMapCenter([lat, lon]);
    setMapZoom(10);
    setSearchResults([]);
    setSearchQuery(name);

    setTimeout(() => {
      setPendingPin({ lat, lng: lon });
      setEditingId(null);
      setPinName(name);
      setPinDesc('');
      setSelectedEmoji('📍');
      setIsModalOpen(true);
    }, 1300);
  };

  const exportPins = () => {
    if (pins.length === 0) return;

    let text = `📍 БЕЛГІЛЕНГЕН ЖЕРЛЕР ТІЗІМІ\n`;
    text += `Барлығы: ${pins.length} жер\n`;
    text += `─────────────────────────────\n\n`;

    pins.forEach((pin, i) => {
      text += `${i + 1}. ${pin.emoji} ${pin.name}\n`;
      if (pin.desc) text += `   ${pin.desc}\n`;
      text += `   Координаттар: ${pin.lat.toFixed(4)}°Е, ${pin.lng.toFixed(4)}°Б\n\n`;
    });

    text += `─────────────────────────────\n`;
    text += `Bilge платформасынан экспортталды`;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'карта-белгілер.txt';
    a.click();
    URL.revokeObjectURL(url);

    navigator.clipboard.writeText(text).then(() => {
      if (addNotification) {
        addNotification('Көшірілді! 📋', 'Белгілер тізімі алмасу буферіне көшірілді және файл жүктелді.', 'success');
      } else {
        console.log('📋 Көшірілді! Файл та жүктелді.');
      }
    });
  };

  return (
    <div className="flex flex-col h-[500px] sm:h-[600px] md:h-[calc(100vh-180px)] bg-[#0f1923] text-[#e2eaf4] overflow-hidden rounded-2xl border border-white/10 relative isolate">
      {/* Top Bar */}
      <div className="flex items-center gap-2 sm:gap-4 p-3 sm:p-4 bg-[#172030] border-b border-white/10 z-20 relative">
        <div className="text-sm sm:text-lg font-bold text-[#63b3ed] tracking-wider whitespace-nowrap">
          BILGE <small className="text-[#7a9bb5] font-normal text-xs hidden xs:inline">/ Карта</small>
        </div>

        <div className="flex-1 relative max-w-md">
          <div className="relative">
            <input
              className="w-full bg-[#1e2d40] border-1.5 border-white/10 rounded-lg text-sm py-2 px-4 pr-10 outline-none focus:border-[#63b3ed] transition-colors"
              type="text"
              placeholder="🔍 Іздеу — Алматы, Нил өзені..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.length > 2) doSearch(e.target.value);
                else setSearchResults([]);
              }}
            />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-[#63b3ed]">
              <Search size={16} />
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#1e2d40] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-[40]">
              {searchResults.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 cursor-pointer hover:bg-[#63b3ed]/10 border-b border-white/5 last:border-none flex items-center gap-3 transition-colors"
                  onClick={() => selectSearchResult(item)}
                >
                  <MapPin size={16} className="text-[#63b3ed] shrink-0" />
                  <div>
                    <div className="text-sm font-semibold">{item.display_name.split(',')[0]}</div>
                    <div className="text-xs text-[#7a9bb5]">{item.display_name.split(',').slice(-1)[0].trim()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 ml-auto">
          <button onClick={() => { setMapCenter([20, 0]); setMapZoom(2); }} className="p-2 bg-[#1e2d40] border border-white/10 rounded-lg hover:border-[#63b3ed] hover:text-[#63b3ed] transition-all">
            <Globe size={18} />
          </button>
          <button onClick={() => { setMapCenter([48, 66]); setMapZoom(5); }} className="p-2 bg-[#1e2d40] border border-white/10 rounded-lg hover:border-[#63b3ed] hover:text-[#63b3ed] transition-all font-bold text-xs">
            🇰🇿
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 relative">
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: '100%', width: '100%', background: '#0f1923', zIndex: 0 }}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <MapEvents onMapClick={handleMapClick} />
            <FlyToLocation center={mapCenter} zoom={mapZoom} />
            
            {pins.map(pin => (
              <Marker
                key={pin.id}
                position={[pin.lat, pin.lng]}
                icon={L.divIcon({
                  className: '',
                  html: `<div style="font-size:26px; line-height:1; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8)); cursor:pointer;">${pin.emoji}</div>`,
                  iconAnchor: [13, 26],
                  iconSize: [26, 26],
                })}
              >
                <Popup className="custom-popup">
                  <div className="p-1">
                    <div className="font-bold text-sm mb-1">{pin.emoji} {pin.name}</div>
                    {pin.desc && <div className="text-xs text-slate-500 mb-2">{pin.desc}</div>}
                    <div className="flex gap-2">
                      <button 
                        onClick={() => deletePin(pin.id)}
                        className="px-2 py-1 bg-red-500 text-white text-[10px] rounded font-bold"
                      >
                        Өшіру
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {showHint && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#0f1923]/90 border border-white/10 rounded-full px-4 py-2 text-xs text-[#7a9bb5] pointer-events-none z-[20] whitespace-nowrap">
              Картаға шертсеңіз белгі қосылады
            </div>
          )}

          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`
              absolute bottom-6 right-6 w-12 h-12 bg-[#63b3ed] text-[#0f1923] rounded-full flex items-center justify-center shadow-2xl z-30 md:hidden transition-transform
              ${isSidebarOpen ? 'translate-x-[-320px]' : 'translate-x-0'}
            `}
          >
            <MapPin size={20} />
          </button>
        </div>

      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-[100] md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        w-[300px] bg-[#172030] border-l border-white/10 flex flex-col transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
        absolute right-0 top-0 bottom-0 md:relative z-[110]
      `}>
          <div className="p-4 border-b border-white/10 flex justify-between items-center">
            <span className="text-xs font-bold text-[#63b3ed] uppercase tracking-wider">📍 Белгіленген жерлер</span>
            <div className="flex items-center gap-2">
              <span className="bg-[#63b3ed] text-[#0f1923] text-[10px] font-black px-2 py-0.5 rounded-full min-w-[20px] text-center">
                {pins.length}
              </span>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 hover:bg-white/10 rounded-md md:hidden text-[#7a9bb5] hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            {pins.length === 0 ? (
              <div className="text-center py-12 text-[#7a9bb5]">
                <div className="text-4xl mb-4 opacity-30">🗺️</div>
                <div className="text-xs">Картаға шертіп немесе іздеп белгі қосыңыз</div>
              </div>
            ) : (
              pins.map(pin => (
                <div 
                  key={pin.id} 
                  className="bg-[#1e2d40] border border-white/10 rounded-xl p-3 hover:border-[#63b3ed] transition-all cursor-pointer group"
                  onClick={() => flyToPin(pin)}
                >
                  <div className="flex gap-3">
                    <div className="text-2xl shrink-0">{pin.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate">{pin.name}</div>
                      {pin.desc && <div className="text-[10px] text-[#7a9bb5] line-clamp-2 mt-1">{pin.desc}</div>}
                      <div className="text-[9px] text-[#7a9bb5] mt-2 opacity-50">{pin.lat.toFixed(4)}°, {pin.lng.toFixed(4)}°</div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setEditingId(pin.id); setPinName(pin.name); setPinDesc(pin.desc); setSelectedEmoji(pin.emoji); setIsModalOpen(true); }}
                      className="flex-1 py-1 text-[10px] border border-white/10 rounded hover:border-[#63b3ed] hover:text-[#63b3ed] transition-colors"
                    >
                      Өзгерту
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); deletePin(pin.id); }}
                      className="flex-1 py-1 text-[10px] border border-white/10 rounded hover:border-red-500 hover:text-red-500 transition-colors"
                    >
                      Өшіру
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-top border-white/10 space-y-2">
            <button 
              onClick={exportPins}
              disabled={pins.length === 0}
              className="w-full py-3 bg-gradient-to-r from-[#63b3ed] to-[#4fd1c5] text-[#0f1923] rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-30"
            >
              <Share2 size={16} />
              📋 БЖБ/ТЖБ-ға көшіру
            </button>
            <button 
              onClick={clearAll}
              className="w-full py-2 text-xs text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              🗑️ Барлығын өшіру
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[150]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div className="bg-[#172030] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#63b3ed] mb-6">📍 Белгі қосу</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-[#7a9bb5] uppercase font-bold tracking-wider mb-2 block">Атауы</label>
                <input 
                  type="text" 
                  className="w-full bg-[#1e2d40] border border-white/10 rounded-lg p-3 text-sm outline-none focus:border-[#63b3ed]"
                  placeholder="мыс. Каспий теңізі"
                  value={pinName}
                  onChange={(e) => setPinName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] text-[#7a9bb5] uppercase font-bold tracking-wider mb-2 block">Сипаттама</label>
                <textarea 
                  className="w-full bg-[#1e2d40] border border-white/10 rounded-lg p-3 text-sm outline-none focus:border-[#63b3ed] resize-none"
                  rows={2}
                  placeholder="мыс. Тұзды су теңізі..."
                  value={pinDesc}
                  onChange={(e) => setPinDesc(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] text-[#7a9bb5] uppercase font-bold tracking-wider mb-2 block">Белгі түрі</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJIS.map(e => (
                    <button
                      key={e}
                      onClick={() => setSelectedEmoji(e)}
                      className={`w-10 h-10 flex items-center justify-center text-xl rounded-lg border transition-all ${selectedEmoji === e ? 'border-[#63b3ed] bg-[#63b3ed]/20' : 'border-white/10 hover:border-[#63b3ed]/50'}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-3 bg-[#1e2d40] border border-white/10 rounded-xl font-bold text-sm text-[#7a9bb5] hover:text-white transition-colors"
              >
                Бас тарту
              </button>
              <button 
                onClick={savePin}
                className="flex-1 py-3 bg-[#63b3ed] text-[#0f1923] rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
              >
                Сақтау
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99,179,237,0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99,179,237,0.4); }
        
        .leaflet-container { font-family: inherit; border-radius: inherit; }
        .leaflet-popup-content-wrapper { 
          background: #172030 !important; 
          color: #e2eaf4 !important; 
          border: 1px solid #63b3ed !important;
          border-radius: 12px !important;
        }
        .leaflet-popup-tip { background: #63b3ed !important; }
        .leaflet-popup-content { margin: 12px !important; }
      `}</style>
    </div>
  );
};

export default MapView;

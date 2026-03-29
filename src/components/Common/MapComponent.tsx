
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polygon, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface MapComponentProps {
  query: string;
  height?: string;
  interactive?: boolean;
  mode?: 'view' | 'mark' | 'draw' | 'route';
  onMark?: (latlng: L.LatLng) => void;
  onDraw?: (points: L.LatLng[]) => void;
  onRouteDraw?: (points: L.LatLng[]) => void;
  initialMarkers?: L.LatLng[];
  initialPolygons?: { points: L.LatLng[]; color?: string; name?: string }[];
  initialRoutes?: { points: L.LatLng[]; color?: string; name?: string }[];
  center?: [number, number];
  zoom?: number;
}

const SearchAndFly = ({ query, interactive = true, center, zoom }: { query: string, interactive?: boolean, center?: [number, number], zoom?: number }) => {
  const map = useMap();

  useEffect(() => {
    if (!interactive) {
      map.dragging.disable();
      map.touchZoom.disable();
      map.doubleClickZoom.disable();
      map.scrollWheelZoom.disable();
      map.boxZoom.disable();
      map.keyboard.disable();
      if ((map as any).tap) (map as any).tap.disable();
    }
  }, [map, interactive]);

  useEffect(() => {
    if (center) {
      map.setView(center, zoom || 5);
      return;
    }
    if (!query) return;

    const fetchCoords = async () => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
        const data = await response.json();
        if (data && data.length > 0) {
          const { lat, lon } = data[0];
          map.flyTo([parseFloat(lat), parseFloat(lon)], zoom || 13, { animate: interactive });
        }
      } catch (error) {
        console.error("Geocoding error:", error);
      }
    };

    fetchCoords();
  }, [query, map, interactive, center, zoom]);

  return null;
};

const MapEvents = ({ mode, onMark, onDraw, onRouteDraw }: { mode: string, onMark?: any, onDraw?: any, onRouteDraw?: any }) => {
  const map = useMap();
  const [points, setPoints] = React.useState<L.LatLng[]>([]);

  useEffect(() => {
    if (mode === 'view') {
      setPoints([]);
      return;
    }

    const handleClick = (e: L.LeafletMouseEvent) => {
      if (mode === 'mark') {
        onMark?.(e.latlng);
      } else if (mode === 'draw' || mode === 'route') {
        const newPoints = [...points, e.latlng];
        setPoints(newPoints);
        if (mode === 'draw') onDraw?.(newPoints);
        if (mode === 'route') onRouteDraw?.(newPoints);
      }
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [map, mode, onMark, onDraw, onRouteDraw, points]);

  return (
    <>
      {mode === 'draw' && points.length > 1 && (
        <Polygon positions={points} color="purple" />
      )}
      {mode === 'route' && points.length > 1 && (
        <Polyline positions={points} color="red" />
      )}
    </>
  );
};

export const MapComponent: React.FC<MapComponentProps> = ({ 
  query, 
  height = "100%", 
  interactive = true,
  mode = 'view',
  onMark,
  onDraw,
  onRouteDraw,
  initialMarkers = [],
  initialPolygons = [],
  initialRoutes = [],
  center,
  zoom
}) => {
  return (
    <div style={{ height, width: '100%', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
      <MapContainer
        center={center || [48, 66]}
        zoom={zoom || 5}
        style={{ height: '100%', width: '100%' }}
        zoomControl={interactive}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <SearchAndFly query={query} interactive={interactive} center={center} zoom={zoom} />
        <MapEvents mode={mode} onMark={onMark} onDraw={onDraw} onRouteDraw={onRouteDraw} />
        
        {initialMarkers.map((m, i) => (
          <Marker key={i} position={m} />
        ))}
        
        {initialPolygons.map((p, i) => (
          <Polygon key={i} positions={p.points} color={p.color || "green"} fillOpacity={0.3}>
            {p.name && <Popup>{p.name}</Popup>}
          </Polygon>
        ))}

        {initialRoutes.map((r, i) => (
          <Polyline key={i} positions={r.points} color={r.color || "blue"} weight={4}>
            {r.name && <Popup>{r.name}</Popup>}
          </Polyline>
        ))}
      </MapContainer>
      
      {!interactive && (
        <div className="absolute inset-0 z-[1000] cursor-default" />
      )}
    </div>
  );
};

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap } from 'react-leaflet'
import { useEffect } from 'react'

export type Pin = { id: string; lat: number; lng: number; label: string; color?: string; radius?: number; onClick?: () => void; pulse?: boolean }

function Fit({ pins, line }: { pins: Pin[]; line?: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    const pts = [...pins.map((p) => [p.lat, p.lng] as [number, number]), ...(line ?? [])]
    if (pts.length === 1) map.setView(pts[0], 14)
    else if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [28, 28] })
  }, [map, JSON.stringify(pins.map((p) => p.id)), line?.length]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

/** Light OpenStreetMap basemap (CARTO Voyager) with coloured circle pins and an optional route line. */
export default function MapView({ pins, line, height = 240, dark = false }: { pins: Pin[]; line?: [number, number][]; height?: number; dark?: boolean }) {
  // Standard OpenStreetMap tiles (free, attribution required); the dark control-room look is a CSS filter
  const tiles = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
  return (
    <div style={{ height }} className={`overflow-hidden rounded-2xl ${dark ? 'map-dark' : 'map-soft'}`}>
      <MapContainer center={[15.95, 75.8]} zoom={10} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false} attributionControl>
        <TileLayer url={tiles} attribution='&copy; OpenStreetMap contributors' />
        {line && line.length > 1 && <Polyline positions={line} pathOptions={{ color: '#1f5e57', weight: 4, opacity: 0.8, dashArray: '2 8', lineCap: 'round' }} />}
        {pins.map((p) => (
          <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={p.radius ?? 9}
            pathOptions={{ color: '#fff', weight: 2.5, fillColor: p.color ?? '#1f5e57', fillOpacity: 1 }} eventHandlers={p.onClick ? { click: p.onClick } : undefined}>
            <Tooltip direction="top" offset={[0, -8]}>{p.label}</Tooltip>
          </CircleMarker>
        ))}
        <Fit pins={pins} line={line} />
      </MapContainer>
    </div>
  )
}

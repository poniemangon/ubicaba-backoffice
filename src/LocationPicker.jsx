import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, useMap, useMapEvents } from 'react-leaflet'

const BA_CENTER = [-34.6037, -58.4516]

function ClickCapture({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function RecenterOnChange({ lat, lng }) {
  const map = useMap()
  useEffect(() => {
    if (typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      map.setView([lat, lng], map.getZoom() < 13 ? 15 : map.getZoom())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng])
  return null
}

export default function LocationPicker({ lat, lng, onPick }) {
  const hasValidPoint = typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng)

  return (
    <div className="location-picker">
      <MapContainer center={BA_CENTER} zoom={12} className="picker-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickCapture onPick={onPick} />
        <RecenterOnChange lat={lat} lng={lng} />
        {hasValidPoint && (
          <CircleMarker
            center={[lat, lng]}
            radius={9}
            pathOptions={{ color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 0.9, weight: 2 }}
          />
        )}
      </MapContainer>
    </div>
  )
}

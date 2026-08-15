import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const markerIcon = L.divIcon({
  className: "location-picker-marker",
  html: '<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;background:hsl(var(--primary));transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.25)"><span style="display:block;width:8px;height:8px;border-radius:50%;background:white;margin:8px"></span></div>',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

function Recenter({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 16, { duration: 0.8 });
  }, [position, map]);
  return null;
}

interface LocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (latitude: number, longitude: number) => void;
}

export function LocationPicker({ latitude, longitude, onChange }: LocationPickerProps) {
  const [loading, setLoading] = useState(false);
  const position: [number, number] | null = latitude != null && longitude != null ? [latitude, longitude] : null;
  const defaultCenter: [number, number] = [34.8, 9.5];

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Géolocalisation indisponible", description: "Votre navigateur ne permet pas d'utiliser la localisation.", variant: "destructive" });
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        onChange(coords.latitude, coords.longitude);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        const message = error.code === error.PERMISSION_DENIED
          ? "Autorisez la localisation dans votre navigateur pour continuer."
          : "Impossible de récupérer votre position. Vérifiez que la localisation est activée.";
        toast({ title: "Localisation non disponible", description: message, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  return (
    <div className="md:col-span-2 rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <MapPin className="h-4 w-4 text-primary" /> Localisation <span className="text-xs font-normal text-muted-foreground">(optionnel)</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Utilisez votre position pour placer précisément votre activité sur la carte.</p>
        </div>
        <Button type="button" variant="outline" onClick={useMyLocation} disabled={loading} className="shrink-0">
          <LocateFixed className="mr-2 h-4 w-4" />
          {loading ? "Localisation…" : "Utiliser ma localisation"}
        </Button>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border">
        <MapContainer
          center={position ?? defaultCenter}
          zoom={position ? 16 : 6}
          scrollWheelZoom
          className="h-64 w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Recenter position={position} />
          {position && <Marker position={position} icon={markerIcon} />}
        </MapContainer>
      </div>
      {position && (
        <p className="mt-2 text-xs text-muted-foreground">
          Position enregistrée : {latitude!.toFixed(6)}, {longitude!.toFixed(6)}. Vous pouvez réutiliser le bouton pour actualiser la position.
        </p>
      )}
    </div>
  );
}

import { MapPin } from "lucide-react";
import { getMapUrl } from "@/lib/geolocation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface LocationBadgeProps {
  label: string;
  lat: number;
  lng: number;
}

const LocationBadge = ({ label, lat, lng }: LocationBadgeProps) => {
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.005},${lat - 0.003},${lng + 0.005},${lat + 0.003}&layer=mapnik&marker=${lat},${lng}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1 text-xs text-accent hover:underline font-body cursor-pointer">
          <MapPin className="h-3 w-3" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-2" side="top">
        <p className="text-xs font-body font-semibold mb-1">{label}</p>
        <iframe
          src={osmEmbedUrl}
          className="w-full h-[140px] rounded border-0"
          loading="lazy"
          title={`${label} location`}
        />
        <a
          href={getMapUrl(lat, lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-accent hover:underline font-body mt-1 block"
        >
          Open in Google Maps →
        </a>
      </PopoverContent>
    </Popover>
  );
};

export default LocationBadge;

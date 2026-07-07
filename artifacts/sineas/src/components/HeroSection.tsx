import { Link } from "wouter";
import { Play, Info, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import type { VideoCardData } from "./VideoCard";

interface HeroSectionProps {
  video: VideoCardData & { description?: string | null };
}

export default function HeroSection({ video }: HeroSectionProps) {
  const [muted, setMuted] = useState(true);

  return (
    <div className="relative w-full h-[70vh] min-h-[500px] overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-900" />
        )}
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1e] via-transparent to-black/20" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-end h-full max-w-screen-2xl mx-auto px-6 sm:px-10 pb-16">
        <div className="max-w-lg">
          {video.genre && (
            <Badge className="mb-3 bg-blue-600 text-white border-0 text-xs uppercase tracking-wider">
              {video.genre}
            </Badge>
          )}
          <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight mb-3">
            {video.title}
          </h1>
          {video.description && (
            <p className="text-gray-300 text-sm sm:text-base line-clamp-3 mb-6">
              {video.description}
            </p>
          )}
          <div className="flex items-center gap-3">
            <Link href={`/watch/${video.id}`}>
              <Button className="bg-white hover:bg-gray-100 text-black font-bold px-6 gap-2">
                <Play className="w-4 h-4 fill-black" />
                Putar
              </Button>
            </Link>
            <Link href={`/watch/${video.id}`}>
              <Button variant="outline" className="border-white/30 bg-white/10 hover:bg-white/20 text-white gap-2">
                <Info className="w-4 h-4" />
                Info
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Sound toggle */}
      <button
        onClick={() => setMuted(!muted)}
        className="absolute bottom-16 right-8 z-10 w-9 h-9 rounded-full border border-white/40 bg-black/30 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition"
      >
        {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>
    </div>
  );
}

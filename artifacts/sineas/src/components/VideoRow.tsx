import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import VideoCard, { type VideoCardData } from "./VideoCard";

interface VideoRowProps {
  title: string;
  videos: VideoCardData[];
  loading?: boolean;
}

export default function VideoRow({ title, videos, loading }: VideoRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({ left: dir === "right" ? amount : -amount, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="mb-10">
        <div className="h-6 w-40 bg-muted rounded mb-4 animate-pulse" />
        <div className="flex gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-48 sm:w-56">
              <div className="aspect-video bg-muted rounded-lg animate-pulse" />
              <div className="mt-2 h-4 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!videos.length) return null;

  return (
    <div className="mb-10 group/row">
      <h2 className="text-lg sm:text-xl font-bold text-foreground mb-3 px-6 sm:px-10">{title}</h2>
      <div className="relative px-6 sm:px-10">
        {/* Left arrow */}
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-full flex items-center justify-center bg-gradient-to-r from-black/80 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity"
        >
          <ChevronLeft className="w-7 h-7 text-white" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {videos.map((v) => (
            <div key={v.id} className="flex-shrink-0 w-48 sm:w-56 md:w-60">
              <VideoCard video={v} />
            </div>
          ))}
        </div>

        {/* Right arrow */}
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-full flex items-center justify-center bg-gradient-to-l from-black/80 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity"
        >
          <ChevronRight className="w-7 h-7 text-white" />
        </button>
      </div>
    </div>
  );
}

import { Link } from "wouter";
import { Play, Eye, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface VideoCardData {
  id: number;
  title: string;
  thumbnailUrl?: string | null;
  duration?: number;
  viewCount?: number;
  likeCount?: number;
  uploaderName?: string;
  uploaderId?: string;
  genre?: string | null;
  isPremium?: boolean;
  minimumPlan?: string | null;
  progressPercent?: number;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatViews(n?: number): string {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}rb`;
  return String(n);
}

const planColors: Record<string, string> = {
  premium: "bg-amber-500/90 text-black",
  ultra: "bg-purple-500/90 text-white",
  basic: "bg-blue-500/90 text-white",
};

interface VideoCardProps {
  video: VideoCardData;
  variant?: "default" | "wide" | "compact";
}

export default function VideoCard({ video, variant = "default" }: VideoCardProps) {
  return (
    <div className="group block">
      <Link href={`/watch/${video.id}`} className="block">
        <div className="relative overflow-hidden rounded-lg bg-gray-900 aspect-video">
          {video.thumbnailUrl ? (
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-800">
              <Play className="w-10 h-10 text-gray-600" />
            </div>
          )}

          {/* Overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                <Play className="w-6 h-6 text-white fill-white" />
              </div>
            </div>
          </div>

          {/* Duration badge */}
          {video.duration && (
            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
              {formatDuration(video.duration)}
            </div>
          )}

          {/* Premium badge */}
          {video.minimumPlan && video.minimumPlan !== "basic" && (
            <div className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded flex items-center gap-1 font-semibold ${planColors[video.minimumPlan] ?? "bg-red-500/90 text-white"}`}>
              <Crown className="w-3 h-3" />
              {video.minimumPlan.toUpperCase()}
            </div>
          )}

          {/* Progress bar */}
          {video.progressPercent !== undefined && video.progressPercent > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
              <div
                className="h-full bg-red-500"
                style={{ width: `${Math.min(100, video.progressPercent)}%` }}
              />
            </div>
          )}
        </div>
      </Link>

      <div className="mt-2 px-0.5">
        <Link href={`/watch/${video.id}`}>
          <h3 className="text-sm font-semibold text-white line-clamp-2 group-hover:text-red-400 transition-colors">
            {video.title}
          </h3>
        </Link>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
          {video.uploaderName && (
            video.uploaderId ? (
              <Link
                href={`/creator/${encodeURIComponent(video.uploaderId)}`}
                className="truncate hover:text-white transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {video.uploaderName}
              </Link>
            ) : (
              <span className="truncate">{video.uploaderName}</span>
            )
          )}
          {video.viewCount !== undefined && (
            <span className="flex items-center gap-1 flex-shrink-0">
              <Eye className="w-3 h-3" />
              {formatViews(video.viewCount)}
            </span>
          )}
        </div>
        {video.genre && (
          <Badge variant="outline" className="mt-1 text-xs text-gray-500 border-gray-700 px-1.5 py-0">
            {video.genre}
          </Badge>
        )}
      </div>
    </div>
  );
}

import { useListVideos } from "@workspace/api-client-react";
import Navbar from "@/components/Navbar";
import VideoCard from "@/components/VideoCard";
import { useParams } from "wouter";
import { Film, Eye, ThumbsUp, Play, User } from "lucide-react";
import { useMemo } from "react";

function formatNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}rb`;
  return String(n);
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const PALETTE = [
  "from-blue-600 to-rose-800",
  "from-blue-600 to-blue-900",
  "from-purple-600 to-purple-900",
  "from-green-600 to-green-900",
  "from-amber-600 to-orange-800",
  "from-teal-600 to-cyan-900",
  "from-pink-600 to-pink-900",
  "from-indigo-600 to-indigo-900",
];

function avatarGradient(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export default function CreatorPage() {
  const params = useParams<{ id: string }>();
  const creatorId = decodeURIComponent(params.id ?? "");

  const { data, isLoading } = useListVideos({ limit: 100 });
  const allVideos = data?.videos ?? [];

  const creatorVideos = useMemo(
    () => allVideos.filter((v: any) => v.uploaderId === creatorId),
    [allVideos, creatorId]
  );

  const creatorName: string = (creatorVideos[0] as any)?.uploaderName ?? "Kreator";
  const totalViews = creatorVideos.reduce((s: number, v: any) => s + (v.viewCount ?? 0), 0);
  const totalLikes = creatorVideos.reduce((s: number, v: any) => s + (v.likeCount ?? 0), 0);
  const gradient = avatarGradient(creatorId);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      {/* Banner */}
      <div className={`w-full h-48 sm:h-56 bg-gradient-to-br ${gradient} opacity-60`} />

      <div className="max-w-screen-xl mx-auto px-6 sm:px-10 pb-16">
        {/* Profile header */}
        <div className="-mt-14 sm:-mt-16 mb-10 flex flex-col sm:flex-row items-start sm:items-end gap-4">
          <div
            className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-3xl font-black border-4 border-background flex-shrink-0 shadow-xl`}
          >
            {isLoading ? (
              <User className="w-10 h-10 opacity-50" />
            ) : (
              getInitials(creatorName)
            )}
          </div>

          <div className="flex-1 pb-1">
            {isLoading ? (
              <div className="h-8 w-48 bg-muted rounded animate-pulse mb-2" />
            ) : (
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">{creatorName}</h1>
            )}
            <p className="text-muted-foreground text-sm mt-1">Kreator Sineas</p>
          </div>
        </div>

        {/* Stats */}
        {!isLoading && creatorVideos.length > 0 && (
          <div className="flex gap-6 sm:gap-10 mb-10 border-b border-border pb-8">
            <div className="text-center">
              <div className="flex items-center gap-2 text-2xl font-black text-foreground">
                <Film className="w-5 h-5 text-yellow-400" />
                {creatorVideos.length}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Video</p>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-2 text-2xl font-black text-foreground">
                <Eye className="w-5 h-5 text-blue-400" />
                {formatNum(totalViews)}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Tayangan</p>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-2 text-2xl font-black text-foreground">
                <ThumbsUp className="w-5 h-5 text-pink-400" />
                {formatNum(totalLikes)}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Suka</p>
            </div>
          </div>
        )}

        {/* Video grid */}
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-5">
          Video oleh {isLoading ? "..." : creatorName}
        </h2>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i}>
                <div className="aspect-video bg-muted rounded-xl animate-pulse" />
                <div className="mt-2 h-4 bg-muted rounded animate-pulse w-3/4" />
              </div>
            ))}
          </div>
        ) : creatorVideos.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <Film className="w-14 h-14 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-semibold text-muted-foreground">Kreator tidak ditemukan</p>
            <p className="text-sm mt-1 text-muted-foreground">
              ID kreator ini tidak dikenali atau belum upload video
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {creatorVideos.map((v: any) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

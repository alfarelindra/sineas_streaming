import { useListVideos, useGetTrendingVideos, useGetFeaturedVideos, useGetContinueWatching } from "@workspace/api-client-react";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import VideoRow from "@/components/VideoRow";
import Logo from "@/components/Logo";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { Play, Clock } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const [, setLocation] = useLocation();
  const { isSignedIn } = useAuth();

  const { data: featured, isLoading: loadingFeatured } = useGetFeaturedVideos();
  const { data: trending, isLoading: loadingTrending } = useGetTrendingVideos({ limit: 12 });
  const { data: latestData, isLoading: loadingLatest } = useListVideos({ limit: 12 });
  const { data: dramaData, isLoading: loadingDrama } = useListVideos({ genre: "Drama", limit: 12 });
  const { data: aksiData, isLoading: loadingAksi } = useListVideos({ genre: "Aksi", limit: 12 });
  const { data: hororData } = useListVideos({ genre: "Horor", limit: 12 });
  const { data: animasiData } = useListVideos({ genre: "Animasi", limit: 12 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: continueWatching } = useGetContinueWatching({ query: { enabled: !!isSignedIn } as any });

  const heroVideo = featured?.[0] ?? trending?.[0];

  const handleSearch = (q: string) => {
    if (q.trim()) setLocation(`/browse?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar onSearch={handleSearch} />

      {/* Hero */}
      {heroVideo && <HeroSection video={heroVideo as any} />}
      {!heroVideo && loadingFeatured && (
        <div className="w-full h-[70vh] bg-gray-900 animate-pulse" />
      )}

      {/* Content rows */}
      <div className="pb-16 pt-4">
        {/* Continue Watching */}
        {isSignedIn && (continueWatching ?? []).length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg sm:text-xl font-bold text-foreground mb-3 px-6 sm:px-10 flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-400" />
              Lanjutkan Menonton
            </h2>
            <div className="flex gap-3 overflow-x-auto px-6 sm:px-10 pb-2 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
              {(continueWatching ?? []).map((v: any) => (
                <Link key={v.id} href={`/watch/${v.id}`} className="group flex-shrink-0 w-48 sm:w-56">
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-900">
                    {v.thumbnailUrl ? (
                      <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-800">
                        <Play className="w-8 h-8 text-gray-600" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 backdrop-blur-sm rounded-full p-3">
                        <Play className="w-5 h-5 text-white fill-white" />
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
                      <div
                        className="h-full bg-yellow-400"
                        style={{ width: `${Math.min(100, v.progressPercent ?? 0)}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-foreground mt-2 line-clamp-1 group-hover:text-yellow-400 transition-colors">{v.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{v.progressPercent ? `${Math.round(v.progressPercent)}% selesai` : "Mulai dari awal"}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        <VideoRow title="Sedang Trending" videos={(trending ?? []) as any[]} loading={loadingTrending} />
        <VideoRow title="Terbaru" videos={(latestData?.videos ?? []) as any[]} loading={loadingLatest} />
        <VideoRow title="Drama Pilihan" videos={(dramaData?.videos ?? []) as any[]} loading={loadingDrama} />
        <VideoRow title="Film Aksi" videos={(aksiData?.videos ?? []) as any[]} loading={loadingAksi} />
        {(hororData?.videos?.length ?? 0) > 0 && (
          <VideoRow title="Horor" videos={(hororData?.videos ?? []) as any[]} />
        )}
        {(animasiData?.videos?.length ?? 0) > 0 && (
          <VideoRow title="Animasi" videos={(animasiData?.videos ?? []) as any[]} />
        )}
      </div>

      <footer className="border-t border-border py-10 px-10 flex flex-col items-center gap-3 text-center">
        <Logo href="/" size="sm" />
        <p className="text-xs text-muted-foreground">© 2025 Sineas. Platform streaming video Indonesia terbaik.</p>
      </footer>
    </div>
  );
}

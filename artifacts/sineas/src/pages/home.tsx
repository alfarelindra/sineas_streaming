import { useListVideos, useGetTrendingVideos, useGetFeaturedVideos } from "@workspace/api-client-react";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import VideoRow from "@/components/VideoRow";
import { useState } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  const { data: featured, isLoading: loadingFeatured } = useGetFeaturedVideos();
  const { data: trending, isLoading: loadingTrending } = useGetTrendingVideos({ limit: 12 });
  const { data: latestData, isLoading: loadingLatest } = useListVideos({ limit: 12 });
  const { data: dramaData, isLoading: loadingDrama } = useListVideos({ genre: "Drama", limit: 12 });
  const { data: aksiData, isLoading: loadingAksi } = useListVideos({ genre: "Aksi", limit: 12 });
  const { data: hororData } = useListVideos({ genre: "Horor", limit: 12 });
  const { data: animasiData } = useListVideos({ genre: "Animasi", limit: 12 });

  const heroVideo = featured?.[0] ?? trending?.[0];

  const handleSearch = (q: string) => {
    if (q.trim()) setLocation(`/browse?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      <Navbar onSearch={handleSearch} />

      {/* Hero */}
      {heroVideo && <HeroSection video={heroVideo as any} />}
      {!heroVideo && loadingFeatured && (
        <div className="w-full h-[70vh] bg-gray-900 animate-pulse" />
      )}

      {/* Content rows */}
      <div className="pb-16 pt-4">
        <VideoRow
          title="Sedang Trending"
          videos={(trending ?? []) as any[]}
          loading={loadingTrending}
        />
        <VideoRow
          title="Terbaru"
          videos={(latestData?.videos ?? []) as any[]}
          loading={loadingLatest}
        />
        <VideoRow
          title="Drama Pilihan"
          videos={(dramaData?.videos ?? []) as any[]}
          loading={loadingDrama}
        />
        <VideoRow
          title="Film Aksi"
          videos={(aksiData?.videos ?? []) as any[]}
          loading={loadingAksi}
        />
        {(hororData?.videos?.length ?? 0) > 0 && (
          <VideoRow title="Horor" videos={(hororData?.videos ?? []) as any[]} />
        )}
        {(animasiData?.videos?.length ?? 0) > 0 && (
          <VideoRow title="Animasi" videos={(animasiData?.videos ?? []) as any[]} />
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-10 text-center text-xs text-gray-600">
        <p>© 2025 Sineas. Platform streaming video Indonesia terbaik.</p>
      </footer>
    </div>
  );
}

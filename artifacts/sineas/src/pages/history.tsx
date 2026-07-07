import { useGetContinueWatching } from "@workspace/api-client-react";
import Navbar from "@/components/Navbar";
import VideoCard from "@/components/VideoCard";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { History, Play } from "lucide-react";

export default function HistoryPage() {
  const { isSignedIn } = useAuth();
  const { data, isLoading } = useGetContinueWatching({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: { enabled: !!isSignedIn } as any,
  });

  const videos = (data ?? []) as any[];

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="pt-36 text-center px-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-6">
            <History className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Masuk untuk melihat riwayat</h2>
          <p className="text-muted-foreground text-sm mb-6">Lanjutkan video yang sedang kamu tonton kapan saja.</p>
          <Link href="/sign-in">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">Masuk Sekarang</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <div className="pt-24 max-w-screen-xl mx-auto px-6 sm:px-10 pb-16">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 rounded-xl bg-yellow-400/15">
            <History className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Riwayat Tontonan</h1>
            {!isLoading && videos.length > 0 && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {videos.length} video sedang kamu tonton
              </p>
            )}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i}>
                <div className="aspect-video bg-muted rounded-lg animate-pulse" />
                <div className="mt-2 h-4 bg-muted rounded animate-pulse w-3/4" />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && videos.length === 0 && (
          <div className="text-center py-28">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-6">
              <History className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold mb-2">Belum ada riwayat tontonan</h2>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
              Mulai tonton video dan kamu bisa melanjutkannya dari sini kapan saja.
            </p>
            <Link href="/browse">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                <Play className="w-4 h-4" /> Jelajahi Video
              </Button>
            </Link>
          </div>
        )}

        {/* Grid */}
        {!isLoading && videos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {videos.map((v: any) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

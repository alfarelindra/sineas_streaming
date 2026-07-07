import { useGetWatchlist, useRemoveFromWatchlist } from "@workspace/api-client-react";
import Navbar from "@/components/Navbar";
import VideoCard from "@/components/VideoCard";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Bookmark, Trash2, Search, Play } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function WatchlistPage() {
  const { isSignedIn } = useAuth();
  const { data: watchlist, isLoading } = useGetWatchlist({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: { enabled: !!isSignedIn } as any,
  });
  const removeFromWatchlist = useRemoveFromWatchlist();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");

  const videos = (watchlist ?? []) as any[];
  const filtered = search.trim()
    ? videos.filter((v) =>
        v.title.toLowerCase().includes(search.toLowerCase()) ||
        v.uploaderName?.toLowerCase().includes(search.toLowerCase())
      )
    : videos;

  const handleRemove = (videoId: number, title: string) => {
    setRemoving((s) => new Set(s).add(videoId));
    removeFromWatchlist.mutate(
      { videoId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/users/watchlist"] });
          toast({ title: `"${title}" dihapus dari daftar tonton` });
        },
        onError: () => {
          toast({ title: "Gagal menghapus", variant: "destructive" });
        },
        onSettled: () => {
          setRemoving((s) => {
            const next = new Set(s);
            next.delete(videoId);
            return next;
          });
        },
      }
    );
  };

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] text-white">
        <Navbar />
        <div className="pt-36 text-center px-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-800 mb-6">
            <Bookmark className="w-10 h-10 text-gray-600" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Masuk untuk melihat daftar tonton</h2>
          <p className="text-gray-500 text-sm mb-6">Simpan video favoritmu dan lanjutkan kapan saja.</p>
          <Link href="/sign-in">
            <Button className="bg-blue-600 hover:bg-blue-700">Masuk Sekarang</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      <Navbar />

      <div className="pt-24 max-w-screen-xl mx-auto px-6 sm:px-10 pb-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-yellow-400/15">
              <Bookmark className="w-6 h-6 text-yellow-400 fill-yellow-400/30" />
            </div>
            <div>
              <h1 className="text-2xl font-black">Daftar Tonton</h1>
              {!isLoading && (
                <p className="text-sm text-gray-500 mt-0.5">
                  {videos.length} video tersimpan
                </p>
              )}
            </div>
          </div>

          {videos.length > 0 && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari di daftar tonton..."
                className="w-full bg-gray-900 border border-gray-700 focus:border-yellow-400 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-gray-600 outline-none transition-colors"
              />
            </div>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i}>
                <div className="aspect-video bg-gray-800 rounded-xl animate-pulse" />
                <div className="mt-2 h-4 bg-gray-800 rounded animate-pulse w-3/4" />
                <div className="mt-1 h-3 bg-gray-800 rounded animate-pulse w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Empty — no items at all */}
        {!isLoading && videos.length === 0 && (
          <div className="text-center py-28">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-800/60 mb-6">
              <Bookmark className="w-10 h-10 text-gray-600" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Daftar tontonmu masih kosong</h2>
            <p className="text-gray-500 text-sm mb-6 max-w-xs mx-auto">
              Temukan video yang kamu suka dan klik tombol <strong className="text-gray-300">Simpan</strong> untuk menambahkannya ke sini.
            </p>
            <Link href="/browse">
              <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
                <Play className="w-4 h-4" /> Jelajahi Video
              </Button>
            </Link>
          </div>
        )}

        {/* Empty — search no match */}
        {!isLoading && videos.length > 0 && filtered.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Tidak ada hasil untuk "{search}"</p>
            <button onClick={() => setSearch("")} className="mt-3 text-sm text-yellow-400 hover:text-yellow-300">
              Hapus pencarian
            </button>
          </div>
        )}

        {/* Grid */}
        {!isLoading && filtered.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map((v: any) => (
              <div key={v.id} className="group/item relative">
                <VideoCard video={v} />
                {/* Remove button — appears on hover */}
                <button
                  onClick={() => handleRemove(v.id, v.title)}
                  disabled={removing.has(v.id)}
                  title="Hapus dari daftar tonton"
                  className="absolute top-2 right-2 opacity-0 group-hover/item:opacity-100 transition-all duration-200 bg-black/70 hover:bg-blue-600 backdrop-blur-sm rounded-full p-1.5 text-white disabled:opacity-50 disabled:cursor-not-allowed z-10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

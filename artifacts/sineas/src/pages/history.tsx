import {
  useGetContinueWatching,
  useRemoveWatchProgress,
  useClearWatchHistory,
} from "@workspace/api-client-react";
import Navbar from "@/components/Navbar";
import VideoCard from "@/components/VideoCard";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { History, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function HistoryPage() {
  const { isSignedIn } = useAuth();
  const { data, isLoading } = useGetContinueWatching({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: { enabled: !!isSignedIn } as any,
  });
  const removeWatchProgress = useRemoveWatchProgress();
  const clearWatchHistory = useClearWatchHistory();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState<Set<number>>(new Set());

  const videos = (data ?? []) as any[];

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/videos/continue-watching"] });

  const handleRemove = (videoId: number, title: string) => {
    setRemoving((s) => new Set(s).add(videoId));
    removeWatchProgress.mutate(
      { id: videoId },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: `"${title}" dihapus dari riwayat` });
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

  const handleClearAll = () => {
    clearWatchHistory.mutate(undefined, {
      onSuccess: () => {
        invalidate();
        toast({ title: "Riwayat tontonan dikosongkan" });
      },
      onError: () => {
        toast({ title: "Gagal mengosongkan riwayat", variant: "destructive" });
      },
    });
  };

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
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

          {!isLoading && videos.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  disabled={clearWatchHistory.isPending}
                  className="gap-2 border-border text-muted-foreground hover:text-foreground hover:border-red-500/50 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4" /> Kosongkan Riwayat
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Kosongkan riwayat tontonan?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Semua video di riwayat akan dihapus. Tindakan ini tidak dapat dibatalkan.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearAll}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Ya, kosongkan
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
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
              <div key={v.id} className="group/item relative">
                <VideoCard video={v} />
                {/* Remove button — appears on hover */}
                <button
                  onClick={() => handleRemove(v.id, v.title)}
                  disabled={removing.has(v.id)}
                  title="Hapus dari riwayat"
                  className="absolute top-2 right-2 opacity-0 group-hover/item:opacity-100 transition-all duration-200 bg-black/70 hover:bg-red-600 backdrop-blur-sm rounded-full p-1.5 text-white disabled:opacity-50 disabled:cursor-not-allowed z-10"
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

import {
  useGetWatchHistory,
  useRemoveWatchProgress,
  useClearWatchHistory,
  useRestoreWatchHistory,
} from "@workspace/api-client-react";
import type { WatchProgressSnapshot } from "@workspace/api-client-react";
import { ToastAction } from "@/components/ui/toast";
import Navbar from "@/components/Navbar";
import VideoCard from "@/components/VideoCard";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { History, Play, Trash2, ChevronLeft, ChevronRight, Clock } from "lucide-react";
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

const PAGE_SIZE = 24;

function formatWatchedAt(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "Baru saja";
  if (diffMin < 60) return `${diffMin} menit lalu`;
  if (diffHour < 24) return `${diffHour} jam lalu`;
  if (diffDay < 7) return `${diffDay} hari lalu`;

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

type FilterValue = "all" | "in-progress" | "completed";

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "in-progress", label: "Sedang ditonton" },
  { value: "completed", label: "Selesai" },
];

export default function HistoryPage() {
  const { isSignedIn } = useAuth();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterValue>("all");
  const completedParam =
    filter === "completed" ? true : filter === "in-progress" ? false : undefined;
  const { data, isLoading } = useGetWatchHistory(
    { page, limit: PAGE_SIZE, ...(completedParam !== undefined ? { completed: completedParam } : {}) },
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query: { enabled: !!isSignedIn } as any,
    }
  );
  const removeWatchProgress = useRemoveWatchProgress();
  const clearWatchHistory = useClearWatchHistory();
  const restoreWatchHistory = useRestoreWatchHistory();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState<Set<number>>(new Set());

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/videos/history"] });

  const handleUndo = (snapshots: WatchProgressSnapshot[]) => {
    restoreWatchHistory.mutate(
      { data: { items: snapshots } },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Riwayat dipulihkan" });
        },
        onError: () => {
          toast({ title: "Gagal memulihkan riwayat", variant: "destructive" });
        },
      }
    );
  };

  const handleRemove = (videoId: number, title: string) => {
    setRemoving((s) => new Set(s).add(videoId));
    removeWatchProgress.mutate(
      { id: videoId },
      {
        onSuccess: (snapshot) => {
          invalidate();
          toast({
            title: `"${title}" dihapus dari riwayat`,
            duration: 6000,
            action: (
              <ToastAction altText="Urungkan penghapusan" onClick={() => handleUndo([snapshot])}>
                Urungkan
              </ToastAction>
            ),
          });
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

  const handleFilterChange = (value: FilterValue) => {
    setFilter(value);
    setPage(1);
  };

  const handleClearAll = () => {
    clearWatchHistory.mutate(undefined, {
      onSuccess: (result) => {
        setPage(1);
        invalidate();
        const snapshots = result?.items ?? [];
        toast({
          title: "Riwayat tontonan dikosongkan",
          duration: 6000,
          action:
            snapshots.length > 0 ? (
              <ToastAction altText="Urungkan pengosongan riwayat" onClick={() => handleUndo(snapshots)}>
                Urungkan
              </ToastAction>
            ) : undefined,
        });
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
          <p className="text-muted-foreground text-sm mb-6">Lihat semua video yang pernah kamu tonton kapan saja.</p>
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
              {!isLoading && total > 0 && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {total} video di riwayat kamu
                </p>
              )}
            </div>
          </div>

          {!isLoading && total > 0 && (
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

        {/* Filter */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => handleFilterChange(f.value)}
              className={
                filter === f.value
                  ? "px-4 py-1.5 rounded-full text-sm font-semibold bg-blue-600 text-white transition-colors"
                  : "px-4 py-1.5 rounded-full text-sm font-medium bg-muted text-muted-foreground hover:text-foreground transition-colors"
              }
            >
              {f.label}
            </button>
          ))}
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
        {!isLoading && items.length === 0 && (
          <div className="text-center py-28">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-6">
              <History className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold mb-2">
              {filter === "completed"
                ? "Belum ada video yang selesai ditonton"
                : filter === "in-progress"
                  ? "Tidak ada video yang sedang ditonton"
                  : "Belum ada riwayat tontonan"}
            </h2>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
              {filter === "completed"
                ? "Video yang sudah kamu tonton sampai selesai akan muncul di sini."
                : filter === "in-progress"
                  ? "Video yang belum selesai kamu tonton akan muncul di sini."
                  : "Mulai tonton video dan semua yang kamu tonton akan muncul di sini."}
            </p>
            {filter === "all" ? (
              <Link href="/browse">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                  <Play className="w-4 h-4" /> Jelajahi Video
                </Button>
              </Link>
            ) : (
              <Button
                onClick={() => handleFilterChange("all")}
                variant="outline"
                className="border-border"
              >
                Lihat semua riwayat
              </Button>
            )}
          </div>
        )}

        {/* Grid */}
        {!isLoading && items.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {items.map((v) => (
                <div key={v.id} className="group/item relative">
                  <VideoCard video={v} />
                  {/* Watched-on hint */}
                  <p className="mt-1 px-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="w-3 h-3 flex-shrink-0" />
                    {v.completed ? "Selesai · " : ""}
                    {formatWatchedAt(v.watchedAt)}
                  </p>
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-10">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="gap-1 border-border"
                >
                  <ChevronLeft className="w-4 h-4" /> Sebelumnya
                </Button>
                <span className="text-sm text-muted-foreground">
                  Halaman {page} dari {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="gap-1 border-border"
                >
                  Berikutnya <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

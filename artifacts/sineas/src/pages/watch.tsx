import { useParams } from "wouter";
import {
  useGetVideo,
  useListComments,
  useGetWatchProgress,
  useUpdateWatchProgress,
  useToggleVideoLike,
  useCreateComment,
  useAddToWatchlist,
} from "@workspace/api-client-react";
import Navbar from "@/components/Navbar";
import VideoCard from "@/components/VideoCard";
import { useListVideos } from "@workspace/api-client-react";
import { addNotification } from "@/components/NotificationBell";
import {
  Play, Pause, Volume2, VolumeX, Maximize2, Heart, Bookmark,
  Share2, ThumbsUp, MessageCircle, Clock, Eye, Crown, Send
} from "lucide-react";
import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

function formatDuration(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" });
}

export default function Watch() {
  const { id } = useParams<{ id: string }>();
  const videoId = parseInt(id ?? "0");
  const { isSignedIn } = useAuth();
  const { toast } = useToast();

  const { data: video, isLoading } = useGetVideo(videoId);
  const { data: comments, refetch: refetchComments } = useListComments(videoId);
  const { data: progress } = useGetWatchProgress(videoId);
  const { data: related } = useListVideos({ genre: video?.genre ?? undefined, limit: 8 });

  const updateProgress = useUpdateWatchProgress();
  const likeVideo = useToggleVideoLike();
  const createComment = useCreateComment();
  const addToWatchlist = useAddToWatchlist();

  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  useEffect(() => {
    if (video) setLikeCount(video.likeCount ?? 0);
  }, [video]);

  useEffect(() => {
    if (progress?.progressSeconds && videoRef.current) {
      videoRef.current.currentTime = progress.progressSeconds;
      setCurrentTime(progress.progressSeconds);
    }
  }, [progress]);

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    const d = videoRef.current.duration || 1;
    setCurrentTime(t);
    if (isSignedIn && Math.floor(t) % 10 === 0 && Math.floor(t) > 0) {
      updateProgress.mutate({
        id: videoId,
        data: {
          progressSeconds: Math.floor(t),
          completed: t / d > 0.95,
        },
      });
    }
  }, [videoId, isSignedIn]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) videoRef.current.pause();
    else videoRef.current.play();
    setPlaying(!playing);
  };

  const handleLike = () => {
    if (!isSignedIn) {
      toast({ title: "Masuk untuk menyukai video", variant: "destructive" });
      return;
    }
    likeVideo.mutate({ id: videoId }, {
      onSuccess: (data: any) => {
        setLiked(data.liked);
        setLikeCount(data.likeCount);
        if (data.liked) {
          addNotification({
            type: "like",
            message: `Kamu menyukai "${video?.title}"`,
            link: `/watch/${videoId}`,
          });
        }
      },
    });
  };

  const handleWatchlist = () => {
    if (!isSignedIn) {
      toast({ title: "Masuk untuk menambah ke daftar tonton", variant: "destructive" });
      return;
    }
    addToWatchlist.mutate({ data: { videoId } }, {
      onSuccess: () => toast({ title: "Ditambahkan ke daftar tonton" }),
    });
  };

  const handleComment = () => {
    if (!commentText.trim()) return;
    if (!isSignedIn) {
      toast({ title: "Masuk untuk berkomentar", variant: "destructive" });
      return;
    }
    createComment.mutate({ id: videoId, data: { body: commentText.trim() } }, {
      onSuccess: () => {
        setCommentText("");
        refetchComments();
        addNotification({
          type: "comment",
          message: `Komentarmu di "${video?.title}" berhasil dikirim`,
          link: `/watch/${videoId}`,
        });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0f1e]">
        <Navbar />
        <div className="pt-16 max-w-screen-2xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="aspect-video bg-gray-800 rounded-xl animate-pulse" />
            <div className="mt-4 h-6 bg-gray-800 rounded animate-pulse w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="text-center text-gray-400">
          <p className="text-xl">Video tidak ditemukan</p>
          <Link href="/"><Button className="mt-4 bg-blue-600">Kembali ke Beranda</Button></Link>
        </div>
      </div>
    );
  }

  const isPremiumLocked = video.minimumPlan && video.minimumPlan !== "basic" && !isSignedIn;

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      <Navbar />
      <div className="pt-16 max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-10 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-4">
            {/* Video player */}
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden group">
              {isPremiumLocked ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 gap-4">
                  <Crown className="w-12 h-12 text-amber-400" />
                  <h3 className="text-xl font-bold text-white">Konten Premium</h3>
                  <p className="text-gray-400 text-sm text-center max-w-xs">
                    Berlangganan untuk menonton konten eksklusif ini
                  </p>
                  <Link href="/subscription">
                    <Button className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
                      Mulai Berlangganan
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    src={video.videoUrl}
                    className="w-full h-full"
                    muted={muted}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    poster={video.thumbnailUrl ?? undefined}
                  />
                  {/* Controls overlay */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                      {/* Progress */}
                      <input
                        type="range"
                        min={0}
                        max={duration || 100}
                        value={currentTime}
                        onChange={(e) => {
                          const t = Number(e.target.value);
                          if (videoRef.current) videoRef.current.currentTime = t;
                          setCurrentTime(t);
                        }}
                        className="w-full h-1 mb-3 accent-yellow-400 cursor-pointer"
                      />
                      <div className="flex items-center gap-3">
                        <button onClick={togglePlay} className="text-white hover:text-yellow-400">
                          {playing ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
                        </button>
                        <button onClick={() => setMuted(!muted)} className="text-white hover:text-yellow-400">
                          {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        </button>
                        <span className="text-xs text-gray-300 ml-auto">
                          {formatDuration(Math.floor(currentTime))} / {formatDuration(Math.floor(duration))}
                        </span>
                        <button
                          onClick={() => videoRef.current?.requestFullscreen()}
                          className="text-white hover:text-yellow-400"
                        >
                          <Maximize2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    {/* Click-to-play center */}
                    <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center">
                      {!playing && (
                        <div className="bg-white/20 backdrop-blur-sm rounded-full p-4">
                          <Play className="w-8 h-8 text-white fill-white" />
                        </div>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Video info */}
            <div>
              {video.genre && (
                <Badge className="mb-2 bg-blue-600 border-0 text-xs">{video.genre}</Badge>
              )}
              <h1 className="text-2xl font-bold text-white">{video.title}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-400 flex-wrap">
                <span className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  {(video.viewCount ?? 0).toLocaleString("id-ID")} tayangan
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatDate(video.createdAt ?? new Date().toISOString())}
                </span>
                {video.uploaderName && (
                  <span className="text-white font-medium">{video.uploaderName}</span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLike}
                  className={`gap-2 border-gray-700 ${liked ? "text-yellow-400 border-yellow-400 bg-yellow-400/10" : "text-gray-300 hover:text-white"}`}
                >
                  <ThumbsUp className={`w-4 h-4 ${liked ? "fill-yellow-400" : ""}`} />
                  {likeCount.toLocaleString("id-ID")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleWatchlist}
                  className="gap-2 border-gray-700 text-gray-300 hover:text-white"
                >
                  <Bookmark className="w-4 h-4" />
                  Simpan
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    toast({ title: "Tautan disalin!" });
                  }}
                  className="gap-2 border-gray-700 text-gray-300 hover:text-white"
                >
                  <Share2 className="w-4 h-4" />
                  Bagikan
                </Button>
              </div>

              {video.description && (
                <div className="mt-4 bg-gray-900/60 rounded-lg p-4">
                  <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{video.description}</p>
                </div>
              )}
            </div>

            {/* Comments */}
            <div className="pt-4">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Komentar ({(comments ?? []).length})
              </h2>

              {isSignedIn ? (
                <div className="flex gap-3 mb-6">
                  <Avatar className="w-9 h-9 flex-shrink-0">
                    <AvatarFallback className="bg-blue-600 text-white text-sm">A</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <Textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Tambahkan komentar..."
                      className="bg-gray-900 border-gray-700 text-white resize-none text-sm"
                      rows={2}
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={handleComment}
                        disabled={!commentText.trim() || createComment.isPending}
                        className="bg-blue-600 hover:bg-blue-700 gap-2"
                      >
                        <Send className="w-3 h-3" />
                        Kirim
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-6 p-3 rounded-lg bg-gray-900/60 text-sm text-gray-400 text-center">
                  <Link href="/sign-in" className="text-yellow-400 hover:text-yellow-300">Masuk</Link> untuk berkomentar
                </div>
              )}

              <div className="space-y-4">
                {(comments ?? []).map((c: any) => (
                  <div key={c.id} className="flex gap-3">
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarFallback className="bg-gray-700 text-white text-xs">
                        {c.authorName?.[0]?.toUpperCase() ?? "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{c.authorName}</span>
                        <span className="text-xs text-gray-500">{formatDate(c.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-300 mt-1">{c.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar - related videos */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Video Serupa</h3>
            {(related?.videos ?? [])
              .filter((v: any) => v.id !== videoId)
              .slice(0, 7)
              .map((v: any) => (
                <Link key={v.id} href={`/watch/${v.id}`} className="flex gap-3 group hover:bg-white/5 rounded-lg p-1 transition-colors">
                  <div className="relative w-32 aspect-video flex-shrink-0 rounded overflow-hidden bg-gray-800">
                    {v.thumbnailUrl ? (
                      <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="w-5 h-5 text-gray-600" />
                      </div>
                    )}
                    {v.duration && (
                      <span className="absolute bottom-1 right-1 text-[10px] bg-black/80 text-white px-1 rounded">
                        {formatDuration(v.duration)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white line-clamp-2 group-hover:text-yellow-400 transition-colors">{v.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{v.uploaderName}</p>
                    <p className="text-xs text-gray-600">{(v.viewCount ?? 0).toLocaleString("id-ID")} tayangan</p>
                  </div>
                </Link>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

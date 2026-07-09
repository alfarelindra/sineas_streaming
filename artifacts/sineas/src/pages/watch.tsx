import { useParams, useLocation } from "wouter";
import {
  useGetVideo,
  useListComments,
  useGetWatchProgress,
  useUpdateWatchProgress,
  useToggleVideoLike,
  useCreateComment,
  useAddToWatchlist,
  useGetMe,
} from "@workspace/api-client-react";
import Navbar from "@/components/Navbar";
import VideoCard from "@/components/VideoCard";
import { socket } from "@/lib/socket";
import { useListVideos } from "@workspace/api-client-react";
import {
  Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, Heart, Bookmark,
  Share2, ThumbsUp, MessageCircle, Clock, Eye, Crown, Send, UserPlus, UserCheck,
  Gauge, Settings
} from "lucide-react";
import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth, useUser } from "@clerk/react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";

/**
 * Check if the video URL is from an external embeddable provider like Google Drive or YouTube.
 */
function isIframeVideo(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes("drive.google.com") || url.includes("youtube.com") || url.includes("youtu.be");
}

/**
 * Convert a sharing URL into an official embed URL (iframe src).
 */
function getEmbedUrl(url: string | null | undefined): string {
  if (!url) return "";

  if (url.includes("drive.google.com")) {
    let fileId = "";
    if (url.includes("/file/d/")) {
      const parts = url.split("/file/d/");
      if (parts[1]) {
        fileId = parts[1].split("/")[0].split("?")[0];
      }
    } else if (url.includes("?id=") || url.includes("&id=")) {
      const match = url.match(/[?&]id=([^&#]+)/);
      if (match && match[1]) {
        fileId = match[1];
      }
    }
    if (fileId) {
      return `https://drive.google.com/file/d/${fileId}/preview`;
    }
  }

  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    let videoId = "";
    if (url.includes("youtube.com/watch")) {
      const match = url.match(/[?&]v=([^&#]+)/);
      if (match && match[1]) {
        videoId = match[1];
      }
    } else if (url.includes("youtu.be/")) {
      const parts = url.split("youtu.be/");
      if (parts[1]) {
        videoId = parts[1].split("?")[0].split("/")[0];
      }
    } else if (url.includes("youtube.com/embed/")) {
      const parts = url.split("youtube.com/embed/");
      if (parts[1]) {
        videoId = parts[1].split("?")[0].split("/")[0];
      }
    }
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    }
  }

  return url;
}

/**
 * Resolve a video/thumbnail URL so the browser can always load it.
 * Paths stored as relative `/api/storage/objects/...` are served by the
 * Express API and proxied through Vite in development — they are valid
 * as-is when loaded from the same origin.  Absolute https:// URLs are
 * returned unchanged.
 */
function resolveMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  // Already absolute — return as-is
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  // Relative path starting with / — works from the same origin
  if (url.startsWith("/")) return url;
  // Unexpected format — pass through and let the browser decide
  return url;
}



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

function formatNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}rb`;
  return String(n);
}

export default function Watch() {
  const { id } = useParams<{ id: string }>();
  const videoId = parseInt(id ?? "0");
  const [, setLocation] = useLocation();
  const { isSignedIn, userId, getToken } = useAuth();
  const { user } = useUser();
  const { data: me } = useGetMe({ query: { enabled: !!isSignedIn } as any });
  const myInitial = (me?.displayName?.trim()?.[0] ?? "S").toUpperCase();
  const { toast } = useToast();

  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [showRepliesMap, setShowRepliesMap] = useState<Record<number, boolean>>({});

  const { data: rawVideo, isLoading } = useGetVideo(videoId);
  const video = rawVideo as any;
  const { data: comments, refetch: refetchComments } = useListComments(videoId);
  const { data: progress } = useGetWatchProgress(videoId);
  const { data: related } = useListVideos({ genre: video?.genre ?? undefined, limit: 8 });

  const updateProgress = useUpdateWatchProgress();
  const likeVideo = useToggleVideoLike();
  const createComment = useCreateComment();
  const addToWatchlist = useAddToWatchlist();

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const previousVolumeRef = useRef(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [localViewCount, setLocalViewCount] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const viewCounted = useRef(false);

  // Sync initial views and likes from video fetch
  useEffect(() => {
    if (video) {
      setLocalViewCount(video.viewCount ?? 0);
      setLiked(video.liked ?? false);
      setLikeCount(video.likeCount ?? 0);
    }
  }, [video]);

  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [currentResolution, setCurrentResolution] = useState("720p");
  const [autoNext, setAutoNext] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);

  const getAvailableResolutions = useCallback(() => {
    const resolutions = [];
    if (video) {
      if (video.url_360p) resolutions.push({ label: '360p (Penghemat Data)', value: '360p', url: video.url_360p });
      if (video.url_480p) resolutions.push({ label: '480p', value: '480p', url: video.url_480p });
      if (video.url_720p) resolutions.push({ label: '720p (HD)', value: '720p', url: video.url_720p });
      if (video.url_1080p) resolutions.push({ label: '1080p (FHD)', value: '1080p', url: video.url_1080p });
      if (video.url_4k) resolutions.push({ label: '4K (Ultra HD)', value: '4k', url: video.url_4k });
    }
    if (resolutions.length === 0 && video?.videoUrl) {
      resolutions.push({ label: 'Default', value: 'default', url: video.videoUrl });
    }
    return resolutions;
  }, [video]);

  // Sync resolution settings when video changes
  useEffect(() => {
    if (video) {
      const available = getAvailableResolutions();
      const keys = available.map(r => r.value);
      if (keys.length > 0) {
        if (!keys.includes(currentResolution)) {
          // Default to highest available or 'default'
          setCurrentResolution(keys[keys.length - 1]);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // Reset countdown and close settings menu when videoId changes
  useEffect(() => {
    setCountdown(null);
    setShowSettingsMenu(false);
  }, [videoId]);

  // Click outside listener for settings menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node)) {
        setShowSettingsMenu(false);
      }
    };
    if (showSettingsMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSettingsMenu]);

  const nextVideo = (related?.videos ?? [])
    .filter((v: any) => v.id !== videoId)[0];

  // Countdown logic for auto-next video
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      if (nextVideo) {
        setLocation(`/watch/${nextVideo.id}`);
      }
      setCountdown(null);
      return;
    }
    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, nextVideo, setLocation]);

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setShowSettingsMenu(false);
  };

  const getResolutionUrl = (resolution: string) => {
    if (!video) return "";
    if (resolution === "360p" && video.url_360p) return resolveMediaUrl(video.url_360p);
    if (resolution === "480p" && video.url_480p) return resolveMediaUrl(video.url_480p);
    if (resolution === "720p" && video.url_720p) return resolveMediaUrl(video.url_720p);
    if (resolution === "1080p" && video.url_1080p) return resolveMediaUrl(video.url_1080p);
    if (resolution === "4k" && video.url_4k) return resolveMediaUrl(video.url_4k);
    return resolveMediaUrl(video.videoUrl);
  };

  const handleResolutionChange = (resolution: string) => {
    if (!videoRef.current) return;
    const curTime = videoRef.current.currentTime;
    const wasPlaying = !videoRef.current.paused;

    setCurrentResolution(resolution);

    const targetUrl = getResolutionUrl(resolution);
    if (targetUrl) {
      videoRef.current.src = targetUrl;
      videoRef.current.load();
      videoRef.current.currentTime = curTime;
      if (wasPlaying) {
        videoRef.current.play().catch((err) => {
          console.error("Gagal melanjutkan pemutaran setelah ganti resolusi:", err);
        });
      }
    }
    setShowSettingsMenu(false);
  };

  const handleVideoEnded = () => {
    if (autoNext && nextVideo) {
      setCountdown(5);
    }
  };

  const [activeWatchers, setActiveWatchers] = useState(1);

  useEffect(() => {
    if (!videoId) return;

    // Join video watch room
    socket.emit("join-video-room", String(videoId));

    // Listen for watch room size updates
    socket.on("video-room-count", (data: { videoId: string; count: number }) => {
      if (data.videoId === String(videoId)) {
        setActiveWatchers(data.count);
      }
    });

    return () => {
      socket.off("video-room-count");
    };
  }, [videoId]);

  const handlePlayTrigger = async () => {
    if (viewCounted.current) return;
    viewCounted.current = true;
    try {
      const token = await getToken();
      const headers: HeadersInit = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/video/${videoId}/view`, { method: "POST", headers });
      if (res.ok) {
        const data = await res.json();
        setLocalViewCount(data.viewCount);
      }
    } catch (err) {
      console.error("Gagal memperbarui tayangan video:", err);
    }
  };

  // ── FOLLOW STATUS FETCH & CUSTOM OPTIMISTIC MUTATIONS ──────────────
  const [localFollowing, setLocalFollowing] = useState(false);
  const [localFollowerCount, setLocalFollowerCount] = useState(0);

  const { data: followStatusData, refetch: refetchFollow } = useQuery<{ isFollowing: boolean; followerCount: number }>({
    queryKey: ["/api/follow", video?.uploaderId, "status"],
    queryFn: async () => {
      if (!video?.uploaderId) return { isFollowing: false, followerCount: 0 };
      const token = await getToken();
      const headers: HeadersInit = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/follow/${encodeURIComponent(video.uploaderId)}/status`, { headers });
      if (!res.ok) throw new Error("Gagal mengambil status follow");
      return res.json();
    },
    enabled: !!video?.uploaderId,
  });

  useEffect(() => {
    if (followStatusData) {
      setLocalFollowing(followStatusData.isFollowing);
      setLocalFollowerCount(followStatusData.followerCount);
    }
  }, [followStatusData]);

  const handleFollow = async () => {
    if (!isSignedIn) {
      toast({ title: "Masuk untuk mengikuti kreator", variant: "destructive" });
      return;
    }
    if (!video?.uploaderId) return;

    const prevFollowing = localFollowing;
    const prevCount = localFollowerCount;

    // Optimistic toggle
    const nextFollowing = !prevFollowing;
    const nextCount = nextFollowing ? prevCount + 1 : Math.max(0, prevCount - 1);
    setLocalFollowing(nextFollowing);
    setLocalFollowerCount(nextCount);

    try {
      const token = await getToken();
      const headers: HeadersInit = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const method = prevFollowing ? "DELETE" : "POST";
      const url = `/api/follow/${encodeURIComponent(video.uploaderId)}`;

      const res = await fetch(url, { method, headers });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Gagal mengubah status follow");
      }
      
      const data = await res.json();
      setLocalFollowing(data.isFollowing);
      setLocalFollowerCount(data.followerCount);
      toast({ title: data.isFollowing ? "Berhasil mengikuti kreator" : "Batal mengikuti kreator" });
      refetchFollow();
    } catch (err: any) {
      setLocalFollowing(prevFollowing);
      setLocalFollowerCount(prevCount);
      toast({ title: err.message || "Gagal mengubah status follow", variant: "destructive" });
    }
  };

  // ── WATCHLIST (SAVED STATUS) STATE & LOGIC ─────────────────────────
  const [saved, setSaved] = useState(false);

  const { data: watchlistData } = useQuery<any[]>({
    queryKey: ["/api/users/watchlist"],
    queryFn: async () => {
      if (!isSignedIn) return [];
      const token = await getToken();
      const headers: HeadersInit = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/users/watchlist", { headers });
      if (!res.ok) throw new Error("Gagal mengambil daftar tonton");
      return res.json();
    },
    enabled: isSignedIn,
  });

  useEffect(() => {
    if (watchlistData) {
      setSaved(watchlistData.some((item: any) => item.id === videoId));
    }
  }, [watchlistData, videoId]);

  const handleWatchlist = () => {
    if (!isSignedIn) {
      toast({ title: "Masuk untuk menambah ke daftar tonton", variant: "destructive" });
      return;
    }

    // Snapshot current state for rollback
    const prevSaved = saved;

    // ── OPTIMISTIC UPDATE: instant UI change ──
    const nextSaved = !prevSaved;
    setSaved(nextSaved);
    toast({ title: nextSaved ? "Ditambahkan ke daftar tonton" : "Dihapus dari daftar tonton" });

    // ── BACKGROUND API CALL (non-blocking) ──
    (async () => {
      try {
        const token = await getToken();
        const headers: HeadersInit = {
          Accept: "application/json",
          "Content-Type": "application/json",
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        if (prevSaved) {
          const res = await fetch(`/api/users/watchlist/${videoId}`, { method: "DELETE", headers });
          if (!res.ok) throw new Error();
        } else {
          const res = await fetch("/api/users/watchlist", {
            method: "POST",
            headers,
            body: JSON.stringify({ videoId }),
          });
          if (!res.ok) throw new Error();
        }
      } catch (err) {
        // ── ROLLBACK on failure ──
        setSaved(prevSaved);
        toast({ title: "Gagal memperbarui daftar tonton", variant: "destructive" });
      }
    })();
  };
  // ───────────────────────────────────────────────────────────────────

  // ── KEYBOARD CONTROLS FOR SEEKING (<- and ->) ──────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.hasAttribute("contenteditable"))) {
        return; // Ignore seeking while typing comments
      }

      if (!videoRef.current) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const newTime = Math.max(0, videoRef.current.currentTime - 5);
        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const newTime = Math.min(duration, videoRef.current.currentTime + 5);
        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [duration]);
  // ───────────────────────────────────────────────────────────────────

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    previousVolumeRef.current = v > 0 ? v : previousVolumeRef.current;
    if (videoRef.current) {
      videoRef.current.volume = v;
      videoRef.current.muted = v === 0;
    }
    setMuted(v === 0);
  };

  const handleToggleMute = () => {
    if (!videoRef.current) return;
    if (muted) {
      // Unmute: restore previous volume (fallback to 0.5 if it was 0)
      const restored = previousVolumeRef.current > 0 ? previousVolumeRef.current : 0.5;
      setMuted(false);
      setVolume(restored);
      videoRef.current.muted = false;
      videoRef.current.volume = restored;
    } else {
      // Mute: save current volume, then mute
      previousVolumeRef.current = volume > 0 ? volume : previousVolumeRef.current;
      setMuted(true);
      videoRef.current.muted = true;
    }
  };

  useEffect(() => {
    if (video) setLikeCount(video.likeCount ?? 0);
  }, [video]);

  useEffect(() => {
    if (progress?.progressSeconds && videoRef.current) {
      videoRef.current.currentTime = progress.progressSeconds;
      setCurrentTime(progress.progressSeconds);
    }
  }, [progress]);

  // ── FULLSCREEN CHANGE LISTENER ─────────────────────────────────────
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);
  // ───────────────────────────────────────────────────────────────────

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
    if (playing) {
      videoRef.current.pause();
      setPlaying(false);
    } else {
      videoRef.current.play();
      setPlaying(true);
      handlePlayTrigger();
    }
  };

  const handleLike = () => {
    if (!isSignedIn) {
      toast({ title: "Masuk untuk menyukai video", variant: "destructive" });
      return;
    }

    // Snapshot current state for rollback
    const prevLiked = liked;
    const prevCount = likeCount;

    // ── OPTIMISTIC UPDATE: instant UI change ──
    const nextLiked = !prevLiked;
    const nextCount = nextLiked ? prevCount + 1 : Math.max(0, prevCount - 1);
    setLiked(nextLiked);
    setLikeCount(nextCount);

    // ── BACKGROUND API CALL ──
    likeVideo.mutate({ id: videoId }, {
      onSuccess: (data: any) => {
        // Only sync server count if it differs from our optimistic prediction
        if (data.likeCount !== nextCount) {
          setLikeCount(data.likeCount);
        }
        // Sync liked status in case of race conditions
        if (data.liked !== nextLiked) {
          setLiked(data.liked);
        }
      },
      onError: () => {
        // ── ROLLBACK on failure ──
        setLiked(prevLiked);
        setLikeCount(prevCount);
        toast({ title: "Gagal menyukai video", variant: "destructive" });
      }
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
      },
    });
  };

  const handleReplySubmit = (parentId: number) => {
    if (!replyText.trim()) return;
    if (!isSignedIn) {
      toast({ title: "Masuk untuk membalas", variant: "destructive" });
      return;
    }
    createComment.mutate({
      id: videoId,
      data: {
        body: replyText.trim(),
        parentId,
      } as any,
    }, {
      onSuccess: () => {
        setReplyText("");
        setReplyingToId(null);
        setShowRepliesMap((prev) => ({
          ...prev,
          [parentId]: true,
        }));
        refetchComments();
      },
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-16 max-w-screen-2xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="aspect-video bg-muted rounded-xl animate-pulse" />
            <div className="mt-4 h-6 bg-muted rounded animate-pulse w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-xl">Video tidak ditemukan</p>
          <Link href="/"><Button className="mt-4 bg-blue-600">Kembali ke Beranda</Button></Link>
        </div>
      </div>
    );
  }

  const isPremiumLocked = video.minimumPlan && video.minimumPlan !== "basic" && !isSignedIn;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="pt-16 max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-10 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-4">
            {/* Video player */}
            <div ref={playerContainerRef} className="relative aspect-video bg-black rounded-xl overflow-hidden group">
              {isPremiumLocked ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-card gap-4">
                  <Crown className="w-12 h-12 text-amber-400" />
                  <h3 className="text-xl font-bold text-foreground">Konten Premium</h3>
                  <p className="text-muted-foreground text-sm text-center max-w-xs">
                    Berlangganan untuk menonton konten eksklusif ini
                  </p>
                  <Link href="/subscription">
                    <Button className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
                      Mulai Berlangganan
                    </Button>
                  </Link>
                </div>
              ) : isIframeVideo(video.videoUrl) ? (
                <iframe
                  src={getEmbedUrl(video.videoUrl)}
                  className="w-full h-full border-0 aspect-video"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <>
                  <video
                    ref={videoRef}
                    src={getResolutionUrl(currentResolution)}
                    className="w-full h-full object-contain"
                    muted={muted}
                    crossOrigin="anonymous"
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={() => {
                      setDuration(videoRef.current?.duration ?? 0);
                      if (videoRef.current) {
                        videoRef.current.playbackRate = playbackSpeed;
                      }
                    }}
                    onPlay={() => {
                      setPlaying(true);
                      handlePlayTrigger();
                      if (videoRef.current) {
                        videoRef.current.playbackRate = playbackSpeed;
                      }
                    }}
                    onPause={() => setPlaying(false)}
                    onEnded={handleVideoEnded}
                    onError={(e) => {
                      const el = e.currentTarget as HTMLVideoElement;
                      console.error("[VideoPlayer] Error loading video:", el.error?.message, "src:", el.currentSrc);
                    }}
                    poster={resolveMediaUrl(video.thumbnailUrl) ?? undefined}
                    playsInline
                    preload="metadata"
                  />

                  {/* Countdown Auto-Next Overlay */}
                  {countdown !== null && nextVideo && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm animate-in fade-in duration-300">
                      <div className="max-w-md w-full px-6 text-center space-y-6">
                        <div className="space-y-2">
                          <p className="text-xs uppercase tracking-widest text-yellow-400 font-bold">Video Berikutnya</p>
                          <h4 className="text-xl font-bold text-white line-clamp-2">{nextVideo.title}</h4>
                          <p className="text-xs text-gray-400">{nextVideo.uploaderName}</p>
                        </div>
                        
                        {/* Visual Circular/Numeric Countdown */}
                        <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                          {/* SVG circular progress */}
                          <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                            <circle
                              cx="40"
                              cy="40"
                              r="36"
                              className="stroke-white/10"
                              strokeWidth="4"
                              fill="none"
                            />
                            <circle
                              cx="40"
                              cy="40"
                              r="36"
                              className="stroke-yellow-400 transition-all duration-1000 ease-linear"
                              strokeWidth="4"
                              fill="none"
                              strokeDasharray="226.19"
                              strokeDashoffset={226.19 - (226.19 * countdown) / 5}
                            />
                          </svg>
                          <span className="text-2xl font-bold text-white">{countdown}</span>
                        </div>

                        <div className="flex justify-center gap-4 pt-2">
                          <Button
                            onClick={() => {
                              setLocation(`/watch/${nextVideo.id}`);
                              setCountdown(null);
                            }}
                            className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold px-6 py-2 rounded-lg transition-all"
                          >
                            Putar Sekarang
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setCountdown(null);
                            }}
                            className="border-white/20 text-white hover:bg-white/10 px-6 py-2 rounded-lg transition-all"
                          >
                            Batalkan
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Controls overlay */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Click-to-play center — z-0 so controls bar sits above it */}
                    <button
                      onClick={togglePlay}
                      className="absolute inset-0 z-0 flex items-center justify-center cursor-pointer"
                    >
                      {!playing && (
                        <div className="bg-white/20 backdrop-blur-sm rounded-full p-4">
                          <Play className="w-8 h-8 text-white fill-white" />
                        </div>
                      )}
                    </button>
                    {/* Controls bar — z-10 to sit above the click-to-play overlay */}
                    <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-4">
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
                        <div className="flex items-center gap-1.5 group/volume">
                          <button onClick={handleToggleMute} className="text-white hover:text-yellow-400 p-1 rounded transition-colors">
                            {(muted || volume === 0) ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                          </button>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={muted ? 0 : volume}
                            onChange={(e) => handleVolumeChange(Number(e.target.value))}
                            className="w-20 h-1 accent-yellow-400 cursor-pointer bg-white/35 rounded-lg opacity-80 hover:opacity-100 transition-opacity"
                          />
                        </div>
                        <span className="text-xs text-gray-300 ml-auto">
                          {formatDuration(Math.floor(currentTime))} / {formatDuration(Math.floor(duration))}
                        </span>

                        {/* Autoplay Toggle Switch */}
                        <button
                          onClick={() => setAutoNext(!autoNext)}
                          className="flex items-center gap-1.5 text-white hover:text-yellow-400 transition-colors p-1.5 rounded"
                          title={autoNext ? "Putar Otomatis: Aktif" : "Putar Otomatis: Nonaktif"}
                        >
                          <span className="text-[10px] uppercase font-bold tracking-wider hidden sm:inline opacity-80">Autoplay</span>
                          <div className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 ${autoNext ? 'bg-yellow-400' : 'bg-gray-600'}`}>
                            <div className={`w-3.5 h-3.5 rounded-full bg-black transition-transform duration-200 ${autoNext ? 'translate-x-3.5' : 'translate-x-0'}`} />
                          </div>
                        </button>

                        {/* Settings Menu (Speed & Quality) */}
                        <div className="relative" ref={settingsMenuRef}>
                          <button
                            onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                            className="flex items-center gap-1 text-white hover:text-yellow-400 transition-colors text-xs font-semibold px-2 py-1 rounded bg-white/10 hover:bg-white/20 h-7"
                            title="Pengaturan Video"
                          >
                            <Settings className="w-4 h-4 animate-hover-spin" />
                            <span className="hidden xs:inline">
                              {playbackSpeed !== 1.0 ? `${playbackSpeed}x` : ''} {currentResolution}
                            </span>
                          </button>
                          {showSettingsMenu && (
                            <div className="absolute bottom-full right-0 mb-2 bg-black/95 border border-white/10 rounded-lg p-3 w-52 flex flex-col gap-3 z-50 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150">
                              {/* Speed Section */}
                              <div className="flex flex-col gap-1.5">
                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1">
                                  <Gauge className="w-3 h-3" />
                                  Kecepatan
                                </div>
                                <div className="grid grid-cols-3 gap-1">
                                  {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((speed) => (
                                    <button
                                      key={speed}
                                      onClick={() => handleSpeedChange(speed)}
                                      className={`text-center py-1 text-[10px] rounded transition-colors ${
                                        playbackSpeed === speed
                                          ? 'bg-yellow-400 text-black font-bold'
                                          : 'bg-white/5 hover:bg-white/15 text-gray-300'
                                      }`}
                                    >
                                      {speed === 1.0 ? 'Normal' : `${speed}x`}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              
                              {/* Divider */}
                              <div className="border-t border-white/10" />

                              {/* Quality Section */}
                              <div className="flex flex-col gap-1.5">
                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1">
                                  <Settings className="w-3 h-3" />
                                  Kualitas Video
                                </div>
                                <div className="grid grid-cols-3 gap-1">
                                  {getAvailableResolutions().map((quality) => (
                                    <button
                                      key={quality.value}
                                      onClick={() => handleResolutionChange(quality.value)}
                                      className={`text-center py-1 text-[10px] rounded transition-colors ${
                                        currentResolution === quality.value
                                          ? 'bg-yellow-400 text-black font-bold'
                                          : 'bg-white/5 hover:bg-white/15 text-gray-300'
                                      }`}
                                      title={quality.label}
                                    >
                                      {quality.value === 'default' ? 'Default' : quality.value}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            if (!document.fullscreenElement) {
                              const target = playerContainerRef.current ?? videoRef.current;
                              if (target?.requestFullscreen) {
                                target.requestFullscreen().catch((err: Error) => {
                                  console.error("Gagal fullscreen:", err);
                                });
                              }
                            } else {
                              document.exitFullscreen();
                            }
                          }}
                          className="text-white hover:text-yellow-400 transition-colors"
                          title={isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
                        >
                          {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Video info */}
            <div>
              {video.genre && (
                <Badge className="mb-2 bg-blue-600 border-0 text-xs">{video.genre}</Badge>
              )}
              <h1 className="text-2xl font-bold text-foreground">{video.title}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  {(localViewCount ?? 0).toLocaleString("id-ID")} tayangan
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full text-xs font-semibold select-none animate-in fade-in duration-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>{activeWatchers} sedang menonton</span>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatDate(video.createdAt ?? new Date().toISOString())}
                </span>
              </div>

              {/* Creator & Actions Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-b border-border/60 py-4 my-4 gap-4">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10 border border-border flex-shrink-0">
                    {video.uploaderAvatar && (
                      <AvatarImage src={resolveMediaUrl(video.uploaderAvatar)} alt={video.uploaderName} />
                    )}
                    <AvatarFallback className="bg-blue-600 text-white font-bold">
                      {video.uploaderName?.[0]?.toUpperCase() ?? "S"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    {video.uploaderId ? (
                      <Link
                        href={`/creator/${encodeURIComponent(video.uploaderId)}`}
                        className="text-base font-bold text-foreground hover:text-yellow-400 transition-colors"
                      >
                        {video.uploaderName}
                      </Link>
                    ) : (
                      <span className="text-base font-bold text-foreground">{video.uploaderName}</span>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatNum(localFollowerCount)} Pengikut
                    </p>
                  </div>

                  {/* Follow Button */}
                  {video.uploaderId && userId !== video.uploaderId && (
                    <Button
                      size="sm"
                      onClick={handleFollow}
                      className={`ml-4 transition-all duration-200 hover:scale-105 active:scale-95 font-semibold gap-1.5 shadow-sm ${
                        localFollowing
                          ? "bg-secondary/40 border border-border text-foreground hover:bg-secondary/60"
                          : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20"
                      }`}
                    >
                      {localFollowing ? (
                        <>
                          <UserCheck className="w-4 h-4 text-green-400 animate-pulse" />
                          ✅ Mengikuti
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          👤+ Follow
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {/* Video Actions */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLike}
                    className={`gap-2 border-border transition-all duration-200 hover:scale-105 active:scale-95 ${
                      liked
                        ? "text-yellow-400 border-yellow-400 bg-yellow-400/10 shadow-md shadow-yellow-500/10"
                        : "text-muted-foreground hover:text-yellow-400 hover:border-yellow-400/35 hover:bg-yellow-400/5"
                    }`}
                  >
                    <ThumbsUp className={`w-4 h-4 transition-transform duration-200 ${liked ? "fill-yellow-400 scale-110" : ""}`} />
                    {likeCount.toLocaleString("id-ID")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleWatchlist}
                    className={`gap-2 border-border transition-all duration-200 hover:scale-105 active:scale-95 ${
                      saved
                        ? "text-emerald-400 border-emerald-400 bg-emerald-400/10 shadow-md shadow-emerald-500/10"
                        : "text-muted-foreground hover:text-emerald-400 hover:border-emerald-400/35 hover:bg-emerald-400/5"
                    }`}
                  >
                    <Bookmark className={`w-4 h-4 transition-transform duration-200 ${saved ? "fill-emerald-400 text-emerald-400 scale-110" : ""}`} />
                    {saved ? "Tersimpan" : "Simpan"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      toast({ title: "Tautan disalin!" });
                    }}
                    className="gap-2 border-border text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-105 active:scale-95"
                  >
                    <Share2 className="w-4 h-4" />
                    Bagikan
                  </Button>
                </div>
              </div>

              {video.description && (
                <div className="mt-4 bg-card/60 rounded-lg p-4 border border-border/40">
                  <p className={`text-muted-foreground text-sm leading-relaxed whitespace-pre-line ${!descExpanded ? "line-clamp-3" : ""}`}>
                    {video.description}
                  </p>
                  {video.description.length > 150 && (
                    <button
                      onClick={() => setDescExpanded(!descExpanded)}
                      className="text-yellow-400 hover:text-yellow-300 font-bold text-xs mt-2 transition-colors block"
                    >
                      {descExpanded ? "Lebih Sedikit" : "Selengkapnya"}
                    </button>
                  )}
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
                    {user?.imageUrl ? (
                      <AvatarImage src={user.imageUrl} alt={user.fullName ?? "Profil"} />
                    ) : (
                      <AvatarFallback className="bg-blue-600 text-white text-sm">{myInitial}</AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <Textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Tambahkan komentar..."
                      className="bg-card border-border text-foreground resize-none text-sm"
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
                <div className="mb-6 p-3 rounded-lg bg-card/60 text-sm text-muted-foreground text-center">
                  <Link href="/sign-in" className="text-yellow-400 hover:text-yellow-300">Masuk</Link> untuk berkomentar
                </div>
              )}

              {/* Group root comments and replies */}
              {(() => {
                const rootComments = (comments ?? []).filter((c: any) => !c.parentId);
                const repliesMap = (comments ?? []).reduce((acc: Record<number, any[]>, c: any) => {
                  if (c.parentId) {
                    if (!acc[c.parentId]) acc[c.parentId] = [];
                    acc[c.parentId].push(c);
                  }
                  return acc;
                }, {});

                // Sort replies chronologically (earliest first)
                Object.keys(repliesMap).forEach((key) => {
                  repliesMap[Number(key)].sort(
                    (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                  );
                });

                return (
                  <div className="space-y-6">
                    {rootComments.map((c: any) => {
                      const authorInitial = c.authorName?.[0]?.toUpperCase() ?? "U";
                      const avatarEl = (
                        <Avatar className="w-8 h-8 flex-shrink-0">
                          {c.authorAvatar && (
                            <AvatarImage src={resolveMediaUrl(c.authorAvatar)} alt={c.authorName} />
                          )}
                          <AvatarFallback className="bg-muted text-foreground text-xs">
                            {authorInitial}
                          </AvatarFallback>
                        </Avatar>
                      );

                      return (
                        <div key={c.id} className="group-comment border-b border-border/10 pb-4">
                          <div className="flex gap-3">
                            {c.authorId ? (
                              <Link href={`/creator/${encodeURIComponent(c.authorId)}`} className="flex-shrink-0 hover:opacity-80 transition-opacity">
                                {avatarEl}
                              </Link>
                            ) : (
                              avatarEl
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                {c.authorId ? (
                                  <Link
                                    href={`/creator/${encodeURIComponent(c.authorId)}`}
                                    className="text-sm font-medium text-foreground hover:text-yellow-400 transition-colors"
                                  >
                                    {c.authorName}
                                  </Link>
                                ) : (
                                  <span className="text-sm font-medium text-foreground">{c.authorName}</span>
                                )}
                                <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{c.body}</p>

                              {/* Action Row */}
                              <div className="flex flex-col items-start gap-1 mt-2">
                                <button
                                  onClick={() => {
                                    if (replyingToId === c.id) {
                                      setReplyingToId(null);
                                    } else {
                                      setReplyingToId(c.id);
                                      setReplyText("");
                                    }
                                  }}
                                  className="text-xs text-muted-foreground hover:text-foreground font-bold transition-colors"
                                >
                                  Balas
                                </button>

                                {repliesMap[c.id] && repliesMap[c.id].length > 0 && (
                                  <button
                                    onClick={() => {
                                      setShowRepliesMap((prev) => ({
                                        ...prev,
                                        [c.id]: !prev[c.id],
                                      }));
                                    }}
                                    className="text-blue-500 font-semibold text-xs mt-1 hover:underline flex items-center gap-1 cursor-pointer select-none"
                                  >
                                    {showRepliesMap[c.id] ? (
                                      <>
                                        <span>▲ Sembunyikan balasan</span>
                                      </>
                                    ) : (
                                      <>
                                        <span>▼ Lihat {repliesMap[c.id].length} balasan</span>
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>

                              {/* Reply Input Form */}
                              {replyingToId === c.id && (
                                <div className="flex gap-2 mt-3 pl-2">
                                  <Avatar className="w-7 h-7 flex-shrink-0">
                                    {user?.imageUrl ? (
                                      <AvatarImage src={user.imageUrl} alt={user.fullName ?? "Profil"} />
                                    ) : (
                                      <AvatarFallback className="bg-blue-600 text-white text-xs">{myInitial}</AvatarFallback>
                                    )}
                                  </Avatar>
                                  <div className="flex-1 flex gap-2">
                                    <Input
                                      value={replyText}
                                      onChange={(e) => setReplyText(e.target.value)}
                                      placeholder="Balas komentar ini..."
                                      className="bg-card border-border text-foreground text-xs h-8"
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && replyText.trim()) {
                                          handleReplySubmit(c.id);
                                        }
                                      }}
                                      autoFocus
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() => handleReplySubmit(c.id)}
                                      disabled={!replyText.trim() || createComment.isPending}
                                      className="bg-blue-600 hover:bg-blue-700 h-8 text-xs px-3"
                                    >
                                      Kirim
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {/* Replies List */}
                              {showRepliesMap[c.id] && repliesMap[c.id] && repliesMap[c.id].length > 0 && (
                                <div className="ml-8 sm:ml-10 mt-4 space-y-4 border-l border-border/40 pl-4">
                                  {repliesMap[c.id].map((reply: any) => {
                                    const replyAuthorInitial = reply.authorName?.[0]?.toUpperCase() ?? "U";
                                    const replyAvatarEl = (
                                      <Avatar className="w-7 h-7 flex-shrink-0">
                                        {reply.authorAvatar && (
                                          <AvatarImage src={resolveMediaUrl(reply.authorAvatar)} alt={reply.authorName} />
                                        )}
                                        <AvatarFallback className="bg-muted text-foreground text-[10px]">
                                          {replyAuthorInitial}
                                        </AvatarFallback>
                                      </Avatar>
                                    );
                                    return (
                                      <div key={reply.id} className="flex gap-2">
                                        {reply.authorId ? (
                                          <Link href={`/creator/${encodeURIComponent(reply.authorId)}`} className="flex-shrink-0 hover:opacity-80 transition-opacity">
                                            {replyAvatarEl}
                                          </Link>
                                        ) : (
                                          replyAvatarEl
                                        )}
                                        <div>
                                          <div className="flex items-center gap-2">
                                            {reply.authorId ? (
                                              <Link
                                                href={`/creator/${encodeURIComponent(reply.authorId)}`}
                                                className="text-xs font-semibold text-foreground hover:text-yellow-400 transition-colors"
                                              >
                                                {reply.authorName}
                                              </Link>
                                            ) : (
                                              <span className="text-xs font-semibold text-foreground">{reply.authorName}</span>
                                            )}
                                            <span className="text-[10px] text-muted-foreground">{formatDate(reply.createdAt)}</span>
                                          </div>
                                          <p className="text-xs text-muted-foreground mt-1">{reply.body}</p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Sidebar - related videos */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Video Serupa</h3>
            {(related?.videos ?? [])
              .filter((v: any) => v.id !== videoId)
              .slice(0, 7)
              .map((v: any) => (
                <Link key={v.id} href={`/watch/${v.id}`} className="flex gap-3 group hover:bg-accent rounded-lg p-1 transition-colors">
                  <div className="relative w-32 aspect-video flex-shrink-0 rounded overflow-hidden bg-muted">
                    {v.thumbnailUrl ? (
                      <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        <Play className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    {v.duration && (
                      <span className="absolute bottom-1 right-1 text-[10px] bg-black/80 text-white px-1 rounded">
                        {formatDuration(v.duration)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-yellow-400 transition-colors">{v.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{v.uploaderName}</p>
                    <p className="text-xs text-muted-foreground">{(v.viewCount ?? 0).toLocaleString("id-ID")} tayangan</p>
                  </div>
                </Link>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

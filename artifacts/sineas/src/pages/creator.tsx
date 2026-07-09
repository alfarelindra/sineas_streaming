import {
  useListVideos,
  useGetCreatorProfile,
  useGetFollowStatus,
  useFollowCreator,
  useUnfollowCreator,
  useGetPlatformStats,
  useDeleteVideo,
  useUpdateVideo,
} from "@workspace/api-client-react";
import Navbar from "@/components/Navbar";
import VideoCard from "@/components/VideoCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useParams, Link } from "wouter";
import {
  Film, Eye, ThumbsUp, User, Users, UserPlus, UserCheck,
  Edit3, BarChart3, TrendingUp, Play, Trash2, AlertTriangle, Upload, Camera
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

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

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-card/60 border border-border rounded-2xl p-5 flex items-start gap-4">
      <div className={`p-3 rounded-xl ${color}`}>{icon}</div>
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-2xl font-black text-foreground mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  videoTitle,
  onConfirm,
  onCancel,
  isPending,
}: {
  videoTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Modal box */}
      <div className="relative z-10 bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4 mb-5">
          <div className="p-2.5 rounded-xl bg-red-500/15 flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-base">Hapus Video</h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Apakah kamu yakin ingin menghapus{" "}
              <span className="font-semibold text-foreground">"{videoTitle}"</span>?
              Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isPending}
            className="border-border text-muted-foreground hover:text-foreground"
          >
            Batal
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={isPending}
            className="bg-red-600 hover:bg-red-700 text-white gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {isPending ? "Menghapus…" : "Ya, Hapus"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditVideoModal({
  video,
  onSave,
  onCancel,
  isPending,
}: {
  video: any;
  onSave: (data: { title: string; description: string; isPublic: boolean }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState(video.title || "");
  const [description, setDescription] = useState(video.description || "");
  const [isPublic, setIsPublic] = useState(video.isPublic ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ title, description, isPublic });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Modal box */}
      <div className="relative z-10 bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <h3 className="font-bold text-foreground text-lg mb-4 border-b border-border pb-3 flex items-center gap-2">
          <Edit3 className="w-5 h-5 text-blue-400" />
          Edit Detail Video
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-title">Judul Video</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Masukkan judul video..."
              className="bg-muted border-border focus-visible:ring-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-desc">Deskripsi</Label>
            <Textarea
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Masukkan deskripsi video..."
              rows={4}
              className="bg-muted border-border resize-none focus-visible:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-between border-t border-border/60 pt-4 pb-1">
            <div>
              <Label htmlFor="edit-visibility" className="font-bold">Visibilitas Publik</Label>
              <p className="text-xs text-muted-foreground">Aktifkan agar video dapat ditonton oleh semua orang</p>
            </div>
            <Switch
              id="edit-visibility"
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={isPending}
              className="border-border text-muted-foreground hover:text-foreground"
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold gap-2"
            >
              {isPending ? "Menyimpan…" : "Simpan Perubahan"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CreatorPage() {
  const params = useParams<{ id: string }>();
  const creatorId = decodeURIComponent(params.id ?? "");

  const { isSignedIn, userId, getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rawProfile, isLoading: profileLoading, isError: profileError, refetch: refetchProfile } =
    useGetCreatorProfile(creatorId, { query: { enabled: !!creatorId } as any });
  const profile = rawProfile as any;

  const { data: follow, refetch: refetchFollow } = useGetFollowStatus(creatorId, {
    query: { enabled: !!creatorId } as any,
  });

  const followCreator = useFollowCreator();
  const unfollowCreator = useUnfollowCreator();

  // Load platform stats (for dashboard mode)
  const { data: platformStats } = useGetPlatformStats();
  // Delete video mutation
  const deleteVideo = useDeleteVideo();

  const isOwnProfile = !!userId && userId === creatorId;
  const isFollowing = follow?.isFollowing ?? false;
  const followerCount = follow?.followerCount ?? profile?.followerCount ?? 0;
  const followPending = followCreator.isPending || unfollowCreator.isPending;

  const handleFollow = async () => {
    if (!isSignedIn) {
      toast({ title: "Masuk untuk mengikuti kreator" });
      return;
    }
    try {
      if (isFollowing) {
        await unfollowCreator.mutateAsync({ id: creatorId });
      } else {
        await followCreator.mutateAsync({ id: creatorId });
      }
      await refetchFollow();
    } catch {
      toast({ title: "Gagal memperbarui status mengikuti", variant: "destructive" });
    }
  };

  // ── FILTER VIDEOS DIRECTLY FROM DB: uploaderId = creatorId ──────────
  const { data: videosData, isLoading: videosLoading, refetch: refetchVideos } = useListVideos({
    limit: 100,
    uploaderId: creatorId,
  } as any);
  const creatorVideos = videosData?.videos ?? [];
  // ───────────────────────────────────────────────────────────────────

  // Calculate creator stats dynamically
  const totalViews = creatorVideos.reduce((s: number, v: any) => s + (v.viewCount ?? 0), 0);
  const totalLikes = creatorVideos.reduce((s: number, v: any) => s + (v.likeCount ?? 0), 0);

  const isLoading = profileLoading;
  const notFound = profileError && !profileLoading;
  const creatorName: string = profile?.displayName ?? "Kreator";
  const bio = profile?.bio ?? null;
  const avatarUrl = profile?.avatarUrl ?? null;
  const bannerUrl = (profile as any)?.bannerUrl ?? null;
  const videoCount = creatorVideos.length;
  const gradient = avatarGradient(creatorId);

  // Edit Profile modal state
  const [editing, setEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editBannerUrl, setEditBannerUrl] = useState("");

  // Read tab parameter from URL query string
  const [activeTab, setActiveTab] = useState(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const tabParam = queryParams.get("tab");
    return tabParam === "dashboard" ? "dashboard" : "videos";
  });

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const tabParam = queryParams.get("tab");
    if (tabParam && (tabParam === "videos" || tabParam === "dashboard" || tabParam === "about")) {
      setActiveTab(tabParam);
    }
  }, [window.location.search]);

  const startEdit = () => {
    setEditDisplayName(profile?.displayName ?? "");
    setEditBio(profile?.bio ?? "");
    setEditAvatarUrl(profile?.avatarUrl ?? "");
    setEditBannerUrl((profile as any)?.bannerUrl ?? "");
    setEditing(true);
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { displayName: string; bio: string; avatarUrl: string; bannerUrl: string }) => {
      const token = await getToken();
      const headers: HeadersInit = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers,
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Gagal memperbarui profil");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Profil berhasil diperbarui!" });
      setEditing(false);
      refetchProfile();
      refetchVideos();
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
    },
    onError: (err) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  // Delete Video state
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const deletingVideo = creatorVideos.find((v: any) => v.id === deletingId) as any | undefined;

  const handleDeleteConfirm = () => {
    if (deletingId == null) return;
    deleteVideo.mutate(
      { id: deletingId },
      {
        onSuccess: () => {
          toast({ title: "Video berhasil dihapus" });
          setDeletingId(null);
          refetchVideos();
          refetchProfile();
          queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
        },
        onError: (err: any) => {
          const msg = err?.data?.error ?? err?.message ?? "Gagal menghapus video";
          toast({ title: msg, variant: "destructive" });
          setDeletingId(null);
        },
      }
    );
  };

  // Edit Video state
  const [editingVideo, setEditingVideo] = useState<any | null>(null);
  const updateVideoMutation = useUpdateVideo();

  const handleEditSave = (data: { title: string; description: string; isPublic: boolean }) => {
    if (!editingVideo) return;
    updateVideoMutation.mutate(
      {
        id: editingVideo.id,
        data: {
          title: data.title,
          description: data.description,
          isPublic: data.isPublic,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Video berhasil diperbarui!" });
          setEditingVideo(null);
          refetchVideos();
          queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
        },
        onError: (err: any) => {
          const msg = err?.data?.error ?? err?.message ?? "Gagal memperbarui video";
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      {/* Delete confirmation modal */}
      {deletingId != null && deletingVideo && (
        <DeleteConfirmModal
          videoTitle={deletingVideo.title}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingId(null)}
          isPending={deleteVideo.isPending}
        />
      )}

      {/* Edit Video Modal */}
      {editingVideo && (
        <EditVideoModal
          video={editingVideo}
          onSave={handleEditSave}
          onCancel={() => setEditingVideo(null)}
          isPending={updateVideoMutation.isPending}
        />
      )}

      {/* Edit Profile / Channel Customization Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditing(false)} />
          <div className="relative z-10 bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="font-bold text-foreground text-lg mb-4">Sesuaikan Channel</h3>
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-xs">Nama Tampilan</Label>
                <Input
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="bg-card border-border text-foreground mt-1"
                />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Bio / Deskripsi Singkat</Label>
                <Textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={3}
                  className="bg-card border-border text-foreground mt-1 resize-none"
                />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">URL Foto Profil / Avatar</Label>
                <Input
                  value={editAvatarUrl}
                  onChange={(e) => setEditAvatarUrl(e.target.value)}
                  className="bg-card border-border text-foreground mt-1"
                  placeholder="https://example.com/avatar.jpg"
                />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">URL Banner Belakang</Label>
                <Input
                  value={editBannerUrl}
                  onChange={(e) => setEditBannerUrl(e.target.value)}
                  className="bg-card border-border text-foreground mt-1"
                  placeholder="https://example.com/banner.jpg"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(false)}
                disabled={updateProfileMutation.isPending}
                className="border-border text-muted-foreground hover:text-foreground"
              >
                Batal
              </Button>
              <Button
                size="sm"
                onClick={() => updateProfileMutation.mutate({
                  displayName: editDisplayName.trim(),
                  bio: editBio.trim(),
                  avatarUrl: editAvatarUrl.trim(),
                  bannerUrl: editBannerUrl.trim(),
                })}
                disabled={updateProfileMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                {updateProfileMutation.isPending ? "Menyimpan…" : "Simpan Perubahan"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {notFound ? (
        <div className="max-w-screen-xl mx-auto px-6 sm:px-10 py-32 text-center text-muted-foreground">
          <User className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-semibold text-foreground">Kreator tidak ditemukan</p>
          <p className="text-sm mt-1 text-muted-foreground">
            ID kreator ini tidak dikenali.
          </p>
        </div>
      ) : (
        <>
          {/* YouTube Style Banner */}
          <div
            className="w-full h-48 sm:h-56 relative group/banner bg-cover bg-center border-b border-border/20 overflow-hidden"
            style={{
              backgroundImage: bannerUrl ? `url(${bannerUrl})` : undefined,
            }}
          >
            {!bannerUrl && (
              <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-60`} />
            )}
            {isOwnProfile && (
              <button
                onClick={startEdit}
                className="absolute bottom-4 right-4 bg-black/75 hover:bg-black text-white rounded-lg px-3 py-1.5 border border-white/10 transition-all opacity-0 group-hover/banner:opacity-100 flex items-center gap-1.5 text-xs font-bold shadow-lg"
                title="Ubah Banner Belakang"
              >
                <Camera className="w-4 h-4" />
                <span>Ubah Banner</span>
              </button>
            )}
          </div>

          <div className="max-w-screen-xl mx-auto px-6 sm:px-10 pb-16">
            {/* Profile header */}
            <div className="-mt-14 sm:-mt-16 mb-10 flex flex-col sm:flex-row items-start sm:items-end gap-4 relative z-10">
              <div className="relative group/avatar">
                <Avatar className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-background flex-shrink-0 shadow-xl overflow-hidden">
                  {avatarUrl && (
                    <AvatarImage src={avatarUrl} alt={creatorName} className="object-cover w-full h-full" />
                  )}
                  <AvatarFallback className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-3xl font-black`}>
                    {isLoading ? <User className="w-10 h-10 opacity-50" /> : getInitials(creatorName)}
                  </AvatarFallback>
                </Avatar>
                {isOwnProfile && (
                  <div
                    onClick={startEdit}
                    className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover/avatar:opacity-100 flex flex-col items-center justify-center text-white cursor-pointer transition-opacity text-xs border border-white/10"
                  >
                    <Camera className="w-5 h-5 mb-1" />
                    <span className="font-bold text-[9px] uppercase tracking-wide">Ganti Foto</span>
                  </div>
                )}
              </div>

              <div className="flex-1 pb-1">
                {isLoading ? (
                  <div className="h-8 w-48 bg-muted rounded animate-pulse mb-2" />
                ) : (
                  <h1 className="text-2xl sm:text-3xl font-black text-foreground">{creatorName}</h1>
                )}
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <p className="text-muted-foreground text-sm">Kreator Sineas</p>
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span className="font-bold text-foreground">{formatNum(followerCount)}</span>
                    Pengikut
                  </span>
                </div>
                {!isLoading && bio && (
                  <p className="text-foreground/80 text-sm mt-3 max-w-2xl leading-relaxed whitespace-pre-line">
                    {bio}
                  </p>
                )}
              </div>

              {!isLoading && (
                <div className="flex-shrink-0 pb-1">
                  {isOwnProfile ? (
                    <Button
                      variant="outline"
                      onClick={startEdit}
                      className="gap-2 border-border text-foreground hover:bg-muted font-bold"
                    >
                      <Edit3 className="w-4 h-4 text-blue-400" />
                      🎨 Sesuaikan Channel
                    </Button>
                  ) : (
                    isFollowing ? (
                      <Button
                        variant="outline"
                        onClick={handleFollow}
                        disabled={followPending}
                        className="gap-2 border-border text-foreground hover:bg-muted font-bold"
                      >
                        <UserCheck className="w-4 h-4 text-green-400" />
                        Mengikuti
                      </Button>
                    ) : (
                      <Button
                        onClick={handleFollow}
                        disabled={followPending}
                        className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold"
                      >
                        <UserPlus className="w-4 h-4" />
                        Ikuti
                      </Button>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Profile Statistics Block */}
            {!isLoading && (
              <div className="flex gap-6 sm:gap-10 mb-8 border-b border-border pb-6">
                <div className="text-center">
                  <div className="flex items-center gap-2 text-2xl font-black text-foreground">
                    <Film className="w-5 h-5 text-yellow-400" />
                    {videoCount}
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

            {/* Content Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="bg-card border border-border mb-6">
                <TabsTrigger value="videos" className="data-[state=active]:bg-muted data-[state=active]:text-foreground text-muted-foreground gap-2 font-semibold">
                  <Film className="w-4 h-4" /> Beranda / Video
                </TabsTrigger>
                {isOwnProfile && (
                  <TabsTrigger value="dashboard" className="data-[state=active]:bg-muted data-[state=active]:text-foreground text-muted-foreground gap-2 font-semibold">
                    <BarChart3 className="w-4 h-4" /> Dashboard Statistik
                  </TabsTrigger>
                )}
                <TabsTrigger value="about" className="data-[state=active]:bg-muted data-[state=active]:text-foreground text-muted-foreground gap-2 font-semibold">
                  <User className="w-4 h-4" /> Tentang (About)
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Beranda / Video */}
              <TabsContent value="videos" className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                    Video oleh {creatorName}
                  </h2>
                  {isOwnProfile && (
                    <Link href="/upload">
                      <Button className="bg-blue-600 hover:bg-blue-700 gap-2 text-xs h-8 font-bold">
                        <Upload className="w-3.5 h-3.5" /> Upload Video Baru
                      </Button>
                    </Link>
                  )}
                </div>

                {videosLoading ? (
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
                    <p className="text-lg font-semibold text-foreground">Belum ada video</p>
                    <p className="text-sm mt-1 text-muted-foreground">
                      {isOwnProfile ? "Kamu belum mengunggah video apa pun. Silakan upload video pertama kamu!" : "Kreator ini belum mengunggah video apa pun."}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {creatorVideos.map((v: any) => (
                      <VideoCard key={v.id} video={v} />
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Tab 2: Dashboard Statistik (Owner Only) */}
              {isOwnProfile && (
                <TabsContent value="dashboard" className="space-y-8">
                  {/* My video stats */}
                  <div>
                    <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Statistik Video Saya</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <StatCard icon={<Film className="w-5 h-5 text-yellow-400" />} label="Video Diupload" value={videoCount} color="bg-yellow-400/20" />
                      <StatCard icon={<Eye className="w-5 h-5 text-amber-400" />} label="Total Tayangan" value={formatNum(totalViews)} color="bg-amber-500/20" />
                      <StatCard icon={<ThumbsUp className="w-5 h-5 text-pink-400" />} label="Total Like" value={formatNum(totalLikes)} color="bg-pink-500/20" />
                    </div>
                  </div>

                  {/* Platform-wide stats */}
                  <div>
                    <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Platform Global Sineas</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <StatCard icon={<Film className="w-5 h-5 text-blue-400" />} label="Total Video Platform" value={formatNum(platformStats?.totalVideos ?? 0)} color="bg-blue-500/20" />
                      <StatCard icon={<Eye className="w-5 h-5 text-green-400" />} label="Total Tayangan Platform" value={formatNum(platformStats?.totalViews ?? 0)} color="bg-green-500/20" />
                      <StatCard icon={<Users className="w-5 h-5 text-purple-400" />} label="Total Pengguna" value={formatNum(platformStats?.totalUsers ?? 0)} color="bg-purple-500/20" />
                    </div>
                  </div>

                  {/* Video performance list with edit and delete options (YouTube Studio style) */}
                  <div>
                    <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-400" /> Konten Channel
                    </h2>
                    {creatorVideos.length === 0 ? (
                      <div className="text-center py-10 bg-card/40 border border-border rounded-2xl text-muted-foreground text-sm">
                        Belum ada video di channel ini. Silakan unggah video baru!
                      </div>
                    ) : (
                      <div className="bg-card/60 border border-border rounded-2xl overflow-hidden shadow-sm">
                        <div className="grid grid-cols-[2.5fr_3fr_1.2fr_1.5fr_1fr] gap-4 px-5 py-3.5 border-b border-border text-xs text-muted-foreground font-bold uppercase tracking-wider items-center bg-muted/30">
                          <span>Video</span>
                          <span>Deskripsi</span>
                          <span>Visibilitas</span>
                          <span>Tanggal</span>
                          <span className="text-center">Aksi</span>
                        </div>

                        {creatorVideos.map((v: any) => (
                          <div
                            key={v.id}
                            className="grid grid-cols-[2.5fr_3fr_1.2fr_1.5fr_1fr] gap-4 px-5 py-4 border-b border-border/60 hover:bg-accent/30 transition-colors items-center text-sm"
                          >
                            <Link href={`/watch/${v.id}`} className="flex items-center gap-3 min-w-0 group">
                              {v.thumbnailUrl ? (
                                <img src={v.thumbnailUrl} className="w-14 h-9 object-cover rounded-md flex-shrink-0 border border-border/20 shadow-sm" alt={v.title} />
                              ) : (
                                <div className="w-14 h-9 bg-muted rounded-md flex-shrink-0 flex items-center justify-center border border-border/20">
                                  <Play className="w-4 h-4 text-muted-foreground" />
                                </div>
                              )}
                              <span className="font-semibold text-foreground group-hover:text-yellow-400 transition-colors truncate" title={v.title}>
                                {v.title}
                              </span>
                            </Link>
                            <span className="text-muted-foreground line-clamp-2 pr-4 text-xs">
                              {v.description ? v.description : <span className="italic opacity-60">Tidak ada deskripsi</span>}
                            </span>
                            <div>
                              {v.isPublic ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20">
                                  Publik
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
                                  Privat
                                </span>
                              )}
                            </div>
                            <span className="text-muted-foreground text-xs font-medium">
                              {v.createdAt ? new Date(v.createdAt).toLocaleDateString("id-ID", { year: "numeric", month: "short", day: "numeric" }) : "-"}
                            </span>
                            <div className="flex justify-center items-center gap-1.5">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setEditingVideo(v)}
                                className="w-8 h-8 rounded-lg hover:bg-blue-500/10 hover:text-blue-400 text-muted-foreground transition-colors"
                                title="Edit Detail Video"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setDeletingId(v.id)}
                                className="w-8 h-8 rounded-lg hover:bg-red-500/10 hover:text-red-400 text-muted-foreground transition-colors"
                                title="Hapus Video"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              )}

              {/* Tab 3: Tentang (About) */}
              <TabsContent value="about" className="space-y-4">
                <div className="bg-card/60 border border-border rounded-2xl p-6 max-w-2xl">
                  <h3 className="text-lg font-bold text-foreground mb-4">Tentang Kreator</h3>
                  {bio ? (
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line mb-6">
                      {bio}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic mb-6">
                      Kreator ini belum menulis deskripsi atau bio.
                    </p>
                  )}
                  <div className="border-t border-border/60 pt-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tanggal Bergabung</span>
                      <span className="text-foreground font-semibold">
                        {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" }) : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Link Media Sosial</span>
                      <span className="text-muted-foreground italic">Tidak ada link sosial</span>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </>
      )}
    </div>
  );
}

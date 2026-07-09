import { useState, useRef } from "react";
import { useAuth, useUser } from "@clerk/react";
import { useCreateVideo, useGetMe, useGetSubscriptionStatus, useGetFollowStatus } from "@workspace/api-client-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Upload as UploadIcon, Film, Image, CheckCircle2, AlertCircle, Link as LinkIcon, Play, Crown, Users, Info } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { VITE_BUCKET } from "@/lib/supabase";

const GENRES = ["Drama", "Aksi", "Komedi", "Horor", "Dokumenter", "Animasi", "Thriller", "Romantis"];

type UploadStep = "form" | "uploading" | "done" | "error";

/**
 * Upload file via backend signed URL — uses service role key server-side,
 * so RLS policies and bucket existence are handled automatically.
 */
async function uploadFile(file: File, onProgress?: (pct: number) => void): Promise<string> {
  // Step 1: Request a signed upload URL from our backend
  const urlRes = await fetch("/api/storage/uploads/request-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ filename: file.name, contentType: file.type }),
  });

  if (!urlRes.ok) {
    const err = await urlRes.json().catch(() => ({ error: "Gagal mendapatkan URL upload" }));
    throw new Error(err.error ?? "Gagal mendapatkan URL upload dari server");
  }

  const { uploadUrl, objectPath } = await urlRes.json();

  // Step 2: Upload file to Supabase via signed URL using FormData
  // Supabase signed upload endpoint expects multipart/form-data (same as SDK internally)
  await new Promise<void>((resolve, reject) => {
    const formData = new FormData();
    formData.append("cacheControl", "3600");
    formData.append("", file, file.name); // Supabase expects empty-string key for the file

    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    // Do NOT set Content-Type manually — browser must auto-set it with multipart boundary
    xhr.upload.onprogress = (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        console.error("Supabase upload response:", xhr.status, xhr.responseText);
        reject(new Error(`Upload gagal: HTTP ${xhr.status} — ${xhr.responseText}`));
      }
    };
    xhr.onerror = () => reject(new Error("Koneksi gagal saat upload"));
    xhr.send(formData);
  });


  // Step 3: Build public URL from objectPath
  // objectPath is the full public URL returned by normalizeObjectEntityPath
  if (objectPath.startsWith("http")) {
    return objectPath;
  }
  // Fallback: construct Supabase public URL
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "https://rvnfudoqiseujbwzjqfo.supabase.co";
  return `${supabaseUrl}/storage/v1/object/public/${VITE_BUCKET}/${objectPath.replace(/^\//, "")}`;
}



export default function UploadPage() {
  const [, setLocation] = useLocation();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { toast } = useToast();
  const createVideo = useCreateVideo();
  const { data: me } = useGetMe();
  const { data: subStatus } = useGetSubscriptionStatus({ query: { enabled: !!isSignedIn } as any });
  const { data: followData } = useGetFollowStatus(user?.id ?? "", { query: { enabled: !!user?.id } as any });

  const [step, setStep] = useState<UploadStep>("form");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploadedVideoId, setUploadedVideoId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [minimumPlan, setMinimumPlan] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [duration, setDuration] = useState<number>(0);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [useDirectUrl, setUseDirectUrl] = useState(false);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const handleVideoFile = (f: File | null) => {
    if (!f) return;
    const MAX_SIZE = 5 * 1024 * 1024 * 1024; // 5GB limit for large indie movies
    if (f.size > MAX_SIZE) {
      toast({
        title: "File Terlalu Besar",
        description: "Ukuran video maksimal adalah 5GB.",
        variant: "destructive"
      });
      if (videoInputRef.current) videoInputRef.current.value = "";
      return;
    }
    setVideoFile(f);
    const el = document.createElement("video");
    el.preload = "metadata";
    el.src = URL.createObjectURL(f);
    el.onloadedmetadata = () => {
      setDuration(Math.round(el.duration));
      URL.revokeObjectURL(el.src);
    };
  };

  const handleThumbnailFile = (f: File | null) => {
    if (!f) return;
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB limit
    if (f.size > MAX_SIZE) {
      toast({
        title: "File Terlalu Besar",
        description: "Ukuran thumbnail maksimal adalah 5MB.",
        variant: "destructive"
      });
      if (thumbInputRef.current) thumbInputRef.current.value = "";
      return;
    }
    setThumbnailFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast({ title: "Judul diperlukan", variant: "destructive" }); return; }
    if (!videoUrl && !videoFile) { toast({ title: "File video atau URL diperlukan", variant: "destructive" }); return; }

    // Validate URL format if using direct URL mode
    if (useDirectUrl && videoUrl) {
      try { new URL(videoUrl); } catch {
        toast({ title: "URL video tidak valid", description: "Masukkan URL lengkap (dimulai dengan https://)", variant: "destructive" });
        return;
      }
    }
    if (thumbnailUrl) {
      try { new URL(thumbnailUrl); } catch {
        toast({ title: "URL thumbnail tidak valid", description: "Masukkan URL lengkap (dimulai dengan https://)", variant: "destructive" });
        return;
      }
    }

    setStep("uploading");
    setProgress(5);

    try {
      let finalVideoUrl = videoUrl;
      let finalThumbnailUrl = thumbnailUrl;

      const hasVideo = !!(videoFile && !useDirectUrl);
      const hasThumb = !!thumbnailFile;

      if (hasVideo) {
        finalVideoUrl = await uploadFile(videoFile!, (pct) => {
          const weight = hasThumb ? 0.8 : 0.95;
          setProgress(Math.round(pct * weight));
        });
      }

      if (hasThumb) {
        const startPct = hasVideo ? 80 : 5;
        const weight = hasVideo ? 0.15 : 0.90;
        finalThumbnailUrl = await uploadFile(thumbnailFile!, (pct) => {
          setProgress(startPct + Math.round(pct * weight));
        });
      }

      const created = await createVideo.mutateAsync({
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          videoUrl: finalVideoUrl,
          thumbnailUrl: finalThumbnailUrl || undefined,
          duration: duration > 0 ? duration : 0,
          genre: genre || undefined,
          isPublic,
          isPremium,
          minimumPlan: minimumPlan || undefined,
        },
      });

      setProgress(100);
      setUploadedVideoId((created as any)?.id ?? null);
      setStep("done");
    } catch (err: any) {
      console.error("Upload error details:", err);
      let msg = "Terjadi kesalahan. Coba lagi.";
      if (err && typeof err === "object") {
        if (err.data && typeof err.data === "object" && err.data.error) {
          msg = err.data.error;
        } else if (err.message) {
          msg = err.message;
        }
      }
      setErrorMessage(msg);
      setStep("error");
    }
  };

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="text-center py-36">
          <Film className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Masuk untuk Upload</h2>
          <p className="text-muted-foreground mb-6">Bagikan konten video terbaikmu ke seluruh Indonesia</p>
          <Link href="/sign-in">
            <Button className="bg-blue-600 hover:bg-blue-700">Masuk Sekarang</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="pt-24 max-w-2xl mx-auto px-6 pb-16">
        {step === "uploading" && (
          <div className="text-center py-24 space-y-6">
            <div className="w-16 h-16 rounded-full bg-blue-600/20 flex items-center justify-center mx-auto animate-pulse">
              <UploadIcon className="w-8 h-8 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-2">Mengupload video...</h2>
              <p className="text-muted-foreground text-sm">Mohon tunggu, jangan tutup halaman ini</p>
            </div>
            <Progress value={progress} className="max-w-sm mx-auto bg-muted" />
            <p className="text-muted-foreground text-sm">{progress}%</p>
          </div>
        )}

        {step === "done" && (
          <div className="text-center py-24 space-y-4">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Video Berhasil Diupload!</h2>
            <p className="text-muted-foreground">Videomu kini tersedia di Sineas dan bisa ditonton oleh semua orang.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 mt-6">
              {uploadedVideoId && (
                <Button
                  onClick={() => setLocation(`/watch/${uploadedVideoId}`)}
                  className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold gap-2"
                >
                  <Play className="w-4 h-4 fill-black" />
                  Tonton Video Sekarang
                </Button>
              )}
              <Button
                onClick={() => {
                  if (user?.id) {
                    setLocation(`/creator/${encodeURIComponent(user.id)}?tab=dashboard`);
                  } else {
                    setLocation("/");
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Lihat Dashboard
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setStep("form");
                  setTitle(""); setDescription(""); setVideoUrl("");
                  setThumbnailUrl(""); setVideoFile(null); setThumbnailFile(null);
                  setProgress(0); setUploadedVideoId(null);
                }}
                className="border-border text-muted-foreground"
              >
                Upload Video Lain
              </Button>
            </div>
          </div>
        )}

        {step === "error" && (
          <div className="text-center py-24 space-y-4">
            <AlertCircle className="w-16 h-16 text-yellow-400 mx-auto" />
            <h2 className="text-2xl font-bold text-yellow-400">Upload Gagal</h2>
            <p className="text-muted-foreground">{errorMessage || "Terjadi kesalahan. Coba lagi."}</p>
            <Button onClick={() => setStep("form")} className="bg-blue-600 hover:bg-blue-700">Coba Lagi</Button>
          </div>
        )}

        {step === "form" && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h1 className="text-3xl font-black mb-1">Upload Video</h1>
              <p className="text-muted-foreground text-sm">Bagikan konten terbaikmu</p>
              {me?.displayName && (
                <p className="text-xs text-muted-foreground mt-1">
                  Akan diposting sebagai: <span className="font-medium text-foreground">{me.displayName}</span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title" className="text-muted-foreground">Judul <span className="text-yellow-400">*</span></Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul video yang menarik" className="bg-card border-border text-foreground" required />
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Deskripsi</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ceritakan tentang videomu..." rows={3} className="bg-card border-border text-foreground resize-none" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Label className="text-muted-foreground">Sumber Video <span className="text-yellow-400">*</span></Label>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-muted-foreground">URL Langsung</span>
                  <Switch checked={useDirectUrl} onCheckedChange={setUseDirectUrl} />
                </div>
              </div>

              {useDirectUrl ? (
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://example.com/video.mp4" className="pl-9 bg-card border-border text-foreground" />
                </div>
              ) : (
                <div
                  onClick={() => videoInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${videoFile ? "border-yellow-400/50 bg-yellow-400/10" : "border-border hover:border-border"}`}
                >
                  <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => handleVideoFile(e.target.files?.[0] ?? null)} />
                  <Film className={`w-8 h-8 mx-auto mb-2 ${videoFile ? "text-yellow-400" : "text-muted-foreground"}`} />
                  {videoFile ? (
                    <div>
                      <p className="text-sm font-medium text-foreground">{videoFile.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{(videoFile.size / 1024 / 1024).toFixed(1)} MB{duration > 0 && ` · ${Math.floor(duration / 60)}m ${duration % 60}s`}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-muted-foreground">Klik untuk pilih file video</p>
                      <p className="text-xs text-muted-foreground mt-1">MP4, WebM, MOV — maks 5GB</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Thumbnail</Label>
              <div className="flex gap-3">
                <div
                  onClick={() => thumbInputRef.current?.click()}
                  className={`flex-1 border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${thumbnailFile ? "border-yellow-400/50" : "border-border hover:border-border"}`}
                >
                  <input ref={thumbInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleThumbnailFile(e.target.files?.[0] ?? null)} />
                  <Image className={`w-5 h-5 mx-auto mb-1 ${thumbnailFile ? "text-yellow-400" : "text-muted-foreground"}`} />
                  <p className="text-xs text-muted-foreground">{thumbnailFile ? thumbnailFile.name : "Upload gambar"}</p>
                </div>
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} placeholder="atau URL thumbnail" className="pl-9 bg-card border-border text-foreground h-full" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Genre</Label>
              <Select value={genre} onValueChange={setGenre}>
                <SelectTrigger className="bg-card border-border text-foreground">
                  <SelectValue placeholder="Pilih genre" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {GENRES.map((g) => (
                    <SelectItem key={g} value={g} className="text-foreground hover:bg-muted">{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card rounded-xl p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-muted-foreground text-sm">Publik</Label>
                  <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                </div>
                <p className="text-xs text-muted-foreground">Video dapat dilihat semua orang</p>
              </div>
              <div className="bg-card rounded-xl p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-muted-foreground text-sm">Premium</Label>
                  <Switch checked={isPremium} onCheckedChange={setIsPremium} />
                </div>
                <p className="text-xs text-muted-foreground">Hanya untuk pelanggan</p>
              </div>
            </div>

            {isPremium && (
              <div className="space-y-3">
                <Label className="text-muted-foreground text-sm">Minimum Paket</Label>
                <Select value={minimumPlan} onValueChange={setMinimumPlan}>
                  <SelectTrigger className="bg-card border-border text-foreground">
                    <SelectValue placeholder="Pilih minimum paket" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {["basic", "premium", "ultra"].map((p) => (
                      <SelectItem key={p} value={p} className="text-foreground hover:bg-muted capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Follower/Subscription Requirements Panel */}
                {minimumPlan && (() => {
                  const thresholds: Record<string, number> = { basic: 100, premium: 500, ultra: 1000 };
                  const labels: Record<string, string> = { basic: "Basic", premium: "Premium", ultra: "Ultra" };
                  const required = thresholds[minimumPlan] ?? 0;
                  const currentFollowers = (followData as any)?.followerCount ?? 0;
                  const planTierRank: Record<string, number> = { basic: 1, premium: 2, ultra: 3 };
                  const userPlan = subStatus?.plan ?? "";
                  const hasSubscription = subStatus?.isSubscribed && (planTierRank[userPlan] ?? 0) >= (planTierRank[minimumPlan] ?? 0);
                  const hasFollowers = currentFollowers >= required;
                  const isEligible = hasSubscription || hasFollowers;

                  return (
                    <div className={`rounded-xl border p-4 text-sm space-y-3 ${
                      isEligible ? "bg-emerald-500/5 border-emerald-500/20" : "bg-amber-500/5 border-amber-500/20"
                    }`}>
                      <div className="flex items-center gap-2">
                        <Info className={`w-4 h-4 flex-shrink-0 ${isEligible ? "text-emerald-400" : "text-amber-400"}`} />
                        <span className={`font-semibold ${isEligible ? "text-emerald-300" : "text-amber-300"}`}>
                          {isEligible ? "✓ Kamu memenuhi syarat" : "⚠ Syarat diperlukan"}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {/* Subscription check */}
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Crown className="w-3.5 h-3.5" />
                            Langganan {labels[minimumPlan]}
                          </span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            hasSubscription ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"
                          }`}>
                            {hasSubscription ? "✓ Aktif" : subStatus?.isSubscribed ? `Paket ${subStatus.plan}` : "Belum berlangganan"}
                          </span>
                        </div>
                        {/* Follower count check */}
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Users className="w-3.5 h-3.5" />
                            Min. {required.toLocaleString("id-ID")} followers
                          </span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            hasFollowers ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                          }`}>
                            {currentFollowers.toLocaleString("id-ID")} followers
                          </span>
                        </div>
                      </div>
                      {!isEligible && (
                        <p className="text-xs text-muted-foreground">
                          Kamu perlu salah satu syarat di atas untuk upload dengan paket {labels[minimumPlan]}.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 text-base gap-2" disabled={createVideo.isPending}>
              <UploadIcon className="w-4 h-4" />
              Upload Video
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

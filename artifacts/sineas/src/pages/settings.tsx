import { useGetMe, useUpdateMe } from "@workspace/api-client-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth, useUser, UserProfile } from "@clerk/react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { User, Lock, Bell, Loader2, Check } from "lucide-react";
import { Link } from "wouter";

export default function SettingsPage() {
  const { user: clerkUser } = useUser();
  const { isSignedIn } = useAuth();
  const { toast } = useToast();
  const { data: dbUser, refetch } = useGetMe();
  const updateUser = useUpdateMe();

  const [activeTab, setActiveTab] = useState<"profile" | "security" | "notifications">("profile");

  // Tab 1 state
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Tab 3 state (Notification Preferences)
  const [emailNewVideo, setEmailNewVideo] = useState(true);
  const [emailNewComment, setEmailNewComment] = useState(true);
  const [emailNewLike, setEmailNewLike] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Populate profile fields once data is available
  useEffect(() => {
    if (dbUser) {
      setDisplayName(dbUser.displayName || "");
      setBio(dbUser.bio || "");
      setUsername(dbUser.username || clerkUser?.username || "");
    }
  }, [dbUser, clerkUser]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);

    try {
      // Update Database display name, username, and bio
      await updateUser.mutateAsync({
        data: {
          displayName: displayName.trim() || undefined,
          username: username.trim() || undefined,
          bio: bio.trim() || undefined,
        },
      });

      toast({ title: "Profil berhasil diperbarui!" });
      refetch();
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Gagal memperbarui profil",
        description: err.message || "Pastikan username unik dan tidak mengandung karakter khusus.",
        variant: "destructive",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPrefs(true);
    setTimeout(() => {
      setSavingPrefs(false);
      toast({ title: "Preferensi notifikasi berhasil disimpan!" });
    }, 600);
  };

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center py-36">
          <h2 className="text-2xl font-bold mb-4">Masuk untuk Mengakses Pengaturan</h2>
          <Link href="/sign-in">
            <Button className="bg-blue-600 hover:bg-blue-700">Masuk</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-6 pt-24 pb-16">
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-foreground">Pengaturan Akun</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Kelola profil channel, keamanan akun, dan preferensi notifikasi Anda.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Left Sidebar Navigation */}
          <div className="md:col-span-1 flex flex-col gap-1">
            <button
              onClick={() => setActiveTab("profile")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${
                activeTab === "profile"
                  ? "bg-primary text-white shadow-lg shadow-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-card"
              }`}
            >
              <User className="w-4 h-4" />
              <span>Profil & Channel</span>
            </button>
            
            <button
              onClick={() => setActiveTab("security")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${
                activeTab === "security"
                  ? "bg-primary text-white shadow-lg shadow-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-card"
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>Keamanan Akun</span>
            </button>

            <button
              onClick={() => setActiveTab("notifications")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${
                activeTab === "notifications"
                  ? "bg-primary text-white shadow-lg shadow-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-card"
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>Preferensi Notifikasi</span>
            </button>
          </div>

          {/* Main Content Area */}
          <div className="md:col-span-3">
            {activeTab === "profile" && (
              <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm">
                <h2 className="text-xl font-bold mb-6 text-foreground">Profil & Channel Publik</h2>
                <form onSubmit={handleSaveProfile} className="space-y-6">
                  <div>
                    <Label htmlFor="displayName" className="text-foreground font-semibold">Nama Channel</Label>
                    <Input
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Nama channel Anda"
                      required
                      className="bg-background border-border text-foreground mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Nama publik yang akan muncul pada channel dan video Anda.</p>
                  </div>

                  <div>
                    <Label htmlFor="username" className="text-foreground font-semibold">Username</Label>
                    <div className="relative mt-2">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                      <Input
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                        placeholder="username"
                        required
                        className="bg-background border-border text-foreground pl-8"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Username unik untuk URL profil channel Anda.</p>
                  </div>

                  <div>
                    <Label htmlFor="bio" className="text-foreground font-semibold">Deskripsi / Bio Channel</Label>
                    <Textarea
                      id="bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Ceritakan tentang channel Anda..."
                      rows={4}
                      className="bg-background border-border text-foreground mt-2 resize-none"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Tulis deskripsi singkat mengenai konten yang Anda bagikan.</p>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={savingProfile}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 rounded-xl flex items-center gap-2"
                    >
                      {savingProfile ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Simpan Perubahan</span>
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === "security" && (
              <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-sm overflow-x-auto">
                <h2 className="text-xl font-bold mb-6 text-foreground px-2">Keamanan & Sesi Akun</h2>
                <div className="clerk-user-profile-settings">
                  <UserProfile
                    routing="hash"
                    appearance={{
                      layout: {
                        unsafe_disableDevelopmentModeWarnings: true,
                      },
                      elements: {
                        rootBox: "w-full",
                        cardBox: "w-full shadow-none border-none bg-transparent p-0",
                      },
                      variables: {
                        colorPrimary: "hsl(221, 83%, 53%)",
                        colorBackground: "transparent",
                        colorInputBackground: "hsl(222, 30%, 17%)",
                        colorInput: "hsl(222, 30%, 17%)",
                        colorText: "white",
                        colorForeground: "white",
                        colorTextSecondary: "rgba(255, 255, 255, 0.8)",
                        colorMutedForeground: "rgba(255, 255, 255, 0.8)",
                        colorTextOnPrimaryBackground: "white",
                        colorPrimaryForeground: "white",
                        colorInputText: "white",
                        colorInputForeground: "white",
                      },
                    }}
                  />
                </div>
              </div>
            )}

            {activeTab === "notifications" && (
              <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm">
                <h2 className="text-xl font-bold mb-6 text-foreground">Preferensi & Notifikasi</h2>
                <form onSubmit={handleSavePreferences} className="space-y-6">
                  <p className="text-sm text-muted-foreground mb-4">
                    Pilih kapan Anda ingin menerima pemberitahuan email dari Sineas.
                  </p>

                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="newVideo"
                        checked={emailNewVideo}
                        onChange={(e) => setEmailNewVideo(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded border-border text-primary bg-background focus:ring-primary"
                      />
                      <div className="grid gap-1.5 leading-none">
                        <Label htmlFor="newVideo" className="text-sm font-semibold text-foreground cursor-pointer">
                          Video Baru
                        </Label>
                        <p className="text-xs text-muted-foreground">Kirim email ketika ada video baru dari channel yang Anda ikuti.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="newComment"
                        checked={emailNewComment}
                        onChange={(e) => setEmailNewComment(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded border-border text-primary bg-background focus:ring-primary"
                      />
                      <div className="grid gap-1.5 leading-none">
                        <Label htmlFor="newComment" className="text-sm font-semibold text-foreground cursor-pointer">
                          Komentar Baru
                        </Label>
                        <p className="text-xs text-muted-foreground">Beri tahu saya jika seseorang mengomentari video saya.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="newLike"
                        checked={emailNewLike}
                        onChange={(e) => setEmailNewLike(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded border-border text-primary bg-background focus:ring-primary"
                      />
                      <div className="grid gap-1.5 leading-none">
                        <Label htmlFor="newLike" className="text-sm font-semibold text-foreground cursor-pointer">
                          Interaksi Like
                        </Label>
                        <p className="text-xs text-muted-foreground">Beri tahu saya ketika seseorang menyukai video saya.</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={savingPrefs}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 rounded-xl flex items-center gap-2"
                    >
                      {savingPrefs ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Simpan Preferensi</span>
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

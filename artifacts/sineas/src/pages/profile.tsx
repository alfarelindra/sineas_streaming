import { useGetMe, useUpdateMe, useGetWatchlist, useGetSubscriptionStatus } from "@workspace/api-client-react";
import Navbar from "@/components/Navbar";
import VideoCard from "@/components/VideoCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth, UserButton, useUser } from "@clerk/react";
import { Link } from "wouter";
import { Crown, Bookmark, Check, Edit3 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Profile() {
  const { user: clerkUser } = useUser();
  const { isSignedIn } = useAuth();
  const { toast } = useToast();
  const { data: dbUser, refetch } = useGetMe();
  const { data: watchlist } = useGetWatchlist();
  const { data: subStatus } = useGetSubscriptionStatus();
  const updateUser = useUpdateMe();

  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");

  const startEdit = () => {
    setDisplayName(dbUser?.displayName ?? clerkUser?.fullName ?? "");
    setBio(dbUser?.bio ?? "");
    setEditing(true);
  };

  const saveEdit = () => {
    updateUser.mutate(
      { data: { displayName: displayName.trim() || undefined, bio: bio.trim() || undefined } },
      {
        onSuccess: () => { toast({ title: "Profil diperbarui" }); setEditing(false); refetch(); },
        onError: () => toast({ title: "Gagal memperbarui", variant: "destructive" }),
      }
    );
  };

  const planBadge: Record<string, { label: string; color: string }> = {
    basic: { label: "Basic", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    premium: { label: "Premium", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
    ultra: { label: "Ultra", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  };

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white">
        <Navbar />
        <div className="text-center py-36">
          <h2 className="text-2xl font-bold mb-4">Masuk untuk Melihat Profil</h2>
          <Link href="/sign-in"><Button className="bg-red-600 hover:bg-red-700">Masuk</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      <Navbar />
      <div className="pt-24 max-w-4xl mx-auto px-6 pb-16">
        <div className="flex flex-col sm:flex-row items-start gap-6 mb-10">
          <Avatar className="w-20 h-20">
            <AvatarFallback className="bg-red-600 text-white text-2xl font-bold">
              {(dbUser?.displayName ?? clerkUser?.firstName ?? "U")[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-3 max-w-sm">
                <div>
                  <Label className="text-gray-400 text-xs">Nama Tampilan</Label>
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="bg-gray-900 border-gray-700 text-white mt-1" />
                </div>
                <div>
                  <Label className="text-gray-400 text-xs">Bio</Label>
                  <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} className="bg-gray-900 border-gray-700 text-white mt-1 resize-none" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveEdit} disabled={updateUser.isPending} className="bg-red-600 hover:bg-red-700 gap-1">
                    <Check className="w-3 h-3" /> Simpan
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="border-gray-700 text-gray-400">Batal</Button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-black text-white">
                    {dbUser?.displayName ?? clerkUser?.fullName ?? "Pengguna Sineas"}
                  </h1>
                  {subStatus?.isSubscribed && subStatus.plan && (
                    <Badge className={`text-xs ${planBadge[subStatus.plan]?.color ?? "bg-gray-500/20 text-gray-400"}`}>
                      <Crown className="w-3 h-3 mr-1" />
                      {planBadge[subStatus.plan]?.label ?? subStatus.plan}
                    </Badge>
                  )}
                </div>
                {dbUser?.bio && <p className="text-gray-400 text-sm mt-1 max-w-md">{dbUser.bio}</p>}
                <p className="text-gray-600 text-xs mt-1">{clerkUser?.primaryEmailAddress?.emailAddress}</p>
                <Button size="sm" variant="outline" onClick={startEdit} className="mt-3 border-gray-700 text-gray-400 hover:text-white gap-1">
                  <Edit3 className="w-3 h-3" /> Edit Profil
                </Button>
              </div>
            )}
          </div>

          <div className="flex-shrink-0"><UserButton /></div>
        </div>

        <Tabs defaultValue="watchlist">
          <TabsList className="bg-gray-900 border border-gray-800 mb-6">
            <TabsTrigger value="watchlist" className="data-[state=active]:bg-gray-800 data-[state=active]:text-white text-gray-400 gap-2">
              <Bookmark className="w-4 h-4" /> Daftar Tonton
            </TabsTrigger>
            <TabsTrigger value="subscription" className="data-[state=active]:bg-gray-800 data-[state=active]:text-white text-gray-400 gap-2">
              <Crown className="w-4 h-4" /> Langganan
            </TabsTrigger>
          </TabsList>

          <TabsContent value="watchlist">
            {(watchlist ?? []).length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <Bookmark className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Daftar tontonmu masih kosong</p>
                <Link href="/browse"><Button size="sm" className="mt-3 bg-red-600 hover:bg-red-700">Jelajahi Video</Button></Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {(watchlist ?? []).map((v: any) => <VideoCard key={v.id} video={v} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="subscription">
            <div className="max-w-md">
              {subStatus?.isSubscribed ? (
                <div className="bg-gray-900 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/20 rounded-xl">
                      <Crown className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white capitalize">Paket {subStatus.plan}</h3>
                      <p className="text-xs text-gray-500 capitalize">{subStatus.status}</p>
                    </div>
                  </div>
                  {subStatus.currentPeriodEnd && (
                    <p className="text-sm text-gray-400">
                      Aktif hingga{" "}
                      <span className="text-white">
                        {new Date(subStatus.currentPeriodEnd).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })}
                      </span>
                    </p>
                  )}
                  {subStatus.cancelAtPeriodEnd && <p className="text-xs text-amber-400">Akan dibatalkan di akhir periode</p>}
                </div>
              ) : (
                <div className="bg-gray-900 rounded-2xl p-6 text-center space-y-4">
                  <Crown className="w-10 h-10 text-gray-600 mx-auto" />
                  <p className="text-gray-400">Belum berlangganan</p>
                  <Link href="/subscription"><Button className="bg-red-600 hover:bg-red-700">Lihat Paket</Button></Link>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

import { useGetPlatformStats, useListVideos } from "@workspace/api-client-react";
import Navbar from "@/components/Navbar";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Eye, ThumbsUp, Upload, TrendingUp, Film, Users, BarChart3, Play } from "lucide-react";
import { useState } from "react";

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

function formatNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}rb`;
  return String(n);
}

export default function Dashboard() {
  const { isSignedIn } = useAuth();
  const { data: stats } = useGetPlatformStats();
  const { data: myVideosData } = useListVideos({ limit: 50 });

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="pt-36 text-center">
          <h2 className="text-2xl font-bold mb-4">Masuk untuk melihat dashboard</h2>
          <Link href="/sign-in"><Button className="bg-blue-600 hover:bg-blue-700">Masuk</Button></Link>
        </div>
      </div>
    );
  }

  const myVideos = myVideosData?.videos ?? [];
  const totalViews = myVideos.reduce((s, v: any) => s + (v.viewCount ?? 0), 0);
  const totalLikes = myVideos.reduce((s, v: any) => s + (v.likeCount ?? 0), 0);

  const genreData = (stats?.videosByGenre ?? [])
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 6);
  const maxGenreCount = Math.max(...genreData.map((g: any) => g.count), 1);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="pt-24 max-w-5xl mx-auto px-6 pb-16">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black">Creator Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">Statistik platform & performa videomu</p>
          </div>
          <Link href="/upload">
            <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Upload className="w-4 h-4" /> Upload Video
            </Button>
          </Link>
        </div>

        {/* Platform-wide stats */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Platform Sineas</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatCard icon={<Film className="w-5 h-5 text-blue-400" />} label="Total Video" value={formatNum(stats?.totalVideos ?? 0)} color="bg-blue-500/20" />
            <StatCard icon={<Eye className="w-5 h-5 text-green-400" />} label="Total Tayangan" value={formatNum(stats?.totalViews ?? 0)} color="bg-green-500/20" />
            <StatCard icon={<Users className="w-5 h-5 text-purple-400" />} label="Total Pengguna" value={formatNum(stats?.totalUsers ?? 0)} color="bg-purple-500/20" />
          </div>
        </div>

        {/* My video stats */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Videomu</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatCard icon={<Play className="w-5 h-5 text-yellow-400" />} label="Video Diupload" value={myVideos.length} color="bg-yellow-400/20" />
            <StatCard icon={<Eye className="w-5 h-5 text-amber-400" />} label="Total Tayangan" value={formatNum(totalViews)} color="bg-amber-500/20" />
            <StatCard icon={<ThumbsUp className="w-5 h-5 text-pink-400" />} label="Total Like" value={formatNum(totalLikes)} color="bg-pink-500/20" />
          </div>
        </div>

        {/* Genre breakdown */}
        {genreData.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">
              <BarChart3 className="w-4 h-4 inline mr-1" />
              Video per Genre
            </h2>
            <div className="bg-card/60 border border-border rounded-2xl p-6 space-y-4">
              {genreData.map((g: any) => (
                <div key={g.genre} className="flex items-center gap-3">
                  <span className="w-24 text-sm text-muted-foreground flex-shrink-0">{g.genre}</span>
                  <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-yellow-400 rounded-full transition-all duration-700"
                      style={{ width: `${(g.count / maxGenreCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-sm text-muted-foreground text-right">{g.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My videos table */}
        {myVideos.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">
              <TrendingUp className="w-4 h-4 inline mr-1" />
              Performa Video
            </h2>
            <div className="bg-card/60 border border-border rounded-2xl overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-border text-xs text-muted-foreground font-medium uppercase tracking-wider">
                <span>Judul</span>
                <span className="text-right">Tayangan</span>
                <span className="text-right">Like</span>
                <span className="text-right">Genre</span>
              </div>
              {myVideos.slice(0, 10).map((v: any) => (
                <Link key={v.id} href={`/watch/${v.id}`}>
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-border hover:bg-accent transition-colors items-center">
                    <div className="flex items-center gap-3 min-w-0">
                      {v.thumbnailUrl ? (
                        <img src={v.thumbnailUrl} className="w-12 h-8 object-cover rounded flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-8 bg-muted rounded flex-shrink-0 flex items-center justify-center">
                          <Play className="w-3 h-3 text-muted-foreground" />
                        </div>
                      )}
                      <span className="text-sm text-foreground truncate">{v.title}</span>
                    </div>
                    <span className="text-sm text-muted-foreground text-right">{formatNum(v.viewCount ?? 0)}</span>
                    <span className="text-sm text-muted-foreground text-right">{formatNum(v.likeCount ?? 0)}</span>
                    <span className="text-xs text-muted-foreground text-right">{v.genre ?? "—"}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {myVideos.length === 0 && (
          <div className="text-center py-16 text-muted-foreground bg-card/40 rounded-2xl">
            <Film className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Belum ada video</p>
            <p className="text-sm mt-1">Upload videomu pertama dan mulai berkarya!</p>
            <Link href="/upload"><Button className="mt-4 bg-blue-600 hover:bg-blue-700">Upload Sekarang</Button></Link>
          </div>
        )}
      </div>
    </div>
  );
}

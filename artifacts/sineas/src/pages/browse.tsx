import { useListVideos, useListGenres } from "@workspace/api-client-react";
import Navbar from "@/components/Navbar";
import VideoCard from "@/components/VideoCard";
import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Browse() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const [, setLocation] = useLocation();

  const [search, setSearch] = useState(params.get("q") ?? "");
  const [genre, setGenre] = useState(params.get("genre") ?? "");
  const [page, setPage] = useState(1);
  const limit = 24;

  useEffect(() => {
    const q = params.get("q") ?? "";
    setSearch(q);
  }, [searchString]);

  const { data: genresData } = useListGenres();
  const { data, isLoading } = useListVideos({
    search: search || undefined,
    genre: genre || undefined,
    page,
    limit,
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 1;

  const handleSearch = (q: string) => {
    setSearch(q);
    setPage(1);
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (genre) sp.set("genre", genre);
    setLocation(`/browse?${sp.toString()}`);
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      <Navbar onSearch={handleSearch} />
      <div className="pt-24 max-w-screen-2xl mx-auto px-6 sm:px-10 pb-16">
        <h1 className="text-3xl font-black mb-6">Jelajahi</h1>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-8">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch(search)}
              placeholder="Cari judul, kreator..."
              className="pl-9 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
            />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Badge
              variant={!genre ? "default" : "outline"}
              className={`cursor-pointer text-sm px-3 py-1.5 ${!genre ? "bg-blue-600 hover:bg-blue-700 border-0" : "border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"}`}
              onClick={() => { setGenre(""); setPage(1); }}
            >
              Semua
            </Badge>
            {(genresData ?? []).map((g: any) => (
              <Badge
                key={g.slug}
                variant={genre === g.name ? "default" : "outline"}
                className={`cursor-pointer text-sm px-3 py-1.5 ${genre === g.name ? "bg-blue-600 hover:bg-blue-700 border-0" : "border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"}`}
                onClick={() => { setGenre(genre === g.name ? "" : g.name); setPage(1); }}
              >
                {g.name}
                {g.videoCount > 0 && <span className="ml-1 text-xs opacity-60">({g.videoCount})</span>}
              </Badge>
            ))}
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i}>
                <div className="aspect-video bg-gray-800 rounded-lg animate-pulse" />
                <div className="mt-2 h-4 bg-gray-800 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : (data?.videos?.length ?? 0) === 0 ? (
          <div className="text-center py-24 text-gray-500">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg">Tidak ada video ditemukan</p>
            <p className="text-sm mt-1">Coba kata kunci lain atau ubah filter</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-400">{data?.total} video ditemukan</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {data?.videos?.map((v: any) => (
                <VideoCard key={v.id} video={v} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-10">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-9 h-9 rounded text-sm font-medium transition-colors ${
                      p === page
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

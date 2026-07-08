import { useListVideos } from "@workspace/api-client-react";
import Navbar from "@/components/Navbar";
import VideoCard from "@/components/VideoCard";
import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const genres = ['Semua', 'Drama', 'Aksi', 'Komedi', 'Horor', 'Dokumenter', 'Animasi', 'Thriller', 'Romantis'];

export default function Browse() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const [, setLocation] = useLocation();

  const [search, setSearch] = useState(params.get("q") ?? "");
  const [selectedGenre, setSelectedGenre] = useState(params.get("genre") || "Semua");
  const [page, setPage] = useState(1);
  const limit = 24;

  useEffect(() => {
    const q = params.get("q") ?? "";
    setSearch(q);
  }, [searchString]);

  const { data, isLoading } = useListVideos({
    search: search || undefined,
    genre: selectedGenre === "Semua" ? undefined : selectedGenre,
    page,
    limit,
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 1;

  const handleSearch = (q: string) => {
    setSearch(q);
    setPage(1);
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (selectedGenre !== "Semua") sp.set("genre", selectedGenre);
    setLocation(`/browse?${sp.toString()}`);
  };

  const handleGenreSelect = (genreName: string) => {
    setSelectedGenre(genreName);
    setPage(1);
    const sp = new URLSearchParams();
    if (search) sp.set("q", search);
    if (genreName !== "Semua") sp.set("genre", genreName);
    setLocation(`/browse?${sp.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar onSearch={handleSearch} />
      <div className="pt-24 max-w-screen-2xl mx-auto px-6 sm:px-10 pb-16">
        <h1 className="text-3xl font-black mb-6">Jelajahi</h1>

        {/* Filters */}
        <div className="flex flex-col gap-4 mb-8">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch(search)}
              placeholder="Cari judul, kreator..."
              className="pl-9 bg-card border-border text-foreground placeholder:text-muted-foreground w-full"
            />
          </div>

          {/* Genre Filter Bar */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
            {genres.map((g) => {
              const isActive = selectedGenre === g;
              return (
                <button
                  key={g}
                  onClick={() => handleGenreSelect(g)}
                  className={`cursor-pointer text-xs sm:text-sm px-4 py-2 rounded-full font-semibold transition-all shrink-0 select-none ${
                    isActive
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/10"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i}>
                <div className="aspect-video bg-muted rounded-lg animate-pulse" />
                <div className="mt-2 h-4 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : (data?.videos?.length ?? 0) === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg">Tidak ada video ditemukan</p>
            <p className="text-sm mt-1">Coba kata kunci lain atau ubah filter</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">{data?.total} video ditemukan</p>
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
                        : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
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

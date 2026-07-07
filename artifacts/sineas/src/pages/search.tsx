import { useListVideos, useListGenres } from "@workspace/api-client-react";
import Navbar from "@/components/Navbar";
import VideoCard from "@/components/VideoCard";
import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, SlidersHorizontal, TrendingUp, Clock, Eye, Film, ChevronDown, Flame } from "lucide-react";

const DURATION_FILTERS = [
  { label: "Semua Durasi", value: "" },
  { label: "< 30 menit", value: "short" },
  { label: "30–90 menit", value: "medium" },
  { label: "> 90 menit", value: "long" },
];

const TYPE_FILTERS = [
  { label: "Semua", value: "" },
  { label: "Gratis", value: "free" },
  { label: "Premium", value: "premium" },
];

const SORT_OPTIONS = [
  { label: "Relevansi", value: "relevance", icon: <Search className="w-3.5 h-3.5" /> },
  { label: "Terbaru", value: "newest", icon: <Clock className="w-3.5 h-3.5" /> },
  { label: "Terpopuler", value: "popular", icon: <Flame className="w-3.5 h-3.5" /> },
  { label: "Trending", value: "trending", icon: <TrendingUp className="w-3.5 h-3.5" /> },
];

export default function SearchPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const [, setLocation] = useLocation();

  const initialQ = params.get("q") ?? "";
  const [query, setQuery] = useState(initialQ);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQ);
  const [genre, setGenre] = useState(params.get("genre") ?? "");
  const [duration, setDuration] = useState("");
  const [contentType, setContentType] = useState("");
  const [sortBy, setSortBy] = useState("relevance");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const limit = 24;

  useEffect(() => {
    const q = params.get("q") ?? "";
    setQuery(q);
    setDebouncedQuery(q);
    setPage(1);
  }, [searchString]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const { data: genresData } = useListGenres();

  const { data, isLoading } = useListVideos({
    search: debouncedQuery || undefined,
    genre: genre || undefined,
    page,
    limit,
  });

  const allVideos = data?.videos ?? [];

  const filtered = allVideos
    .filter((v: any) => {
      if (contentType === "premium" && !v.isPremium) return false;
      if (contentType === "free" && v.isPremium) return false;
      if (!duration) return true;
      const d = v.duration ?? 0;
      if (duration === "short") return d < 30 * 60;
      if (duration === "medium") return d >= 30 * 60 && d <= 90 * 60;
      if (duration === "long") return d > 90 * 60;
      return true;
    })
    .sort((a: any, b: any) => {
      if (sortBy === "popular") return (b.viewCount ?? 0) - (a.viewCount ?? 0);
      if (sortBy === "trending") return (b.likeCount ?? 0) - (a.likeCount ?? 0);
      if (sortBy === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return 0;
    });

  const totalPages = data ? Math.ceil(data.total / limit) : 1;

  const handleSearch = (q: string) => {
    setQuery(q);
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (genre) sp.set("genre", genre);
    setLocation(`/search?${sp.toString()}`);
  };

  const clearQuery = () => {
    setQuery("");
    setDebouncedQuery("");
    setPage(1);
    inputRef.current?.focus();
    setLocation("/search");
  };

  const activeFilters = [genre, duration, contentType].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar onSearch={handleSearch} />

      <div className="pt-20 max-w-screen-2xl mx-auto px-4 sm:px-8 pb-16">
        {/* Search bar besar */}
        <div className="pt-8 pb-6">
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
              placeholder="Cari film, serial, kreator..."
              className="w-full bg-card border border-border focus:border-yellow-400 rounded-2xl pl-12 pr-12 py-4 text-lg text-foreground placeholder:text-muted-foreground outline-none transition-colors"
            />
            {query && (
              <button
                onClick={clearQuery}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Sort tabs */}
          <div className="flex justify-center gap-2 mt-4 flex-wrap">
            {SORT_OPTIONS.map((s) => (
              <button
                key={s.value}
                onClick={() => setSortBy(s.value)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  sortBy === s.value
                    ? "bg-blue-600 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filter row */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              showFilters || activeFilters > 0
                ? "border-yellow-400 text-yellow-400 bg-yellow-400/10"
                : "border-border text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filter
            {activeFilters > 0 && (
              <span className="bg-yellow-400 text-blue-950 text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {activeFilters}
              </span>
            )}
            <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
          </button>

          {/* Active filter chips */}
          {genre && (
            <button
              onClick={() => setGenre("")}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 hover:bg-yellow-400/30 transition-colors"
            >
              {genre} <X className="w-3 h-3" />
            </button>
          )}
          {duration && (
            <button
              onClick={() => setDuration("")}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 hover:bg-yellow-400/30 transition-colors"
            >
              {DURATION_FILTERS.find(d => d.value === duration)?.label} <X className="w-3 h-3" />
            </button>
          )}
          {contentType && (
            <button
              onClick={() => setContentType("")}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 hover:bg-yellow-400/30 transition-colors"
            >
              {contentType === "premium" ? "Premium" : "Gratis"} <X className="w-3 h-3" />
            </button>
          )}
          {activeFilters > 0 && (
            <button
              onClick={() => { setGenre(""); setDuration(""); setContentType(""); }}
              className="text-xs text-muted-foreground hover:text-yellow-400 transition-colors"
            >
              Reset semua
            </button>
          )}
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="mb-8 p-5 bg-card/60 border border-border rounded-2xl space-y-5">
            {/* Genre */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Genre</p>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={!genre ? "default" : "outline"}
                  className={`cursor-pointer px-3 py-1.5 ${!genre ? "bg-blue-600 hover:bg-blue-700 border-0" : "border-border text-muted-foreground hover:text-foreground hover:border-border"}`}
                  onClick={() => { setGenre(""); setPage(1); }}
                >
                  Semua
                </Badge>
                {(genresData ?? []).map((g: any) => (
                  <Badge
                    key={g.slug}
                    variant={genre === g.name ? "default" : "outline"}
                    className={`cursor-pointer px-3 py-1.5 ${genre === g.name ? "bg-blue-600 hover:bg-blue-700 border-0" : "border-border text-muted-foreground hover:text-foreground hover:border-border"}`}
                    onClick={() => { setGenre(genre === g.name ? "" : g.name); setPage(1); }}
                  >
                    {g.name}
                    {g.videoCount > 0 && <span className="ml-1 text-xs opacity-60">({g.videoCount})</span>}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Durasi */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Durasi</p>
              <div className="flex flex-wrap gap-2">
                {DURATION_FILTERS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDuration(d.value)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      duration === d.value
                        ? "bg-blue-600 text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tipe */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Tipe Konten</p>
              <div className="flex gap-2">
                {TYPE_FILTERS.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setContentType(t.value)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      contentType === t.value
                        ? "bg-blue-600 text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Results header */}
        {!isLoading && (
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {debouncedQuery ? (
                <>
                  <span className="text-foreground font-semibold">{filtered.length}</span>
                  {filtered.length !== data?.total && <span> dari {data?.total}</span>}
                  {" "}hasil untuk{" "}
                  <span className="text-foreground font-semibold">"{debouncedQuery}"</span>
                </>
              ) : (
                <span><span className="text-foreground font-semibold">{filtered.length}</span> video</span>
              )}
            </p>
          </div>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i}>
                <div className="aspect-video bg-muted rounded-xl animate-pulse" />
                <div className="mt-2 h-4 bg-muted rounded animate-pulse w-3/4" />
                <div className="mt-1 h-3 bg-muted rounded animate-pulse w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-32">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-6">
              <Film className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              {debouncedQuery ? `Tidak ada hasil untuk "${debouncedQuery}"` : "Tidak ada video"}
            </h2>
            <p className="text-muted-foreground text-sm mb-6">
              {debouncedQuery
                ? "Coba kata kunci lain, atau hapus beberapa filter"
                : "Coba ketik judul film atau nama kreator"}
            </p>
            {activeFilters > 0 && (
              <Button
                onClick={() => { setGenre(""); setDuration(""); setContentType(""); }}
                variant="outline"
                className="border-border text-muted-foreground hover:text-foreground hover:border-gray-400"
              >
                Hapus semua filter
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filtered.map((v: any) => (
                <VideoCard key={v.id} video={v} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && !duration && !contentType && (
              <div className="flex justify-center items-center gap-2 mt-10">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 rounded-lg text-sm bg-muted text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ← Sebelumnya
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let p: number;
                    if (totalPages <= 5) {
                      p = i + 1;
                    } else if (page <= 3) {
                      p = i + 1;
                    } else if (page >= totalPages - 2) {
                      p = totalPages - 4 + i;
                    } else {
                      p = page - 2 + i;
                    }
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                          p === page
                            ? "bg-blue-600 text-white"
                            : "bg-muted text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 rounded-lg text-sm bg-muted text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Berikutnya →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

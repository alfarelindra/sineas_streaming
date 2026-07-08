import { Link, useLocation } from "wouter";
import { useAuth, useUser, useClerk } from "@clerk/react";
import { Search, Upload, Menu, X, Sun, Moon, LayoutDashboard, Bookmark, History, Settings, LogOut, Crown } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/components/ThemeProvider";
import NotificationBell from "@/components/NotificationBell";
import Logo from "@/components/Logo";
import { socket } from "@/lib/socket";
import { useGetSubscriptionStatus } from "@workspace/api-client-react";

function SignedIn({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth();
  return isSignedIn ? <>{children}</> : null;
}
function SignedOut({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth();
  return !isSignedIn ? <>{children}</> : null;
}

interface NavbarProps {
  onSearch?: (q: string) => void;
}

export default function Navbar({ onSearch }: NavbarProps) {
  const [location, setLocation] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchVal, setSearchVal] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const { user } = useUser();
  const { isSignedIn } = useAuth();
  const { data: subStatus } = useGetSubscriptionStatus({ query: { enabled: !!isSignedIn } as any });
  const [profileOpen, setProfileOpen] = useState(false);
  const [signOutModalOpen, setSignOutModalOpen] = useState(false);
  const { openUserProfile, signOut } = useClerk();
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const [activeUsers, setActiveUsers] = useState(1);

  useEffect(() => {
    // Listen to active users broadcast
    socket.on("global-active-count", (count: number) => {
      setActiveUsers(count);
    });

    return () => {
      socket.off("global-active-count");
    };
  }, []);

  const goSearch = (q: string) => {
    setSearchOpen(false);
    if (onSearch) {
      onSearch(q);
    } else {
      setLocation(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : "/search");
    }
  };

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const navLinks = [
    { href: "/", label: "Beranda" },
    { href: "/browse", label: "Jelajahi" },
    { href: "/subscription", label: "Berlangganan" },
  ];

  const bg = scrolled
    ? theme === "dark"
      ? "bg-black/95 backdrop-blur-md shadow-lg"
      : "bg-white/95 backdrop-blur-md shadow-lg"
    : "bg-gradient-to-b from-black/80 to-transparent";

  // When the navbar sits over a dark surface (top gradient or dark theme), use light
  // controls. Only a scrolled navbar in light mode needs dark controls.
  const overDark = !scrolled || theme === "dark";
  const iconCls = overDark ? "text-gray-300 hover:text-white" : "text-gray-600 hover:text-gray-900";
  const linkActive = overDark ? "text-white" : "text-gray-900";
  const linkIdle = overDark ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900";

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${bg}`}>
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Logo href="/" size="md" />

          <div className="hidden md:flex items-center gap-6 ml-8">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm font-medium transition-colors ${
                  location === l.href ? linkActive : linkIdle
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-1 ml-auto">
            {/* Active Users Indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mr-1.5 select-none hover:scale-[1.02] transition-all">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{activeUsers} Aktif</span>
            </div>

            {searchOpen ? (
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  goSearch(searchVal);
                }}
              >
                <Input
                  autoFocus
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  placeholder="Cari film, serial..."
                  className="w-48 sm:w-64 bg-black/60 border-white/30 text-white placeholder:text-gray-500 h-8 text-sm"
                />
                <button type="button" onClick={() => setSearchOpen(false)} className={iconCls}>
                  <X className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <button onClick={() => setSearchOpen(true)} className={`${iconCls} p-2`}>
                <Search className="w-5 h-5" />
              </button>
            )}

            {/* Theme toggle */}
            <button onClick={toggle} className={`${iconCls} p-2 transition-colors`} title="Ganti tema">
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notifications */}
            <NotificationBell overDark={overDark} />

            <SignedIn>
              <Link href="/watchlist" className="hidden sm:block" title="Daftar Tonton">
                <Button size="sm" variant="ghost" className={`gap-1 ${location === "/watchlist" ? linkActive : iconCls}`}>
                  <Bookmark className={`w-4 h-4 ${location === "/watchlist" ? "fill-current" : ""}`} />
                  <span className="text-xs">Disimpan</span>
                </Button>
              </Link>
              <Link href="/history" className="hidden sm:block" title="Riwayat Tontonan">
                <Button size="sm" variant="ghost" className={`gap-1 ${location === "/history" ? linkActive : iconCls}`}>
                  <History className="w-4 h-4" />
                  <span className="text-xs">Riwayat</span>
                </Button>
              </Link>
              {user?.id && (
                <Link href={`/creator/${encodeURIComponent(user.id)}`} className="hidden sm:block">
                  <Button size="sm" variant="ghost" className={`${iconCls} gap-1`}>
                    <LayoutDashboard className="w-4 h-4" />
                    <span className="text-xs">Channel Saya</span>
                  </Button>
                </Link>
              )}
              <Link href="/upload" className="hidden sm:block">
                <Button size="sm" variant="ghost" className={`${iconCls} hidden sm:flex gap-1`}>
                  <Upload className="w-4 h-4" />
                  <span className="text-xs">Upload</span>
                </Button>
              </Link>
              <div ref={profileRef} className="relative flex items-center">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="relative w-8 h-8 rounded-full overflow-hidden border border-border focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-all active:scale-95"
                >
                  {user?.imageUrl ? (
                    <img src={user.imageUrl} alt={user.fullName || "User"} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs uppercase">
                      {user?.firstName?.slice(0, 1) || user?.emailAddresses[0]?.emailAddress?.slice(0, 1) || "U"}
                    </div>
                  )}
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-popover border border-border rounded-xl shadow-2xl z-50 overflow-hidden text-popover-foreground animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="p-4 border-b border-border flex items-center gap-3 bg-muted/20">
                      {user?.imageUrl ? (
                        <img src={user.imageUrl} alt={user.fullName || "User"} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm uppercase">
                          {user?.firstName?.slice(0, 1) || user?.emailAddresses[0]?.emailAddress?.slice(0, 1) || "U"}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm truncate">{user?.fullName || "Pengguna Sineas"}</h4>
                        <p className="text-xs text-muted-foreground truncate">{user?.primaryEmailAddress?.emailAddress}</p>
                        {subStatus?.isSubscribed && subStatus.plan && (() => {
                          const badges: Record<string, string> = {
                            ultra: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
                            premium: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
                            basic: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
                          };
                          const labels: Record<string, string> = { ultra: "Ultra", premium: "Premium", basic: "Basic" };
                          const cls = badges[subStatus.plan] ?? "bg-muted text-muted-foreground";
                          return (
                            <span className={`inline-flex items-center gap-1 mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cls}`}>
                              <Crown className="w-2.5 h-2.5" />
                              {labels[subStatus.plan] ?? subStatus.plan}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="p-1">
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          setLocation("/settings");
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent rounded-lg transition-colors text-left"
                      >
                        <Settings className="w-4 h-4 text-muted-foreground" />
                        <span>Manage account</span>
                      </button>
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          setSignOutModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-red-500/10 text-red-500 rounded-lg transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </SignedIn>

            <SignedOut>
              <Link href="/sign-in">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 h-8">
                  Masuk
                </Button>
              </Link>
            </SignedOut>

            <button
              className={`md:hidden ${iconCls} p-2`}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-background/98 backdrop-blur-md pb-4 pt-2 border-t border-border">
            {navLinks.map((l) => (
              <Link key={l.href} href={l.href} className="block px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" onClick={() => setMenuOpen(false)}>
                {l.label}
              </Link>
            ))}
            <SignedIn>
              <Link href="/watchlist" className="block px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" onClick={() => setMenuOpen(false)}>Daftar Tonton</Link>
              <Link href="/history" className="block px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" onClick={() => setMenuOpen(false)}>Riwayat Tontonan</Link>
              {user?.id && (
                <Link href={`/creator/${encodeURIComponent(user.id)}`} className="block px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" onClick={() => setMenuOpen(false)}>
                  Channel Saya
                </Link>
              )}
              <Link href="/upload" className="block px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" onClick={() => setMenuOpen(false)}>Upload Video</Link>
            </SignedIn>
          </div>
        )}
        {signOutModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-popover border border-border rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center animate-in zoom-in-95 duration-200">
              <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <LogOut className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Konfirmasi Keluar</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Apakah Anda yakin ingin keluar dari Sineas?
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => setSignOutModalOpen(false)}
                  className="flex-1 bg-transparent border-border hover:bg-accent text-foreground text-sm font-medium h-10 px-4 rounded-xl transition-all active:scale-98"
                >
                  Tidak
                </Button>
                <Button
                  onClick={() => {
                    setSignOutModalOpen(false);
                    signOut();
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium h-10 px-4 rounded-xl transition-all active:scale-98"
                >
                  Ya, Yakin
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

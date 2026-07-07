import { Link, useLocation } from "wouter";
import { useAuth, UserButton } from "@clerk/react";
import { Search, Upload, Menu, X, Sun, Moon, LayoutDashboard, Bookmark, History } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/components/ThemeProvider";
import NotificationBell from "@/components/NotificationBell";
import Logo from "@/components/Logo";

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
              <Link href="/dashboard" className="hidden sm:block">
                <Button size="sm" variant="ghost" className={`${iconCls} gap-1`}>
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="text-xs">Dashboard</span>
                </Button>
              </Link>
              <Link href="/upload">
                <Button size="sm" variant="ghost" className={`${iconCls} hidden sm:flex gap-1`}>
                  <Upload className="w-4 h-4" />
                  <span className="text-xs">Upload</span>
                </Button>
              </Link>
              <UserButton appearance={{ variables: { colorPrimary: "hsl(221, 83%, 53%)" } }} />
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
          <div className="md:hidden bg-black/95 pb-4 pt-2 border-t border-white/10">
            {navLinks.map((l) => (
              <Link key={l.href} href={l.href} className="block px-4 py-2 text-sm text-gray-300 hover:text-white" onClick={() => setMenuOpen(false)}>
                {l.label}
              </Link>
            ))}
            <SignedIn>
              <Link href="/watchlist" className="block px-4 py-2 text-sm text-gray-300 hover:text-white" onClick={() => setMenuOpen(false)}>Daftar Tonton</Link>
              <Link href="/history" className="block px-4 py-2 text-sm text-gray-300 hover:text-white" onClick={() => setMenuOpen(false)}>Riwayat Tontonan</Link>
              <Link href="/dashboard" className="block px-4 py-2 text-sm text-gray-300 hover:text-white" onClick={() => setMenuOpen(false)}>Dashboard</Link>
              <Link href="/upload" className="block px-4 py-2 text-sm text-gray-300 hover:text-white" onClick={() => setMenuOpen(false)}>Upload Video</Link>
            </SignedIn>
          </div>
        )}
      </div>
    </nav>
  );
}

import { Link, useLocation } from "wouter";
import { useAuth, UserButton } from "@clerk/react";
import { Search, Upload, Menu, X, Film } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const [location] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchVal, setSearchVal] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

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

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-black/95 backdrop-blur-md shadow-lg" : "bg-gradient-to-b from-black/80 to-transparent"
      }`}
    >
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <Film className="w-7 h-7 text-red-500" />
            <span className="text-2xl font-black tracking-tight text-white">SINEAS</span>
          </Link>

          <div className="hidden md:flex items-center gap-6 ml-8">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm font-medium transition-colors ${
                  location === l.href ? "text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {searchOpen ? (
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  onSearch?.(searchVal);
                  setSearchOpen(false);
                }}
              >
                <Input
                  autoFocus
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  placeholder="Cari film, serial..."
                  className="w-48 sm:w-64 bg-black/60 border-white/30 text-white placeholder:text-gray-500 h-8 text-sm"
                />
                <button type="button" onClick={() => setSearchOpen(false)} className="text-gray-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <button onClick={() => setSearchOpen(true)} className="text-gray-300 hover:text-white p-2">
                <Search className="w-5 h-5" />
              </button>
            )}

            <SignedIn>
              <Link href="/upload">
                <Button size="sm" variant="ghost" className="text-gray-300 hover:text-white hidden sm:flex gap-1">
                  <Upload className="w-4 h-4" />
                  <span className="text-xs">Upload</span>
                </Button>
              </Link>
              <UserButton appearance={{ variables: { colorPrimary: "#e11d48" } }} />
            </SignedIn>

            <SignedOut>
              <Link href="/sign-in">
                <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 h-8">
                  Masuk
                </Button>
              </Link>
            </SignedOut>

            <button
              className="md:hidden text-gray-300 hover:text-white p-2"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-black/95 pb-4 pt-2 border-t border-white/10">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="block px-4 py-2 text-sm text-gray-300 hover:text-white"
                onClick={() => setMenuOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            <SignedIn>
              <Link
                href="/upload"
                className="block px-4 py-2 text-sm text-gray-300 hover:text-white"
                onClick={() => setMenuOpen(false)}
              >
                Upload Video
              </Link>
            </SignedIn>
          </div>
        )}
      </div>
    </nav>
  );
}

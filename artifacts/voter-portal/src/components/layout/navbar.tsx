import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { MoreVertical, X } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
}

interface NavbarProps {
  title?: string;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  menuItems?: NavItem[];
}

const HIDE_DELAY_MS = 3000;

export function Navbar({ title, leftContent, rightContent, menuItems = [] }: NavbarProps) {
  const [visible, setVisible] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const lastScrollY = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const showNav = useCallback(() => {
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), HIDE_DELAY_MS);
  }, []);

  const hideNav = useCallback(() => {
    setVisible(false);
    setMenuOpen(false);
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  useEffect(() => {
    hideTimer.current = setTimeout(() => setVisible(false), HIDE_DELAY_MS);
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      if (currentY < lastScrollY.current - 5) {
        showNav();
      } else if (currentY > lastScrollY.current + 10) {
        hideNav();
      }
      lastScrollY.current = currentY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (e.clientY < 80) showNav();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousemove", onMouseMove);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [showNav, hideNav]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <>
      {/* Main navbar */}
      <header
        className={`border-b bg-card py-4 px-6 flex justify-between items-center shadow-sm sticky top-0 z-40 transition-transform duration-300 ${
          visible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="flex items-center gap-3">
          {leftContent ?? (
            <>
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">
                BD
              </div>
              {title && <h1 className="text-xl font-bold text-foreground font-bengali">{title}</h1>}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {rightContent}
        </div>
      </header>

      {/* Floating 3-dot button — ALWAYS visible, fixed top-right */}
      <div className="fixed top-3 right-4 z-50" ref={menuRef}>
        <button
          onClick={() => {
            if (!menuOpen) {
              showNav();
            }
            setMenuOpen((prev) => !prev);
          }}
          className={`w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
            visible
              ? "bg-primary/20 text-primary hover:bg-primary/30"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
          aria-label="Navigation menu"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <MoreVertical className="w-5 h-5" />}
        </button>

        {/* Dropdown */}
        {menuOpen && (
          <div className="absolute right-0 mt-2 w-52 bg-card border rounded-xl shadow-xl overflow-hidden">
            {menuItems.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
                <div className="px-4 py-3 text-sm font-bengali hover:bg-muted cursor-pointer transition-colors border-b last:border-0">
                  {item.label}
                </div>
              </Link>
            ))}
            {rightContent && (
              <div className="px-3 py-3 border-t" onClick={() => setMenuOpen(false)}>
                {rightContent}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

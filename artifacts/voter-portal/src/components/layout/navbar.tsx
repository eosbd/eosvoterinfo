import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { MoreVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";

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

export function Navbar({ title, leftContent, rightContent, menuItems = [] }: NavbarProps) {
  const [visible, setVisible] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const lastScrollY = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      if (currentY < 60) {
        setVisible(true);
      } else if (currentY > lastScrollY.current + 10) {
        setVisible(false);
        setMenuOpen(false);
      } else if (currentY < lastScrollY.current - 5) {
        setVisible(true);
      }
      lastScrollY.current = currentY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
        className={`border-b bg-card py-4 px-6 flex justify-between items-center shadow-sm sticky top-0 z-50 transition-transform duration-300 ${
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

      {/* Floating 3-dot button — visible only when navbar is hidden */}
      <div
        className={`fixed top-3 right-4 z-50 transition-all duration-300 ${
          visible ? "opacity-0 pointer-events-none scale-75" : "opacity-100 scale-100"
        }`}
        ref={menuRef}
      >
        <button
          onClick={() => setMenuOpen((prev) => !prev)}
          className="w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
          aria-label="Open navigation"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <MoreVertical className="w-5 h-5" />}
        </button>

        {/* Dropdown */}
        {menuOpen && (
          <div className="absolute right-0 mt-2 w-52 bg-card border rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Nav items */}
            {menuItems.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
                <div className="px-4 py-3 text-sm font-bengali hover:bg-muted cursor-pointer transition-colors border-b last:border-0">
                  {item.label}
                </div>
              </Link>
            ))}
            {/* Right content duplicated in menu */}
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

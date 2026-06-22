import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useGetAdminMe, useAdminLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { MoreVertical, X } from "lucide-react";

const HIDE_DELAY_MS = 3500;

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { data: user, isLoading, error } = useGetAdminMe();
  const logoutMutation = useAdminLogout();

  const [sidebarVisible, setSidebarVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSidebar = useCallback(() => {
    setSidebarVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setSidebarVisible(false), HIDE_DELAY_MS);
  }, []);

  const hideSidebar = useCallback(() => {
    setSidebarVisible(false);
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  useEffect(() => {
    hideTimer.current = setTimeout(() => setSidebarVisible(false), HIDE_DELAY_MS);
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (e.clientX < 80) showSidebar();
    };
    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, [showSidebar]);

  useEffect(() => {
    if (!isLoading && (error || !user)) {
      setLocation("/admin/login");
    }
  }, [user, isLoading, error, setLocation]);

  if (isLoading) return <div className="p-10 text-center font-bengali">লোড হচ্ছে...</div>;
  if (!user) return null;

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => setLocation("/admin/login"),
    });
  };

  return (
    <div className="min-h-screen flex bg-muted/30 relative">

      {/* Floating ⋮ toggle — always visible on left edge */}
      <div className="fixed top-3 left-3 z-50">
        <button
          onClick={() => (sidebarVisible ? hideSidebar() : showSidebar())}
          className={`w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
            sidebarVisible
              ? "bg-sidebar-primary/20 text-sidebar-primary hover:bg-sidebar-primary/30"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
          aria-label="Toggle sidebar"
        >
          {sidebarVisible ? <X className="w-5 h-5" /> : <MoreVertical className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`w-64 bg-sidebar border-r flex flex-col flex-shrink-0 fixed top-0 left-0 h-screen z-40 transition-transform duration-300 ${
          sidebarVisible ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 border-b bg-sidebar-primary text-sidebar-primary-foreground pl-14">
          <h2 className="font-bold text-xl flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded flex items-center justify-center text-sm">BD</div>
            <span className="font-bengali">অ্যাডমিন পোর্টাল</span>
          </h2>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/admin" onClick={hideSidebar}>
            <Button variant="ghost" className="w-full justify-start font-bengali hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              📊 ড্যাশবোর্ড
            </Button>
          </Link>
          <Link href="/admin/voters" onClick={hideSidebar}>
            <Button variant="ghost" className="w-full justify-start font-bengali hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              👥 ভোটার পরিচালনা
            </Button>
          </Link>
          <Link href="/admin/upload" onClick={hideSidebar}>
            <Button variant="ghost" className="w-full justify-start font-bengali hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              📂 ডেটা আপলোড
            </Button>
          </Link>
        </nav>
        <div className="p-4 border-t">
          <div className="text-sm text-muted-foreground mb-4 px-2 font-bengali">লগইন: {user.username}</div>
          <Button variant="outline" className="w-full justify-start text-destructive font-bengali" onClick={handleLogout}>
            লগআউট
          </Button>
        </div>
      </aside>

      {/* Backdrop when sidebar open */}
      {sidebarVisible && (
        <div
          className="fixed inset-0 z-30 bg-black/20"
          onClick={hideSidebar}
        />
      )}

      {/* Main Content — always full width */}
      <main className="flex-1 flex flex-col min-w-0 overflow-auto w-full">
        <header className="h-16 border-b bg-card flex items-center px-6 sticky top-0 z-20 pl-16">
          <div className="ml-auto">
            <Link href="/">
              <Button variant="ghost" className="font-bengali">পাবলিক পোর্টাল ↗</Button>
            </Link>
          </div>
        </header>
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

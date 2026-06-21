import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useGetAdminMe, useAdminLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { data: user, isLoading, error } = useGetAdminMe();
  const logoutMutation = useAdminLogout();

  useEffect(() => {
    if (!isLoading && (error || !user)) {
      setLocation("/admin/login");
    }
  }, [user, isLoading, error, setLocation]);

  if (isLoading) return <div className="p-10 text-center">Loading Admin...</div>;
  if (!user) return null;

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => setLocation("/admin/login")
    });
  };

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r flex flex-col flex-shrink-0 sticky top-0 h-screen">
        <div className="p-6 border-b bg-sidebar-primary text-sidebar-primary-foreground">
          <h2 className="font-bold text-xl flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded flex items-center justify-center text-sm">BD</div>
            Admin Portal
          </h2>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/admin">
            <Button variant="ghost" className="w-full justify-start hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">Dashboard</Button>
          </Link>
          <Link href="/admin/voters">
            <Button variant="ghost" className="w-full justify-start hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">Manage Voters</Button>
          </Link>
          <Link href="/admin/upload">
            <Button variant="ghost" className="w-full justify-start hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">Upload Data</Button>
          </Link>
        </nav>
        <div className="p-4 border-t">
          <div className="text-sm text-muted-foreground mb-4 px-2">Logged in as {user.username}</div>
          <Button variant="outline" className="w-full justify-start text-destructive" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-auto">
        <header className="h-16 border-b bg-card flex items-center px-6 sticky top-0 z-10">
          <div className="ml-auto">
            <Link href="/">
              <Button variant="ghost" className="font-bengali">Public Portal ↗</Button>
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

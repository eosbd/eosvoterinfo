import { useLocation } from "wouter";
import { useSearchVoters, getSearchVotersQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Navbar } from "@/components/layout/navbar";

export default function SearchResults() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const voterNo = searchParams.get("voterNo") || undefined;
  const name = searchParams.get("name") || undefined;
  const district = searchParams.get("district") || undefined;

  const { data, isLoading, error } = useSearchVoters(
    { voterNo, name, district, limit: 20 },
    { query: { queryKey: getSearchVotersQueryKey({ voterNo, name, district, limit: 20 }) } }
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar
        leftContent={
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" className="font-bengali">← ফিরে যান</Button>
            </Link>
            <h1 className="text-xl font-bold font-bengali">অনুসন্ধানের ফলাফল</h1>
          </div>
        }
        menuItems={[
          { label: "🏠 হোম", href: "/" },
          { label: "🔐 অ্যাডমিন লগইন", href: "/admin/login" },
        ]}
      />

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="h-32" />
              </Card>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-md font-bengali">
            তথ্য লোড করতে সমস্যা হয়েছে।
          </div>
        )}

        {data?.voters.length === 0 && (
          <div className="text-center py-20 bg-card rounded-xl border">
            <h3 className="text-xl font-bengali text-muted-foreground">কোনো তথ্য পাওয়া যায়নি</h3>
          </div>
        )}

        <div className="space-y-4">
          {data?.voters.map((voter) => (
            <Link key={voter.id} href={`/voter/${voter.id}`}>
              <Card className="hover:border-primary cursor-pointer transition-colors">
                <CardContent className="p-6 flex flex-col sm:flex-row gap-6 justify-between items-start sm:items-center">
                  <div>
                    <h3 className="text-xl font-bold font-bengali text-foreground mb-1">{voter.name}</h3>
                    <p className="text-sm font-bengali text-muted-foreground">পিতা: {voter.fatherName}</p>
                    <p className="text-sm font-bengali text-muted-foreground">ভোটার নং: {voter.voterNo}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bengali bg-secondary text-secondary-foreground px-3 py-1 rounded-full">
                      জেলা: {voter.district}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

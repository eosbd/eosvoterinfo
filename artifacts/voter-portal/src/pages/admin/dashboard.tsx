import { useState } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";

export default function AdminDashboard() {
  const { data: stats, isLoading, refetch } = useGetDashboardStats();
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessResult, setReprocessResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  async function handleReprocess() {
    if (!confirm("সতর্কতা: এটি সমস্ত ভোটার ডেটা মুছে ফেলবে এবং সমস্ত ZIP ফাইল থেকে পুনরায় আমদানি করবে। আপনি কি নিশ্চিত?")) {
      return;
    }
    setReprocessing(true);
    setReprocessResult(null);
    try {
      const resp = await fetch("/api/admin/reprocess", {
        method: "POST",
        credentials: "include",
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        setReprocessResult({
          type: "success",
          message: `সফলভাবে ${data.inserted.toLocaleString("bn-BD")} ভোটার রেকর্ড পুনরায় আমদানি করা হয়েছে (${data.zipsProcessed} টি ZIP ফাইল থেকে)।`,
        });
        refetch();
      } else {
        setReprocessResult({ type: "error", message: data.error || "পুনঃপ্রক্রিয়া ব্যর্থ হয়েছে" });
      }
    } catch (err) {
      setReprocessResult({ type: "error", message: String(err) });
    } finally {
      setReprocessing(false);
    }
  }

  if (isLoading) return <AdminLayout><div className="p-4 font-bengali">স্ট্যাটস লোড হচ্ছে...</div></AdminLayout>;
  if (!stats) return (
    <AdminLayout>
      <div className="p-4 text-destructive font-bengali flex items-center gap-2">
        <AlertTriangle className="h-5 w-5" />
        স্ট্যাটস লোড করতে ব্যর্থ হয়েছে।
        <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-2 font-bengali">আবার চেষ্টা করুন</Button>
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground font-bengali">ড্যাশবোর্ড</h1>
            <p className="text-muted-foreground mt-1 font-bengali">সিস্টেম পরিসংখ্যান ও তথ্য বিতরণ।</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <Button
              onClick={handleReprocess}
              disabled={reprocessing}
              variant="outline"
              className="gap-2 border-amber-500 text-amber-700 hover:bg-amber-50 font-bengali"
            >
              <RefreshCw className={`h-4 w-4 ${reprocessing ? "animate-spin" : ""}`} />
              {reprocessing ? "পুনরায় প্রক্রিয়া করা হচ্ছে…" : "ডেটা পুনঃপ্রক্রিয়া (বাংলা ঠিক করুন)"}
            </Button>
            {reprocessResult && (
              <div className={`flex items-center gap-2 text-sm rounded-md px-3 py-2 max-w-xs text-right ${
                reprocessResult.type === "success"
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}>
                {reprocessResult.type === "success"
                  ? <CheckCircle className="h-4 w-4 shrink-0" />
                  : <AlertTriangle className="h-4 w-4 shrink-0" />}
                <span className="font-bengali">{reprocessResult.message}</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-l-4 border-l-primary shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase font-bengali">মোট ভোটার</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-foreground">{stats.totalVoters.toLocaleString("bn-BD")}</div>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-chart-2 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase font-bengali">জেলার সংখ্যা</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-foreground">{stats.byDistrict.length}</div>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-chart-3 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase font-bengali">মোট আপলোড</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-foreground">{stats.recentUploads}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="font-bengali">জেলা অনুযায়ী ভোটার</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              {stats.byDistrict.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground font-bengali">কোনো তথ্য নেই</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.byDistrict}>
                    <XAxis dataKey="label" className="font-bengali text-xs" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip contentStyle={{ fontFamily: 'Hind Siliguri, Noto Sans Bengali, sans-serif' }} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-bengali">ওয়ার্ড অনুযায়ী ভোটার</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              {stats.byWard.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground font-bengali">কোনো তথ্য নেই</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.byWard.slice(0, 10)}>
                    <XAxis dataKey="label" className="font-bengali text-xs" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip contentStyle={{ fontFamily: 'Hind Siliguri, Noto Sans Bengali, sans-serif' }} />
                    <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}

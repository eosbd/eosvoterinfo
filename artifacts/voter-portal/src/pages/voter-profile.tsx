import { useRoute, Link } from "wouter";
import { useGetVoter, getGetVoterQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/layout/navbar";

function printSingleVoter(voter: ReturnType<typeof useGetVoter>["data"]) {
  if (!voter) return;
  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8">
<title>ভোটার তথ্য - ${voter.name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Noto Sans Bengali', Arial, sans-serif; font-size:13px; padding:30px; max-width:700px; margin:0 auto; }
  .header { text-align:center; border-bottom:3px solid #166534; padding-bottom:12px; margin-bottom:20px; }
  .header h1 { font-size:18px; color:#166534; }
  .header p { font-size:12px; color:#666; margin-top:4px; }
  .name-card { background:#166534; color:white; padding:14px 20px; border-radius:8px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; }
  .name-card .name { font-size:20px; font-weight:bold; }
  .name-card .voter-no { font-size:13px; opacity:0.9; }
  .section { margin-bottom:16px; }
  .section-title { font-weight:bold; color:#166534; border-bottom:1px solid #ccc; padding-bottom:4px; margin-bottom:8px; font-size:13px; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .row { padding:5px 0; border-bottom:1px dashed #eee; }
  .label { color:#666; font-size:11px; }
  .value { font-weight:500; font-size:13px; }
  .footer { text-align:center; margin-top:24px; font-size:10px; color:#999; border-top:1px solid #ddd; padding-top:8px; }
</style>
</head><body>
<div class="header">
  <h1>বাংলাদেশ নির্বাচন কমিশন</h1>
  <p>ভোটার তথ্য বিবরণী</p>
</div>
<div class="name-card">
  <div>
    <div class="name">${voter.name}</div>
    <div class="voter-no">ক্রমিক নং: ${voter.serialNo || "—"}</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:15px;font-weight:bold">ভোটার নং</div>
    <div style="font-size:18px;font-weight:bold">${voter.voterNo}</div>
  </div>
</div>
<div class="section">
  <div class="section-title">ব্যক্তিগত তথ্য</div>
  <div class="grid">
    <div class="row"><div class="label">পিতার নাম</div><div class="value">${voter.fatherName || "—"}</div></div>
    <div class="row"><div class="label">মাতার নাম</div><div class="value">${voter.motherName || "—"}</div></div>
    <div class="row"><div class="label">জন্ম তারিখ</div><div class="value">${voter.dob || "—"}</div></div>
    <div class="row"><div class="label">পেশা</div><div class="value">${voter.occupation || "—"}</div></div>
  </div>
</div>
<div class="section">
  <div class="section-title">ঠিকানা</div>
  <div class="row" style="grid-column:span 2"><div class="label">সাধারণ ঠিকানা</div><div class="value">${voter.generalAddress || "—"}</div></div>
  <div class="grid" style="margin-top:6px">
    <div class="row"><div class="label">বিভাগ</div><div class="value">${voter.region || "—"}</div></div>
    <div class="row"><div class="label">জেলা</div><div class="value">${voter.district || "—"}</div></div>
    <div class="row"><div class="label">উপজেলা/থানা</div><div class="value">${voter.upazilaThana || "—"}</div></div>
    <div class="row"><div class="label">ইউনিয়ন/পৌরসভা</div><div class="value">${voter.cityCorp || "—"}</div></div>
    <div class="row"><div class="label">ডাকঘর</div><div class="value">${voter.postOffice || "—"}</div></div>
    <div class="row"><div class="label">পোস্টাল কোড</div><div class="value">${voter.postCode || "—"}</div></div>
  </div>
</div>
<div class="section">
  <div class="section-title">ভোটার এলাকা</div>
  <div class="grid">
    <div class="row"><div class="label">ভোটার এলাকার নাম</div><div class="value">${voter.voterAreaName || "—"}</div></div>
    <div class="row"><div class="label">ভোটার এলাকার নম্বর</div><div class="value">${voter.voterAreaNumber || "—"}</div></div>
    <div class="row"><div class="label">এলাকা কোড</div><div class="value">${voter.areaCode || "—"}</div></div>
    <div class="row"><div class="label">ওয়ার্ড</div><div class="value">${voter.ward || "—"}</div></div>
  </div>
</div>
<div class="footer">মুদ্রণের তারিখ: ${new Date().toLocaleDateString("bn-BD")} | বাংলাদেশ নির্বাচন কমিশন</div>
</body></html>`;
  const w = window.open("", "_blank", "width=750,height=700");
  if (!w) { alert("পপ-আপ ব্লক করা আছে।"); return; }
  w.document.write(html);
  w.document.close();
  w.onload = () => w.print();
}

export default function VoterProfile() {
  const [, params] = useRoute("/voter/:id");
  const id = params?.id ? parseInt(params.id) : 0;

  const { data: voter, isLoading } = useGetVoter(id, {
    query: { enabled: !!id, queryKey: getGetVoterQueryKey(id) }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center font-bengali text-muted-foreground">
          <div className="text-3xl mb-3 animate-spin">⟳</div>
          লোড হচ্ছে...
        </div>
      </div>
    );
  }

  if (!voter) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">🔍</div>
          <p className="font-bengali text-muted-foreground">ভোটার পাওয়া যায়নি</p>
          <Link href="/"><Button className="mt-4 font-bengali" variant="outline">হোমে ফিরুন</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar
        leftContent={
          <div className="flex items-center gap-2">
            <Link href="/search">
              <Button variant="ghost" size="sm" className="font-bengali">← ফলাফলে ফিরুন</Button>
            </Link>
            <span className="font-bold font-bengali hidden sm:block">ভোটার বিস্তারিত তথ্য</span>
          </div>
        }
        rightContent={
          <Button
            onClick={() => printSingleVoter(voter)}
            size="sm"
            className="font-bengali bg-green-600 hover:bg-green-700 text-white"
          >
            🖨️ প্রিন্ট করুন
          </Button>
        }
        menuItems={[
          { label: "🏠 হোম", href: "/" },
          { label: "🔐 অ্যাডমিন", href: "/admin/login" },
        ]}
      />

      <main className="flex-1 p-4 md:p-6 max-w-4xl mx-auto w-full space-y-4">

        {/* Name header card */}
        <div className="bg-green-700 text-white rounded-xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-md">
          <div>
            <h2 className="text-2xl font-bold font-bengali">{voter.name}</h2>
            <div className="flex gap-3 mt-1 flex-wrap">
              {voter.serialNo && <Badge className="bg-white/20 text-white font-bengali">ক্রমিক: {voter.serialNo}</Badge>}
              {voter.occupation && <Badge className="bg-white/20 text-white font-bengali">{voter.occupation}</Badge>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/70 font-bengali">ভোটার নম্বর</p>
            <p className="text-2xl font-bold font-bengali tracking-widest">{voter.voterNo}</p>
          </div>
        </div>

        {/* Personal Details */}
        <Card className="border-t-4 border-t-green-600 shadow-sm">
          <CardHeader className="bg-secondary/30 pb-3">
            <CardTitle className="font-bengali text-base flex items-center gap-2">
              <span className="w-1.5 h-5 bg-green-600 rounded-full inline-block"></span>
              ব্যক্তিগত তথ্য
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
            <DataRow label="পিতার নাম" value={voter.fatherName} />
            <DataRow label="মাতার নাম" value={voter.motherName} />
            <DataRow label="জন্ম তারিখ" value={voter.dob} />
            <DataRow label="পেশা" value={voter.occupation} />
          </CardContent>
        </Card>

        {/* Address Details */}
        <Card className="shadow-sm">
          <CardHeader className="bg-secondary/30 pb-3">
            <CardTitle className="font-bengali text-base flex items-center gap-2">
              <span className="w-1.5 h-5 bg-green-600 rounded-full inline-block"></span>
              ঠিকানা
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
            <DataRow label="সাধারণ ঠিকানা" value={voter.generalAddress} className="md:col-span-2" />
            <DataRow label="বিভাগ" value={voter.region} />
            <DataRow label="জেলা" value={voter.district} />
            <DataRow label="উপজেলা/থানা" value={voter.upazilaThana} />
            <DataRow label="ইউনিয়ন/পৌরসভা" value={voter.cityCorp} />
            <DataRow label="ডাকঘর" value={voter.postOffice} />
            <DataRow label="পোস্টাল কোড" value={voter.postCode} />
          </CardContent>
        </Card>

        {/* Voter Area Details */}
        <Card className="shadow-sm">
          <CardHeader className="bg-secondary/30 pb-3">
            <CardTitle className="font-bengali text-base flex items-center gap-2">
              <span className="w-1.5 h-5 bg-green-600 rounded-full inline-block"></span>
              ভোটার এলাকা
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
            <DataRow label="ভোটার এলাকার নাম" value={voter.voterAreaName} className="md:col-span-2" />
            <DataRow label="ভোটার এলাকার নম্বর" value={voter.voterAreaNumber} />
            <DataRow label="এলাকা কোড" value={voter.areaCode} />
            <DataRow label="ওয়ার্ড" value={voter.ward} />
          </CardContent>
        </Card>

        <div className="flex gap-3 pb-4">
          <Button
            onClick={() => printSingleVoter(voter)}
            className="font-bengali bg-green-600 hover:bg-green-700 text-white"
          >
            🖨️ এই ভোটারের তথ্য প্রিন্ট করুন
          </Button>
          <Link href="/search">
            <Button variant="outline" className="font-bengali">← ফলাফলে ফিরুন</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}

function DataRow({ label, value, className = "" }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={`flex flex-col border-b border-border/40 pb-2 ${className}`}>
      <span className="text-xs text-muted-foreground font-bengali mb-0.5">{label}</span>
      <span className={`text-sm font-medium font-bengali ${value ? "text-foreground" : "text-muted-foreground/50"}`}>
        {value || "—"}
      </span>
    </div>
  );
}

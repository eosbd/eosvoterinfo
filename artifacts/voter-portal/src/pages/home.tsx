import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Navbar } from "@/components/layout/navbar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const EMPTY = {
  voterNo: "", name: "", fatherName: "", motherName: "",
  district: "", thana: "", ward: "", region: "",
  cityCorp: "", postOffice: "", postCode: "",
  voterAreaName: "", generalAddress: "",
};

export default function Home() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"quick" | "advanced">("quick");
  const [fields, setFields] = useState(EMPTY);

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields(f => ({ ...f, [key]: e.target.value }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    Object.entries(fields).forEach(([k, v]) => { if (v.trim()) params.set(k, v.trim()); });
    if (!params.toString()) return;
    setLocation(`/search?${params.toString()}`);
  }

  function clearAll() { setFields(EMPTY); }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-green-50 to-background">
      <Navbar
        title="বাংলাদেশ ভোটার পোর্টাল"
        rightContent={
          <div className="flex items-center gap-2">
            <Link href="/api-docs">
              <Button variant="ghost" size="sm" className="font-bengali text-xs">📡 API</Button>
            </Link>
            <Link href="/admin/login">
              <Button variant="outline" size="sm" className="font-bengali">🔐 অ্যাডমিন</Button>
            </Link>
          </div>
        }
        menuItems={[
          { label: "🏠 হোম", href: "/" },
          { label: "📡 API ডকুমেন্টেশন", href: "/api-docs" },
          { label: "🔐 অ্যাডমিন লগইন", href: "/admin/login" },
        ]}
      />

      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        <div className="max-w-3xl w-full space-y-6">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-3">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center text-3xl shadow-lg">🗳️</div>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-green-800 font-bengali">ভোটার তথ্য অনুসন্ধান</h1>
            <p className="text-muted-foreground font-bengali text-sm md:text-base">
              আংশিক বা সম্পূর্ণ তথ্য দিয়ে যেকোনো ভোটারের তথ্য খুঁজুন
            </p>
          </div>

          <div className="bg-card rounded-2xl border shadow-md overflow-hidden">
            <div className="flex border-b">
              <button
                onClick={() => setTab("quick")}
                className={`flex-1 py-3 text-sm font-bengali font-semibold transition-colors ${
                  tab === "quick" ? "bg-green-600 text-white" : "bg-secondary text-foreground hover:bg-secondary/70"
                }`}
              >
                🔍 দ্রুত অনুসন্ধান
              </button>
              <button
                onClick={() => setTab("advanced")}
                className={`flex-1 py-3 text-sm font-bengali font-semibold transition-colors ${
                  tab === "advanced" ? "bg-green-600 text-white" : "bg-secondary text-foreground hover:bg-secondary/70"
                }`}
              >
                ⚙️ বিস্তারিত অনুসন্ধান
              </button>
            </div>

            <form onSubmit={onSubmit} className="p-6 space-y-5">
              {tab === "quick" ? (
                <>
                  <div className="space-y-2">
                    <Label className="font-bengali font-semibold text-sm">ভোটার নম্বর</Label>
                    <Input
                      value={fields.voterNo}
                      onChange={set("voterNo")}
                      placeholder="ভোটার নম্বর লিখুন (আংশিক বা সম্পূর্ণ)..."
                      className="font-bengali h-11"
                    />
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                    <div className="relative flex justify-center">
                      <span className="bg-card px-3 text-xs text-muted-foreground font-bengali">অথবা নাম ও ঠিকানা দিয়ে খুঁজুন</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-bengali font-semibold text-sm">নাম</Label>
                      <Input value={fields.name} onChange={set("name")} placeholder="নাম (আংশিক/সম্পূর্ণ)..." className="font-bengali h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bengali font-semibold text-sm">জেলা</Label>
                      <Input value={fields.district} onChange={set("district")} placeholder="জেলার নাম..." className="font-bengali h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bengali font-semibold text-sm">পিতার নাম</Label>
                      <Input value={fields.fatherName} onChange={set("fatherName")} placeholder="পিতার নাম (আংশিক)..." className="font-bengali h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bengali font-semibold text-sm">উপজেলা/থানা</Label>
                      <Input value={fields.thana} onChange={set("thana")} placeholder="উপজেলা/থানা..." className="font-bengali h-11" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-green-700 font-bengali uppercase tracking-wide">ব্যক্তিগত তথ্য</p>
                    <Separator />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="font-bengali text-sm">ভোটার নম্বর</Label>
                      <Input value={fields.voterNo} onChange={set("voterNo")} placeholder="ভোটার নম্বর..." className="font-bengali" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bengali text-sm">নাম</Label>
                      <Input value={fields.name} onChange={set("name")} placeholder="নাম..." className="font-bengali" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bengali text-sm">পিতার নাম</Label>
                      <Input value={fields.fatherName} onChange={set("fatherName")} placeholder="পিতার নাম..." className="font-bengali" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bengali text-sm">মাতার নাম</Label>
                      <Input value={fields.motherName} onChange={set("motherName")} placeholder="মাতার নাম..." className="font-bengali" />
                    </div>
                  </div>

                  <div className="space-y-1 pt-2">
                    <p className="text-xs font-semibold text-green-700 font-bengali uppercase tracking-wide">ঠিকানা</p>
                    <Separator />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="font-bengali text-sm">বিভাগ</Label>
                      <Input value={fields.region} onChange={set("region")} placeholder="বিভাগের নাম..." className="font-bengali" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bengali text-sm">জেলা</Label>
                      <Input value={fields.district} onChange={set("district")} placeholder="জেলার নাম..." className="font-bengali" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bengali text-sm">উপজেলা/থানা</Label>
                      <Input value={fields.thana} onChange={set("thana")} placeholder="উপজেলা/থানা..." className="font-bengali" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bengali text-sm">ইউনিয়ন/পৌরসভা</Label>
                      <Input value={fields.cityCorp} onChange={set("cityCorp")} placeholder="ইউনিয়ন/পৌরসভা..." className="font-bengali" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bengali text-sm">ওয়ার্ড নম্বর</Label>
                      <Input value={fields.ward} onChange={set("ward")} placeholder="ওয়ার্ড নম্বর..." className="font-bengali" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bengali text-sm">ডাকঘর</Label>
                      <Input value={fields.postOffice} onChange={set("postOffice")} placeholder="ডাকঘরের নাম..." className="font-bengali" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bengali text-sm">পোস্টাল কোড</Label>
                      <Input value={fields.postCode} onChange={set("postCode")} placeholder="পোস্টাল কোড..." className="font-bengali" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bengali text-sm">গ্রাম/রাস্তা/ভোটার এলাকা</Label>
                      <Input value={fields.voterAreaName} onChange={set("voterAreaName")} placeholder="গ্রাম/রাস্তার নাম..." className="font-bengali" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bengali text-sm">বাসা/হোল্ডিং/সাধারণ ঠিকানা</Label>
                      <Input value={fields.generalAddress} onChange={set("generalAddress")} placeholder="বাসা/হোল্ডিং নম্বর..." className="font-bengali" />
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="submit" className="flex-1 h-12 font-bengali text-base bg-green-600 hover:bg-green-700 text-white">
                  🔍 অনুসন্ধান করুন
                </Button>
                <Button type="button" variant="outline" onClick={clearAll} className="font-bengali px-5">
                  মুছুন
                </Button>
              </div>
            </form>
          </div>

          <div className="text-center">
            <div className="flex flex-wrap justify-center gap-2">
              {["নাম দিয়ে", "ভোটার নম্বর দিয়ে", "জেলা দিয়ে", "উপজেলা দিয়ে", "ওয়ার্ড দিয়ে"].map(tip => (
                <Badge key={tip} variant="secondary" className="font-bengali text-xs">{tip} অনুসন্ধান করুন</Badge>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-muted-foreground border-t bg-card">
        <p className="font-bengali">© ২০২৫ বাংলাদেশ নির্বাচন কমিশন। সর্বস্বত্ব সংরক্ষিত।</p>
      </footer>
    </div>
  );
}

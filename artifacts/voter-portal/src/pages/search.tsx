import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Navbar } from "@/components/layout/navbar";

type Voter = {
  id: number; voterNo: string; name: string; fatherName?: string | null;
  motherName?: string | null; occupation?: string | null; dob?: string | null;
  generalAddress?: string | null; region?: string | null; district?: string | null;
  upazilaThana?: string | null; cityCorp?: string | null; postOffice?: string | null;
  postCode?: string | null; voterAreaName?: string | null; voterAreaNumber?: string | null;
  ward?: string | null; serialNo?: string | null;
};

const PARAM_LABELS: Record<string, string> = {
  voterNo: "ভোটার নম্বর", name: "নাম", fatherName: "পিতা", motherName: "মাতা",
  district: "জেলা", thana: "উপজেলা", ward: "ওয়ার্ড", region: "বিভাগ",
  cityCorp: "ইউনিয়ন/পৌরসভা", postOffice: "ডাকঘর", postCode: "পোস্ট কোড",
  voterAreaName: "গ্রাম/রাস্তা", generalAddress: "ঠিকানা",
};

function getParams() {
  return new URLSearchParams(window.location.search);
}

async function fetchVoters(params: URLSearchParams, page: number, limit: number) {
  const p = new URLSearchParams(params);
  p.set("page", String(page));
  p.set("limit", String(limit));
  const res = await fetch(`/api/voters/search?${p.toString()}`);
  if (!res.ok) throw new Error("অনুসন্ধান ব্যর্থ হয়েছে");
  return res.json() as Promise<{ voters: Voter[]; total: number; page: number; limit: number }>;
}

function printVoters(voters: Voter[], title = "ভোটার তথ্য") {
  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Noto Sans Bengali', Arial, sans-serif; font-size: 12px; padding: 20px; }
  h1 { text-align:center; font-size:16px; margin-bottom:16px; border-bottom:2px solid #166534; padding-bottom:8px; color:#166534; }
  .grid { display:grid; grid-template-columns: repeat(2,1fr); gap:12px; }
  .card { border:1px solid #ccc; border-radius:6px; padding:10px; page-break-inside:avoid; }
  .card-header { background:#166534; color:white; padding:6px 10px; margin:-10px -10px 8px; border-radius:5px 5px 0 0; }
  .name { font-size:14px; font-weight:bold; }
  .voter-no { font-size:11px; opacity:0.9; }
  .row { display:flex; gap:4px; margin-bottom:3px; }
  .label { color:#666; min-width:90px; }
  .value { font-weight:500; }
  .divider { border-top:1px dashed #ddd; margin:6px 0; }
  .footer { text-align:center; margin-top:20px; font-size:10px; color:#888; border-top:1px solid #ddd; padding-top:8px; }
  @media print { .no-print { display:none; } }
</style>
</head><body>
<h1>বাংলাদেশ নির্বাচন কমিশন — ${title}</h1>
<div class="grid">
${voters.map((v, i) => `
<div class="card">
  <div class="card-header">
    <div class="name">${i + 1}. ${v.name || "—"}</div>
    <div class="voter-no">ভোটার নং: ${v.voterNo || "—"} | ক্রমিক: ${v.serialNo || "—"}</div>
  </div>
  <div class="row"><span class="label">পিতা:</span><span class="value">${v.fatherName || "—"}</span></div>
  <div class="row"><span class="label">মাতা:</span><span class="value">${v.motherName || "—"}</span></div>
  <div class="row"><span class="label">জন্ম তারিখ:</span><span class="value">${v.dob || "—"}</span></div>
  <div class="divider"></div>
  <div class="row"><span class="label">বিভাগ:</span><span class="value">${v.region || "—"}</span></div>
  <div class="row"><span class="label">জেলা:</span><span class="value">${v.district || "—"}</span></div>
  <div class="row"><span class="label">উপজেলা:</span><span class="value">${v.upazilaThana || "—"}</span></div>
  <div class="row"><span class="label">ইউ/পৌরসভা:</span><span class="value">${v.cityCorp || "—"}</span></div>
  <div class="row"><span class="label">ওয়ার্ড:</span><span class="value">${v.ward || "—"}</span></div>
  <div class="row"><span class="label">ডাকঘর:</span><span class="value">${v.postOffice || "—"} - ${v.postCode || "—"}</span></div>
  <div class="row"><span class="label">গ্রাম/রাস্তা:</span><span class="value">${v.voterAreaName || "—"}</span></div>
  <div class="row"><span class="label">ঠিকানা:</span><span class="value">${v.generalAddress || "—"}</span></div>
</div>`).join("")}
</div>
<div class="footer">মোট: ${voters.length} জন ভোটার | মুদ্রণের তারিখ: ${new Date().toLocaleDateString("bn-BD")}</div>
</body></html>`;
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) { alert("পপ-আপ ব্লক করা আছে। অনুগ্রহ করে অনুমতি দিন।"); return; }
  w.document.write(html);
  w.document.close();
  w.onload = () => w.print();
}

export default function SearchResults() {
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const LIMIT = 20;
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [filterDraft, setFilterDraft] = useState<Record<string, string>>({});

  const searchParams = getParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["voters-search", searchParams.toString(), page],
    queryFn: () => fetchVoters(searchParams, page, LIMIT),
    enabled: searchParams.toString().length > 0,
  });

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [searchParams.toString()]);

  const activeFilters = Array.from(searchParams.entries()).filter(([k]) => k !== "page" && k !== "limit");

  function removeFilter(key: string) {
    const p = getParams();
    p.delete(key);
    setLocation(`/search?${p.toString()}`);
  }

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    const p = getParams();
    Object.entries(filterDraft).forEach(([k, v]) => {
      if (v.trim()) p.set(k, v.trim()); else p.delete(k);
    });
    setLocation(`/search?${p.toString()}`);
    setShowFilters(false);
    setFilterDraft({});
  }

  function toggleSelect(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!data) return;
    if (selected.size === data.voters.length) setSelected(new Set());
    else setSelected(new Set(data.voters.map(v => v.id)));
  }

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 0;
  const selectedVoters = data?.voters.filter(v => selected.has(v.id)) ?? [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar
        leftContent={
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="sm" className="font-bengali">← হোম</Button>
            </Link>
            <span className="font-bold font-bengali text-base hidden sm:block">অনুসন্ধানের ফলাফল</span>
          </div>
        }
        menuItems={[
          { label: "🏠 হোম", href: "/" },
          { label: "📡 API", href: "/api-docs" },
          { label: "🔐 অ্যাডমিন", href: "/admin/login" },
        ]}
      />

      <main className="flex-1 p-3 md:p-6 max-w-7xl mx-auto w-full">
        <div className="flex flex-col gap-4">

          {/* Active filter chips */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-muted-foreground font-bengali">সক্রিয় ফিল্টার:</span>
              {activeFilters.map(([k, v]) => (
                <Badge key={k} variant="secondary" className="font-bengali text-xs gap-1 pr-1">
                  {PARAM_LABELS[k] || k}: {v}
                  <button onClick={() => removeFilter(k)} className="ml-1 text-destructive hover:text-destructive/80 font-bold">×</button>
                </Badge>
              ))}
              <Link href="/">
                <button className="text-xs text-muted-foreground underline font-bengali">সব মুছুন</button>
              </Link>
            </div>
          )}

          {/* Results summary and action bar */}
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-3">
              {data && (
                <span className="font-bengali text-sm font-medium">
                  মোট <span className="text-green-700 font-bold text-base">{data.total.toLocaleString("bn-BD")}</span> টি ফলাফল
                  {data.total > LIMIT && ` (পৃষ্ঠা ${page}/${totalPages})`}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="font-bengali text-xs"
              >
                ⚙️ ফিল্টার {showFilters ? "লুকান" : "দেখান"}
              </Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {data && data.voters.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                  className="font-bengali text-xs"
                >
                  {selected.size === data.voters.length ? "✗ সব বাতিল" : "✓ সব নির্বাচন"}
                </Button>
              )}
              {selectedVoters.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => printVoters(selectedVoters, `নির্বাচিত ${selectedVoters.length} জন ভোটার`)}
                  className="font-bengali text-xs border-green-600 text-green-700 hover:bg-green-50"
                >
                  🖨️ নির্বাচিত প্রিন্ট ({selectedVoters.length})
                </Button>
              )}
              {data && data.voters.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => printVoters(data.voters, "ফলাফল তালিকা")}
                  className="font-bengali text-xs bg-green-600 hover:bg-green-700 text-white"
                >
                  🖨️ এই পৃষ্ঠা প্রিন্ট
                </Button>
              )}
            </div>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <Card className="border-green-200">
              <CardContent className="p-4">
                <form onSubmit={applyFilters} className="space-y-4">
                  <p className="font-bengali font-semibold text-sm text-green-700">ফিল্টার পরিবর্তন করুন</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {[
                      { key: "voterNo", label: "ভোটার নম্বর" },
                      { key: "name", label: "নাম" },
                      { key: "fatherName", label: "পিতার নাম" },
                      { key: "motherName", label: "মাতার নাম" },
                      { key: "region", label: "বিভাগ" },
                      { key: "district", label: "জেলা" },
                      { key: "thana", label: "উপজেলা/থানা" },
                      { key: "cityCorp", label: "ইউনিয়ন/পৌরসভা" },
                      { key: "ward", label: "ওয়ার্ড নম্বর" },
                      { key: "postOffice", label: "ডাকঘর" },
                      { key: "postCode", label: "পোস্টাল কোড" },
                      { key: "voterAreaName", label: "গ্রাম/রাস্তা" },
                      { key: "generalAddress", label: "বাসা/হোল্ডিং" },
                    ].map(({ key, label }) => (
                      <div key={key} className="space-y-1">
                        <Label className="font-bengali text-xs">{label}</Label>
                        <Input
                          className="font-bengali h-8 text-sm"
                          placeholder={searchParams.get(key) || label + "..."}
                          value={filterDraft[key] ?? searchParams.get(key) ?? ""}
                          onChange={e => setFilterDraft(d => ({ ...d, [key]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" className="font-bengali bg-green-600 hover:bg-green-700 text-white">প্রয়োগ করুন</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setShowFilters(false)} className="font-bengali">বাতিল</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse"><CardContent className="h-24" /></Card>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-destructive/10 text-destructive p-4 rounded-md font-bengali text-sm">
              তথ্য লোড করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।
            </div>
          )}

          {/* Empty */}
          {!isLoading && data?.voters.length === 0 && (
            <div className="text-center py-20 bg-card rounded-xl border">
              <div className="text-4xl mb-3">🔍</div>
              <h3 className="text-lg font-bengali text-muted-foreground">কোনো তথ্য পাওয়া যায়নি</h3>
              <p className="text-sm text-muted-foreground font-bengali mt-1">অনুসন্ধানের শর্ত পরিবর্তন করে আবার চেষ্টা করুন</p>
              <Link href="/"><Button className="mt-4 font-bengali" variant="outline">হোমে ফিরুন</Button></Link>
            </div>
          )}

          {/* Results */}
          {data && data.voters.length > 0 && (
            <>
              <div className="space-y-2">
                {data.voters.map((voter) => (
                  <Card
                    key={voter.id}
                    className={`transition-all border-l-4 ${selected.has(voter.id) ? "border-l-green-500 bg-green-50/50" : "border-l-transparent hover:border-l-green-300"}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="pt-1">
                          <Checkbox
                            checked={selected.has(voter.id)}
                            onCheckedChange={() => toggleSelect(voter.id)}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base font-bold font-bengali text-foreground">{voter.name}</h3>
                                {voter.voterNo && (
                                  <Badge variant="outline" className="font-bengali text-xs">নং: {voter.voterNo}</Badge>
                                )}
                                {voter.serialNo && (
                                  <Badge variant="secondary" className="font-bengali text-xs">ক্রমিক: {voter.serialNo}</Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                {voter.fatherName && <span className="text-sm text-muted-foreground font-bengali">পিতা: <span className="text-foreground">{voter.fatherName}</span></span>}
                                {voter.motherName && <span className="text-sm text-muted-foreground font-bengali">মাতা: <span className="text-foreground">{voter.motherName}</span></span>}
                                {voter.dob && <span className="text-sm text-muted-foreground font-bengali">জন্ম: <span className="text-foreground">{voter.dob}</span></span>}
                              </div>
                            </div>
                            <Link href={`/voter/${voter.id}`}>
                              <Button size="sm" variant="outline" className="font-bengali text-xs shrink-0">বিস্তারিত →</Button>
                            </Link>
                          </div>
                          <Separator className="my-2" />
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                            {voter.region && <span className="font-bengali text-muted-foreground">বিভাগ: <span className="text-foreground font-medium">{voter.region}</span></span>}
                            {voter.district && <span className="font-bengali text-muted-foreground">জেলা: <span className="text-foreground font-medium">{voter.district}</span></span>}
                            {voter.upazilaThana && <span className="font-bengali text-muted-foreground">উপজেলা: <span className="text-foreground font-medium">{voter.upazilaThana}</span></span>}
                            {voter.cityCorp && <span className="font-bengali text-muted-foreground">ইউনিয়ন/পৌরসভা: <span className="text-foreground font-medium">{voter.cityCorp}</span></span>}
                            {voter.ward && <span className="font-bengali text-muted-foreground">ওয়ার্ড: <span className="text-foreground font-medium">{voter.ward}</span></span>}
                            {voter.postOffice && <span className="font-bengali text-muted-foreground">ডাকঘর: <span className="text-foreground font-medium">{voter.postOffice}</span>{voter.postCode ? ` - ${voter.postCode}` : ""}</span>}
                            {voter.voterAreaName && <span className="font-bengali text-muted-foreground">গ্রাম/রাস্তা: <span className="text-foreground font-medium">{voter.voterAreaName}</span></span>}
                            {voter.generalAddress && <span className="font-bengali text-muted-foreground col-span-full">ঠিকানা: <span className="text-foreground font-medium">{voter.generalAddress}</span></span>}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="font-bengali"
                  >← আগের পৃষ্ঠা</Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                      const p = start + i;
                      return (
                        <Button
                          key={p}
                          variant={p === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPage(p)}
                          className={`w-9 font-bengali ${p === page ? "bg-green-600 hover:bg-green-700" : ""}`}
                        >
                          {p}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="font-bengali"
                  >পরের পৃষ্ঠা →</Button>
                </div>
              )}

              {/* Bottom print bar (if items selected) */}
              {selected.size > 0 && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-green-700 text-white rounded-full shadow-xl px-6 py-3 flex items-center gap-3 z-50">
                  <span className="font-bengali text-sm">{selected.size} জন নির্বাচিত</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => printVoters(selectedVoters, `নির্বাচিত ${selectedVoters.length} জন ভোটার`)}
                    className="font-bengali text-xs"
                  >🖨️ প্রিন্ট করুন</Button>
                  <button onClick={() => setSelected(new Set())} className="text-white/80 hover:text-white text-sm">×</button>
                </div>
              )}
            </>
          )}

          {/* No search yet */}
          {!isLoading && !data && !error && (
            <div className="text-center py-20">
              <div className="text-4xl mb-3">🗳️</div>
              <p className="font-bengali text-muted-foreground">অনুসন্ধানের তথ্য প্রদান করুন</p>
              <Link href="/"><Button className="mt-4 font-bengali" variant="outline">হোমে ফিরুন</Button></Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

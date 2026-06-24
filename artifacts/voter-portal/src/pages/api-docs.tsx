import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/layout/navbar";

const BASE_URL = typeof window !== "undefined"
  ? `${window.location.protocol}//${window.location.host}/api`
  : "/api";

function CodeBlock({ code }: { code: string }) {
  function copy() { navigator.clipboard.writeText(code); }
  return (
    <div className="relative group">
      <pre className="bg-zinc-950 text-green-400 text-xs rounded-lg p-4 overflow-x-auto font-mono leading-relaxed">
        {code}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 text-xs bg-zinc-700 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
      >
        কপি
      </button>
    </div>
  );
}

function ParamRow({ name, type, desc }: { name: string; type: string; desc: string }) {
  return (
    <tr className="border-b border-border/50 hover:bg-secondary/30">
      <td className="py-2 px-3 font-mono text-sm text-green-700">{name}</td>
      <td className="py-2 px-3"><Badge variant="outline" className="text-xs">{type}</Badge></td>
      <td className="py-2 px-3 font-bengali text-sm text-muted-foreground">{desc}</td>
    </tr>
  );
}

export default function ApiDocs() {
  const searchUrl = `${BASE_URL}/voters/search`;
  const publicUrl = `${BASE_URL}/v1/search-voter`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar
        leftContent={
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="sm" className="font-bengali">← হোম</Button>
            </Link>
            <span className="font-bold font-bengali">API ডকুমেন্টেশন</span>
          </div>
        }
        menuItems={[
          { label: "🏠 হোম", href: "/" },
          { label: "🔐 অ্যাডমিন", href: "/admin/login" },
        ]}
      />

      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="text-4xl mb-2">📡</div>
          <h1 className="text-2xl font-bold font-bengali">বাংলাদেশ ভোটার পোর্টাল API</h1>
          <p className="text-muted-foreground font-bengali text-sm">
            এই API ব্যবহার করে ভোটার তথ্য অনুসন্ধান করুন
          </p>
          <div className="flex justify-center gap-2">
            <Badge variant="outline" className="text-xs">REST API</Badge>
            <Badge variant="outline" className="text-xs">JSON Response</Badge>
            <Badge className="text-xs bg-green-600 text-white">বিনামূল্যে</Badge>
          </div>
        </div>

        {/* Base URL */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bengali flex items-center gap-2">
              🔗 বেস URL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock code={BASE_URL} />
          </CardContent>
        </Card>

        {/* Endpoint 1: Full Search */}
        <Card className="border-t-4 border-t-green-600">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bengali flex items-center gap-2">
              <Badge className="bg-blue-500 text-white text-xs">GET</Badge>
              /voters/search — সম্পূর্ণ অনুসন্ধান API
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CodeBlock code={searchUrl} />

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-secondary/50">
                    <th className="py-2 px-3 text-xs font-semibold">প্যারামিটার</th>
                    <th className="py-2 px-3 text-xs font-semibold">ধরন</th>
                    <th className="py-2 px-3 text-xs font-semibold font-bengali">বিবরণ</th>
                  </tr>
                </thead>
                <tbody>
                  <ParamRow name="voterNo" type="string" desc="ভোটার নম্বর (আংশিক/সম্পূর্ণ)" />
                  <ParamRow name="name" type="string" desc="ভোটারের নাম (আংশিক/সম্পূর্ণ)" />
                  <ParamRow name="fatherName" type="string" desc="পিতার নাম (আংশিক/সম্পূর্ণ)" />
                  <ParamRow name="motherName" type="string" desc="মাতার নাম (আংশিক/সম্পূর্ণ)" />
                  <ParamRow name="region" type="string" desc="বিভাগ" />
                  <ParamRow name="district" type="string" desc="জেলা" />
                  <ParamRow name="thana" type="string" desc="উপজেলা/থানা" />
                  <ParamRow name="cityCorp" type="string" desc="ইউনিয়ন/পৌরসভা/সিটি কর্পোরেশন" />
                  <ParamRow name="ward" type="string" desc="ওয়ার্ড নম্বর" />
                  <ParamRow name="postOffice" type="string" desc="ডাকঘরের নাম" />
                  <ParamRow name="postCode" type="string" desc="পোস্টাল কোড" />
                  <ParamRow name="voterAreaName" type="string" desc="গ্রাম/রাস্তা/ভোটার এলাকার নাম" />
                  <ParamRow name="generalAddress" type="string" desc="বাসা/হোল্ডিং/সাধারণ ঠিকানা" />
                  <ParamRow name="page" type="integer" desc="পৃষ্ঠা নম্বর (ডিফল্ট: 1)" />
                  <ParamRow name="limit" type="integer" desc="প্রতি পৃষ্ঠায় ফলাফল (ডিফল্ট: 20)" />
                </tbody>
              </table>
            </div>

            <div>
              <p className="text-sm font-semibold mb-2 font-bengali">উদাহরণ অনুরোধ:</p>
              <CodeBlock code={`GET ${searchUrl}?name=রহিম&district=ঢাকা&page=1&limit=20`} />
            </div>

            <div>
              <p className="text-sm font-semibold mb-2 font-bengali">উদাহরণ সাড়া (Response):</p>
              <CodeBlock code={`{
  "voters": [
    {
      "id": 1,
      "voterNo": "1234567890",
      "name": "মোঃ আব্দুর রহিম",
      "fatherName": "মোঃ করিম",
      "motherName": "হালিমা বেগম",
      "dob": "01/01/1980",
      "region": "ঢাকা",
      "district": "ঢাকা",
      "upazilaThana": "সাভার",
      "cityCorp": "সাভার পৌরসভা",
      "ward": "৩",
      "postOffice": "সাভার",
      "postCode": "1340",
      "voterAreaName": "সাভার বাজার",
      "generalAddress": "বাড়ি-১২, সাভার"
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 20
}`} />
            </div>
          </CardContent>
        </Card>

        {/* Endpoint 2: Public simplified */}
        <Card className="border-t-4 border-t-blue-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bengali flex items-center gap-2">
              <Badge className="bg-blue-500 text-white text-xs">GET</Badge>
              /v1/search-voter — সরলীকৃত পাবলিক API
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CodeBlock code={publicUrl} />

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-secondary/50">
                    <th className="py-2 px-3 text-xs font-semibold">প্যারামিটার</th>
                    <th className="py-2 px-3 text-xs font-semibold">ধরন</th>
                    <th className="py-2 px-3 text-xs font-semibold font-bengali">বিবরণ</th>
                  </tr>
                </thead>
                <tbody>
                  <ParamRow name="voterNo" type="string" desc="ভোটার নম্বর" />
                  <ParamRow name="name" type="string" desc="ভোটারের নাম (আংশিক)" />
                  <ParamRow name="district" type="string" desc="জেলা" />
                  <ParamRow name="thana" type="string" desc="উপজেলা/থানা" />
                </tbody>
              </table>
            </div>

            <div>
              <p className="text-sm font-semibold mb-2 font-bengali">উদাহরণ:</p>
              <CodeBlock code={`GET ${publicUrl}?voterNo=1234567890`} />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-bengali text-amber-800">⚠️ এই endpoint সর্বোচ্চ ৫০টি ফলাফল প্রদান করে। বেশি ফলাফলের জন্য <code className="font-mono">/voters/search</code> ব্যবহার করুন।</p>
            </div>
          </CardContent>
        </Card>

        {/* Get single voter */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bengali flex items-center gap-2">
              <Badge className="bg-blue-500 text-white text-xs">GET</Badge>
              /voters/:id — একক ভোটারের বিস্তারিত তথ্য
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CodeBlock code={`GET ${BASE_URL}/voters/123`} />
            <p className="text-sm font-bengali text-muted-foreground">
              একটি নির্দিষ্ট ভোটারের সম্পূর্ণ তথ্য পেতে তাদের <code className="font-mono">id</code> ব্যবহার করুন।
            </p>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-5 space-y-2">
            <p className="font-semibold font-bengali text-green-800 text-sm">📌 গুরুত্বপূর্ণ তথ্য</p>
            <ul className="space-y-1 text-sm font-bengali text-green-700 list-disc list-inside">
              <li>সব অনুসন্ধান <strong>আংশিক মিল (partial match)</strong> সমর্থন করে</li>
              <li>বাংলা এবং ইংরেজি উভয় ভাষায় অনুসন্ধান করা যাবে</li>
              <li>সব response JSON ফরম্যাটে আসে</li>
              <li>কোনো authentication প্রয়োজন নেই (public endpoints)</li>
            </ul>
          </CardContent>
        </Card>
      </main>

      <footer className="py-4 text-center text-xs text-muted-foreground border-t">
        <p className="font-bengali">© ২০২৫ বাংলাদেশ নির্বাচন কমিশন</p>
      </footer>
    </div>
  );
}

import { useRoute, Link } from "wouter";
import { useGetVoter, getGetVoterQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/navbar";

export default function VoterProfile() {
  const [, params] = useRoute("/voter/:id");
  const id = params?.id ? parseInt(params.id) : 0;

  const { data: voter, isLoading } = useGetVoter(id, {
    query: { enabled: !!id, queryKey: getGetVoterQueryKey(id) }
  });

  if (isLoading) {
    return <div className="p-10 text-center font-bengali">লোড হচ্ছে...</div>;
  }

  if (!voter) {
    return <div className="p-10 text-center font-bengali">ভোটার পাওয়া যায়নি</div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar
        leftContent={
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" className="font-bengali">← হোম</Button>
            </Link>
            <h1 className="text-xl font-bold font-bengali">ভোটার বিস্তারিত তথ্য</h1>
          </div>
        }
        menuItems={[
          { label: "🏠 হোম", href: "/" },
          { label: "🔐 অ্যাডমিন লগইন", href: "/admin/login" },
        ]}
      />

      <main className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-6">
        
        {/* Personal Details */}
        <Card className="border-t-4 border-t-primary shadow-md">
          <CardHeader className="bg-secondary/30 pb-4">
            <CardTitle className="font-bengali text-lg flex items-center gap-2">
              <span className="w-2 h-6 bg-primary rounded-full inline-block"></span>
              ব্যক্তিগত তথ্যাবলী (Personal Details)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
            <DataRow label="নাম" value={voter.name} />
            <DataRow label="ভোটার নং" value={voter.voterNo} />
            <DataRow label="পিতা" value={voter.fatherName} />
            <DataRow label="মাতা" value={voter.motherName} />
            <DataRow label="পেশা" value={voter.occupation} />
            <DataRow label="জন্ম তারিখ" value={voter.dob} />
          </CardContent>
        </Card>

        {/* Address Details */}
        <Card className="shadow-md">
          <CardHeader className="bg-secondary/30 pb-4">
            <CardTitle className="font-bengali text-lg flex items-center gap-2">
              <span className="w-2 h-6 bg-primary rounded-full inline-block"></span>
              ঠিকানা (Address Details)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
            <DataRow label="সাধারণ ঠিকানা" value={voter.generalAddress} className="md:col-span-2" />
            <DataRow label="অঞ্চল" value={voter.region} />
            <DataRow label="জেলা" value={voter.district} />
            <DataRow label="উপজেলা/থানা" value={voter.upazilaThana} />
            <DataRow label="সিটি কর্পোরেশন/পৌরসভা" value={voter.cityCorp} />
            <DataRow label="ডাকঘর" value={voter.postOffice} />
            <DataRow label="পোস্ট কোড" value={voter.postCode} />
          </CardContent>
        </Card>

        {/* Voter Area Details */}
        <Card className="shadow-md">
          <CardHeader className="bg-secondary/30 pb-4">
            <CardTitle className="font-bengali text-lg flex items-center gap-2">
              <span className="w-2 h-6 bg-primary rounded-full inline-block"></span>
              ভোটার এলাকা (Voter Area Details)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
            <DataRow label="ভোটার এলাকার নাম" value={voter.voterAreaName} className="md:col-span-2" />
            <DataRow label="ভোটার এলাকার নম্বর" value={voter.voterAreaNumber} />
            <DataRow label="এলাকা কোড" value={voter.areaCode} />
            <DataRow label="ওয়ার্ড" value={voter.ward} />
          </CardContent>
        </Card>

      </main>
    </div>
  );
}

function DataRow({ label, value, className = "" }: { label: string, value?: string | null, className?: string }) {
  return (
    <div className={`flex flex-col border-b border-border/50 pb-2 ${className}`}>
      <span className="text-xs text-muted-foreground font-bengali mb-1">{label}</span>
      <span className="text-base font-medium font-bengali text-foreground">{value || "---"}</span>
    </div>
  );
}

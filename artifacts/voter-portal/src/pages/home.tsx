import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const searchSchema = z.object({
  voterNo: z.string().optional(),
  name: z.string().optional(),
  district: z.string().optional(),
});

export default function Home() {
  const [, setLocation] = useLocation();

  const form = useForm<z.infer<typeof searchSchema>>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      voterNo: "",
      name: "",
      district: "",
    },
  });

  function onSubmit(values: z.infer<typeof searchSchema>) {
    const params = new URLSearchParams();
    if (values.voterNo) params.set("voterNo", values.voterNo);
    if (values.name) params.set("name", values.name);
    if (values.district) params.set("district", values.district);
    
    setLocation(`/search?${params.toString()}`);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card py-4 px-6 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">
            BD
          </div>
          <h1 className="text-xl font-bold text-foreground">বাংলাদেশ ভোটার পোর্টাল</h1>
        </div>
        <Link href="/admin/login">
          <Button variant="outline" className="font-bengali">অ্যাডমিন লগইন</Button>
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-xl w-full space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-primary font-bengali">ভোটার তথ্য অনুসন্ধান</h2>
            <p className="text-muted-foreground font-bengali">আপনার ভোটার নম্বর বা নাম দিয়ে সহজেই তথ্য খুঁজুন</p>
          </div>

          <div className="bg-card p-6 rounded-xl border shadow-sm">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="voterNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bengali">ভোটার নম্বর (Voter No)</FormLabel>
                      <FormControl>
                        <Input placeholder="ভোটার নম্বর লিখুন..." {...field} className="font-bengali" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground font-bengali">অথবা</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bengali">নাম (Name)</FormLabel>
                        <FormControl>
                          <Input placeholder="নাম লিখুন..." {...field} className="font-bengali" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="district"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bengali">জেলা (District)</FormLabel>
                        <FormControl>
                          <Input placeholder="জেলা..." {...field} className="font-bengali" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" className="w-full font-bengali text-lg py-6 bg-primary hover:bg-primary/90 text-primary-foreground">
                  অনুসন্ধান করুন
                </Button>
              </form>
            </Form>
          </div>
        </div>
      </main>
      
      <footer className="py-6 text-center text-sm text-muted-foreground border-t bg-card">
        <p className="font-bengali">© ২০২৫ বাংলাদেশ নির্বাচন কমিশন। সর্বস্বত্ব সংরক্ষিত।</p>
      </footer>
    </div>
  );
}

import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useListUploads, getListUploadsQueryKey } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRef, useState, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const ACCEPTED = [".zip", ".pdf", ".xlsx", ".xls", ".docx", ".doc", ".csv"];

const STATUS_COLORS: Record<string, string> = {
  done: "bg-green-100 text-green-800",
  processing: "bg-blue-100 text-blue-800",
  pending: "bg-yellow-100 text-yellow-800",
  failed: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  done: "সম্পন্ন",
  processing: "প্রক্রিয়াকরণ",
  pending: "অপেক্ষামান",
  failed: "ব্যর্থ",
};

interface UploadingFile {
  name: string;
  size: number;
  progress: "uploading" | "processing" | "done" | "failed";
  jobId?: number;
  processed?: number;
  failed?: number;
  error?: string;
}

export default function AdminUpload() {
  const { data: uploads, isLoading } = useListUploads({
    query: { refetchInterval: 3000 }, // Poll every 3s for live status
  });
  const [dropping, setDropping] = useState(false);
  const [activeUploads, setActiveUploads] = useState<UploadingFile[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const pollTimers = useRef<Record<number, ReturnType<typeof setInterval>>>({});

  // Poll a specific job until it finishes
  const pollJob = useCallback((jobId: number, fileName: string) => {
    if (pollTimers.current[jobId]) return;
    pollTimers.current[jobId] = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/uploads/${jobId}`);
        if (!res.ok) return;
        const job = await res.json();
        setActiveUploads((prev) =>
          prev.map((u) =>
            u.jobId === jobId
              ? {
                  ...u,
                  progress: job.status === "done" ? "done" : job.status === "failed" ? "failed" : "processing",
                  processed: job.recordsProcessed,
                  failed: job.recordsFailed,
                  error: job.errorMessage,
                }
              : u,
          ),
        );
        if (job.status === "done" || job.status === "failed") {
          clearInterval(pollTimers.current[jobId]);
          delete pollTimers.current[jobId];
          queryClient.invalidateQueries({ queryKey: getListUploadsQueryKey() });
          if (job.status === "done") {
            toast({
              title: `${fileName} — আমদানি সম্পন্ন`,
              description: `${job.recordsProcessed ?? 0} রেকর্ড সফলভাবে যোগ হয়েছে`,
            });
          } else {
            toast({
              title: `${fileName} — ব্যর্থ`,
              description: job.errorMessage ?? "অজানা ত্রুটি",
              variant: "destructive",
            });
          }
        }
      } catch {
        // ignore transient errors
      }
    }, 2000);
  }, [queryClient, toast]);

  useEffect(() => {
    return () => {
      Object.values(pollTimers.current).forEach(clearInterval);
    };
  }, []);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    // Validate extensions
    const invalid = fileArray.filter(
      (f) => !ACCEPTED.some((ext) => f.name.toLowerCase().endsWith(ext)),
    );
    if (invalid.length > 0) {
      toast({
        title: "ফাইল সমর্থিত নয়",
        description: `${invalid.map((f) => f.name).join(", ")} — শুধু ZIP, PDF, XLSX, DOCX, CSV সমর্থিত`,
        variant: "destructive",
      });
      return;
    }

    // Add to active list immediately
    const newUploads: UploadingFile[] = fileArray.map((f) => ({
      name: f.name,
      size: f.size,
      progress: "uploading",
    }));
    setActiveUploads((prev) => [...newUploads, ...prev]);

    // Upload each file individually
    for (const file of fileArray) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch("/api/admin/upload", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          setActiveUploads((prev) =>
            prev.map((u) =>
              u.name === file.name && u.progress === "uploading"
                ? { ...u, progress: "processing", jobId: data.jobId }
                : u,
            ),
          );
          pollJob(data.jobId, file.name);
        } else {
          const err = await res.json().catch(() => ({ error: "অজানা ত্রুটি" }));
          setActiveUploads((prev) =>
            prev.map((u) =>
              u.name === file.name && u.progress === "uploading"
                ? { ...u, progress: "failed", error: err.error }
                : u,
            ),
          );
        }
      } catch {
        setActiveUploads((prev) =>
          prev.map((u) =>
            u.name === file.name && u.progress === "uploading"
              ? { ...u, progress: "failed", error: "নেটওয়ার্ক ত্রুটি" }
              : u,
          ),
        );
      }
    }
  }, [pollJob, toast]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDropping(false);
      uploadFiles(e.dataTransfer.files);
    },
    [uploadFiles],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDropping(true);
  };

  const handleDragLeave = () => setDropping(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(e.target.files);
    e.target.value = "";
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const progressIcon = (p: UploadingFile["progress"]) => {
    if (p === "uploading") return (
      <svg className="animate-spin w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
    );
    if (p === "processing") return (
      <svg className="animate-spin w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
    );
    if (p === "done") return (
      <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
      </svg>
    );
    return (
      <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
      </svg>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">ফাইল আপলোড</h1>
          <p className="text-muted-foreground mt-1">
            ভোটার তথ্য সহ ZIP, PDF, XLSX, DOCX, CSV ফাইল আপলোড করুন — বাংলা এনকোডিং স্বয়ংক্রিয়ভাবে সংশোধন হবে।
          </p>
        </div>

        {/* Drop zone */}
        <Card
          className={`border-2 border-dashed transition-colors cursor-pointer ${
            dropping ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
        >
          <CardContent className="flex flex-col items-center justify-center py-16 text-center select-none">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
              </svg>
            </div>
            <p className="text-lg font-semibold text-foreground mb-1">
              {dropping ? "এখানে ছেড়ে দিন" : "ফাইল টেনে এখানে ছাড়ুন অথবা ক্লিক করুন"}
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              একসাথে একাধিক ফাইল আপলোড করা যাবে · সর্বোচ্চ ৫০০ MB প্রতি ফাইল
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {["ZIP", "PDF", "XLSX", "XLS", "DOCX", "DOC", "CSV"].map((ext) => (
                <span key={ext} className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                  .{ext}
                </span>
              ))}
            </div>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              multiple
              accept={ACCEPTED.join(",")}
              onChange={handleInputChange}
            />
          </CardContent>
        </Card>

        {/* Active uploads */}
        {activeUploads.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">বর্তমান আপলোড</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ফাইল</TableHead>
                    <TableHead>আকার</TableHead>
                    <TableHead>অবস্থা</TableHead>
                    <TableHead>প্রক্রিয়াকৃত</TableHead>
                    <TableHead>ব্যর্থ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeUploads.map((u, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium max-w-xs truncate">{u.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatSize(u.size)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {progressIcon(u.progress)}
                          <span className="text-sm capitalize">
                            {u.progress === "uploading" ? "আপলোড হচ্ছে..." :
                             u.progress === "processing" ? "প্রক্রিয়াকরণ..." :
                             u.progress === "done" ? "সম্পন্ন" : "ব্যর্থ"}
                          </span>
                        </div>
                        {u.error && <p className="text-xs text-destructive mt-1">{u.error}</p>}
                      </TableCell>
                      <TableCell>{u.processed ?? "—"}</TableCell>
                      <TableCell>{u.failed ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Upload history */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">আপলোড ইতিহাস</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ফাইলের নাম</TableHead>
                  <TableHead>অবস্থা</TableHead>
                  <TableHead>প্রক্রিয়াকৃত</TableHead>
                  <TableHead>ব্যর্থ</TableHead>
                  <TableHead>তারিখ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      লোড হচ্ছে...
                    </TableCell>
                  </TableRow>
                ) : !uploads || uploads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      কোনো আপলোড ইতিহাস নেই
                    </TableCell>
                  </TableRow>
                ) : (
                  uploads.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium max-w-xs truncate">{job.filename}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[job.status] ?? "bg-gray-100 text-gray-700"}`}>
                          {STATUS_LABELS[job.status] ?? job.status}
                        </span>
                        {job.errorMessage && (
                          <p className="text-xs text-destructive mt-1 max-w-xs truncate">{job.errorMessage}</p>
                        )}
                      </TableCell>
                      <TableCell className="font-mono">{job.recordsProcessed ?? "—"}</TableCell>
                      <TableCell className="font-mono">{job.recordsFailed ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {new Date(job.createdAt).toLocaleString("bn-BD")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Format guide */}
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              ফাইল ফরম্যাট গাইড
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold mb-1">CSV / XLSX (সেরা ফলাফল)</p>
                <p className="text-muted-foreground">
                  হেডার সারিতে থাকুক: ভোটার নং, নাম, পিতা, মাতা, জেলা, উপজেলা, ওয়ার্ড ইত্যাদি।
                  বাংলা বা ইংরেজি হেডার উভয়ই সমর্থিত।
                </p>
              </div>
              <div>
                <p className="font-semibold mb-1">ZIP ফাইল</p>
                <p className="text-muted-foreground">
                  ZIP-এর ভেতরে CSV, XLSX, PDF, DOCX ফাইল থাকতে পারে — সবগুলো স্বয়ংক্রিয়ভাবে প্রক্রিয়া হবে।
                </p>
              </div>
              <div>
                <p className="font-semibold mb-1">PDF / DOCX</p>
                <p className="text-muted-foreground">
                  "ভোটার নং:", "নাম:", "জেলা:" ইত্যাদি লেবেল সহ টেক্সট-ভিত্তিক ফাইল পার্স হবে।
                  স্ক্যানড ইমেজ PDF সমর্থিত নয়।
                </p>
              </div>
              <div>
                <p className="font-semibold mb-1">বিজয় এনকোডিং</p>
                <p className="text-muted-foreground">
                  পুরনো বিজয় / ANSI এনকোডিংয়ের ভাঙা বাংলা অক্ষর স্বয়ংক্রিয়ভাবে সংশোধন করা হবে।
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

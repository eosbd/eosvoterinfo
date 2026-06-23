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

const CHUNK_SIZE = 800 * 1024; // 800 KB per chunk — stays well under proxy limits

interface UploadingFile {
  name: string;
  size: number;
  progress: "uploading" | "processing" | "done" | "failed";
  jobId?: number;
  processed?: number;
  failed?: number;
  error?: string;
  chunksDone?: number;
  chunksTotal?: number;
}

interface PreviewResult {
  filename: string;
  totalRaw: number;
  totalMapped: number;
  sampleRawRows: Record<string, string>[];
  sampleMappedRows: Record<string, string>[];
  message: string;
}

const FIELD_LABELS: Record<string, string> = {
  voterNo: "ভোটার নং",
  name: "নাম",
  fatherName: "পিতা",
  motherName: "মাতা",
  district: "জেলা",
  upazilaThana: "উপজেলা/থানা",
  ward: "ওয়ার্ড",
  generalAddress: "ঠিকানা",
  occupation: "পেশা",
  dob: "জন্ম তারিখ",
  serialNo: "ক্রমিক",
  region: "অঞ্চল",
  postOffice: "ডাকঘর",
  postCode: "পোস্টকোড",
  voterAreaName: "ভোটার এলাকার নাম",
  voterAreaNumber: "ভোটার এলাকার নং",
};

export default function AdminUpload() {
  const { data: uploads, isLoading } = useListUploads({
    query: { refetchInterval: 3000 },
  });
  const [dropping, setDropping] = useState(false);
  const [activeUploads, setActiveUploads] = useState<UploadingFile[]>([]);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewInputRef = useRef<HTMLInputElement>(null);
  const pollTimers = useRef<Record<number, ReturnType<typeof setInterval>>>({});

  const pollJob = useCallback((jobId: number, fileName: string) => {
    if (pollTimers.current[jobId]) return;
    pollTimers.current[jobId] = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/uploads/${jobId}`, { credentials: "include" });
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

    const newUploads: UploadingFile[] = fileArray.map((f) => {
      const totalChunks = Math.ceil(f.size / CHUNK_SIZE) || 1;
      return { name: f.name, size: f.size, progress: "uploading", chunksDone: 0, chunksTotal: totalChunks };
    });
    setActiveUploads((prev) => [...newUploads, ...prev]);

    for (const file of fileArray) {
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE) || 1;
      const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      try {
        // Upload each chunk sequentially
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);

          const fd = new FormData();
          fd.append("uploadId", uploadId);
          fd.append("chunkIndex", String(i));
          fd.append("totalChunks", String(totalChunks));
          fd.append("chunk", chunk, file.name);

          const chunkRes = await fetch("/api/admin/upload-chunk", {
            method: "POST",
            body: fd,
            credentials: "include",
          });
          if (!chunkRes.ok) {
            const err = await chunkRes.json().catch(() => ({ error: "chunk ত্রুটি" }));
            throw new Error(err.error ?? "chunk upload failed");
          }

          setActiveUploads((prev) =>
            prev.map((u) =>
              u.name === file.name && u.progress === "uploading"
                ? { ...u, chunksDone: i + 1 }
                : u,
            ),
          );
        }

        // All chunks done — finalize
        const finalRes = await fetch("/api/admin/upload-finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId, originalname: file.name, totalChunks }),
          credentials: "include",
        });
        if (!finalRes.ok) {
          const err = await finalRes.json().catch(() => ({ error: "finalize ত্রুটি" }));
          throw new Error(err.error ?? "finalize failed");
        }
        const data = await finalRes.json();
        setActiveUploads((prev) =>
          prev.map((u) =>
            u.name === file.name && u.progress === "uploading"
              ? { ...u, progress: "processing", jobId: data.jobId }
              : u,
          ),
        );
        pollJob(data.jobId, file.name);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "নেটওয়ার্ক ত্রুটি";
        setActiveUploads((prev) =>
          prev.map((u) =>
            u.name === file.name && u.progress === "uploading"
              ? { ...u, progress: "failed", error: msg }
              : u,
          ),
        );
      }
    }
  }, [pollJob, toast]);

  const handlePreviewFile = useCallback(async (file: File) => {
    setPreview(null);
    setPreviewLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/admin/upload-preview", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "সার্ভার ত্রুটি" }));
        toast({ title: "পূর্বরূপ ব্যর্থ", description: err.error, variant: "destructive" });
        return;
      }
      const data: PreviewResult = await res.json();
      setPreview(data);
    } catch {
      toast({ title: "নেটওয়ার্ক ত্রুটি", variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  }, [toast]);

  const handleDeleteUpload = useCallback(async (id: number, filename: string) => {
    if (!confirm(`"${filename}" — এই আপলোড রেকর্ড মুছে ফেলবেন?`)) return;
    try {
      const res = await fetch(`/api/admin/uploads/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok || res.status === 204) {
        toast({ title: "আপলোড রেকর্ড মুছে ফেলা হয়েছে" });
        queryClient.invalidateQueries({ queryKey: getListUploadsQueryKey() });
      } else {
        toast({ title: "মুছতে ব্যর্থ হয়েছে", variant: "destructive" });
      }
    } catch {
      toast({ title: "নেটওয়ার্ক ত্রুটি", variant: "destructive" });
    }
  }, [queryClient, toast]);

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

  const handlePreviewInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handlePreviewFile(file);
    e.target.value = "";
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const progressIcon = (p: UploadingFile["progress"]) => {
    if (p === "uploading" || p === "processing") return (
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
            ভোটার তথ্য সহ ZIP, PDF, XLSX, DOCX, CSV ফাইল আপলোড করুন।
          </p>
        </div>

        {/* Preview Tool */}
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
              পূর্বরূপ পরীক্ষা করুন (DB-তে save হবে না)
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              আপলোড করার আগে দেখুন বাংলা ঠিকমতো extract হচ্ছে কিনা।
            </p>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="border-amber-300 hover:bg-amber-100"
              onClick={() => previewInputRef.current?.click()}
              disabled={previewLoading}
            >
              {previewLoading ? (
                <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              )}
              {previewLoading ? "প্রক্রিয়াকরণ হচ্ছে..." : "ফাইল বেছে পূর্বরূপ দেখুন"}
            </Button>
            <input
              ref={previewInputRef}
              type="file"
              className="hidden"
              accept={ACCEPTED.join(",")}
              onChange={handlePreviewInputChange}
            />

            {preview && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-semibold text-sm">{preview.filename}</span>
                  <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-semibold">
                    {preview.totalRaw} টি রো পাওয়া গেছে
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">
                    {preview.totalMapped} টি রেকর্ড ম্যাপ হয়েছে
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{preview.message}</p>

                {preview.sampleMappedRows.length > 0 && (
                  <div className="overflow-x-auto rounded border border-amber-200">
                    <table className="w-full text-sm">
                      <thead className="bg-amber-100/60">
                        <tr>
                          {Object.keys(preview.sampleMappedRows[0]).filter(k => preview.sampleMappedRows[0][k]).map(k => (
                            <th key={k} className="px-3 py-2 text-left font-semibold text-xs whitespace-nowrap">
                              {FIELD_LABELS[k] ?? k}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.sampleMappedRows.slice(0, 5).map((row, i) => (
                          <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-amber-50/30"}>
                            {Object.keys(preview.sampleMappedRows[0]).filter(k => preview.sampleMappedRows[0][k]).map(k => (
                              <td key={k} className="px-3 py-2 max-w-[180px] truncate" title={row[k] ?? ""}>
                                {row[k] ?? "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {preview.sampleMappedRows.length === 0 && preview.sampleRawRows.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-destructive mb-2">
                      ⚠ ম্যাপ করা যায়নি — raw data নিচে দেখুন:
                    </p>
                    <div className="overflow-x-auto rounded border border-red-200 bg-red-50/30">
                      <table className="w-full text-xs">
                        <thead className="bg-red-100/60">
                          <tr>
                            {Object.keys(preview.sampleRawRows[0]).map(k => (
                              <th key={k} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{k}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {preview.sampleRawRows.slice(0, 5).map((row, i) => (
                            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-red-50/20"}>
                              {Object.keys(preview.sampleRawRows[0]).map(k => (
                                <td key={k} className="px-3 py-2 max-w-[200px] truncate" title={row[k] ?? ""}>{row[k] ?? "—"}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

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
              একসাথে যেকোনো সংখ্যক ফাইল আপলোড করা যাবে
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
                          <span className="text-sm">
                            {u.progress === "uploading" ? (u.chunksTotal && u.chunksTotal > 1 ? `আপলোড হচ্ছে... (${u.chunksDone ?? 0}/${u.chunksTotal})` : "আপলোড হচ্ছে...") :
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
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      লোড হচ্ছে...
                    </TableCell>
                  </TableRow>
                ) : !uploads || uploads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
                      <TableCell>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleDeleteUpload(job.id, job.filename)}
                        >
                          মুছুন
                        </Button>
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
                <p className="font-semibold mb-1">PDF (বাংলাদেশ EC ভোটার তালিকা)</p>
                <p className="text-muted-foreground">
                  SutonnyMJ font-এর পুরনো EC PDF স্বয়ংক্রিয়ভাবে Unicode-এ রূপান্তর হবে।
                  স্ক্যানড ইমেজ PDF সমর্থিত নয়।
                </p>
              </div>
              <div>
                <p className="font-semibold mb-1">বিজয় / পুরনো এনকোডিং</p>
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

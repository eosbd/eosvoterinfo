import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useListUploads, getListUploadsQueryKey } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function AdminUpload() {
  const { data: uploads, isLoading } = useListUploads();
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        toast({ title: "File uploaded successfully" });
        queryClient.invalidateQueries({ queryKey: getListUploadsQueryKey() });
      } else {
        const err = await res.json();
        toast({ title: "Upload failed", description: err.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Upload failed", description: "Network error", variant: "destructive" });
    } finally {
      setUploading(false);
      if (e.target) e.target.value = ''; // reset input
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Bulk Data Upload</h1>
          <p className="text-muted-foreground mt-1">Upload JSON/Excel/CSV files to bulk import voter records.</p>
        </div>

        <Card className="border-dashed border-2 bg-muted/10">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Drag and drop file here or click to browse</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">Supports .xlsx, .csv, .json formats. Must match the predefined schema structure.</p>
            
            <div className="relative">
              <input 
                type="file" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                onChange={handleFileChange}
                disabled={uploading}
                accept=".xlsx,.csv,.json"
              />
              <Button disabled={uploading}>
                {uploading ? "Uploading..." : "Select File"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Upload History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Filename</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Processed</TableHead>
                  <TableHead>Failed</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6">Loading...</TableCell></TableRow>
                ) : uploads?.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6">No upload history</TableCell></TableRow>
                ) : (
                  uploads?.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{job.filename}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          job.status === 'completed' ? 'bg-green-100 text-green-800' :
                          job.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {job.status.toUpperCase()}
                        </span>
                        {job.errorMessage && <p className="text-xs text-destructive mt-1">{job.errorMessage}</p>}
                      </TableCell>
                      <TableCell>{job.recordsProcessed || 0}</TableCell>
                      <TableCell>{job.recordsFailed || 0}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(job.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

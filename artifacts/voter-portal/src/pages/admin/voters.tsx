import { AdminLayout } from "@/components/layout/admin-layout";
import { useListVotersAdmin, getListVotersAdminQueryKey, useDeleteVoter } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function AdminVoters() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useListVotersAdmin(
    { search, limit: 50 },
    { query: { queryKey: getListVotersAdminQueryKey({ search, limit: 50 }) } }
  );
  const deleteMutation = useDeleteVoter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this voter?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Voter deleted successfully" });
          queryClient.invalidateQueries({ queryKey: getListVotersAdminQueryKey({ search, limit: 50 }) });
        }
      });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Manage Voters</h1>
            <p className="text-muted-foreground mt-1">Search, edit, and remove voter records.</p>
          </div>
          <Button>Add New Voter</Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b">
              <Input 
                placeholder="Search by name or voter number..." 
                className="max-w-md"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Voter No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>District</TableHead>
                  <TableHead>Ward</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : data?.voters.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8">No records found</TableCell></TableRow>
                ) : (
                  data?.voters.map((voter) => (
                    <TableRow key={voter.id}>
                      <TableCell className="font-mono text-sm">{voter.voterNo}</TableCell>
                      <TableCell className="font-bengali font-medium">{voter.name}</TableCell>
                      <TableCell className="font-bengali">{voter.district}</TableCell>
                      <TableCell className="font-bengali">{voter.ward}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="sm">Edit</Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(voter.id)}>Delete</Button>
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

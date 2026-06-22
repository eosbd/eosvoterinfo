import { useState } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import {
  useListVotersAdmin,
  getListVotersAdminQueryKey,
  useDeleteVoter,
  useUpdateVoter,
  useCreateVoter,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface VoterFormData {
  voterNo: string;
  name: string;
  fatherName: string;
  motherName: string;
  occupation: string;
  dob: string;
  generalAddress: string;
  district: string;
  upazilaThana: string;
  postOffice: string;
  ward: string;
  serialNo: string;
}

const EMPTY_FORM: VoterFormData = {
  voterNo: "", name: "", fatherName: "", motherName: "",
  occupation: "", dob: "", generalAddress: "", district: "",
  upazilaThana: "", postOffice: "", ward: "", serialNo: "",
};

function VoterFormFields({
  data,
  onChange,
}: {
  data: VoterFormData;
  onChange: (field: keyof VoterFormData, value: string) => void;
}) {
  const field = (
    key: keyof VoterFormData,
    label: string,
    placeholder = "",
    required = false,
  ) => (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}{required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input
        value={data[key]}
        onChange={(e) => onChange(key, e.target.value)}
        placeholder={placeholder}
        className="font-bengali h-8 text-sm"
        required={required}
      />
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-3">
      {field("voterNo", "ভোটার নং", "৬৭১১৮৫...", true)}
      {field("serialNo", "ক্রমিক নং", "০০১")}
      {field("name", "নাম", "মোঃ...", true)}
      {field("fatherName", "পিতার নাম", "পিতার নাম...")}
      {field("motherName", "মাতার নাম", "মাতার নাম...")}
      {field("occupation", "পেশা", "ব্যবসা, চাকরি...")}
      {field("dob", "জন্ম তারিখ", "DD/MM/YYYY")}
      {field("district", "জেলা", "নারায়ণগঞ্জ")}
      {field("upazilaThana", "উপজেলা/থানা", "নারায়ণগঞ্জ সদর")}
      {field("postOffice", "ডাকঘর", "নারায়নগঞ্জ")}
      {field("ward", "ওয়ার্ড", "১১")}
      <div className="col-span-2 space-y-1">
        <Label className="text-xs font-medium text-muted-foreground">ঠিকানা</Label>
        <Input
          value={data.generalAddress}
          onChange={(e) => onChange("generalAddress", e.target.value)}
          placeholder="সম্পূর্ণ ঠিকানা..."
          className="font-bengali h-8 text-sm"
        />
      </div>
    </div>
  );
}

const PAGE_SIZE = 50;

export default function AdminVoters() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [editVoter, setEditVoter] = useState<{ id: number } & VoterFormData | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<VoterFormData>(EMPTY_FORM);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const queryParams = { search, limit: PAGE_SIZE, page };
  const { data, isLoading } = useListVotersAdmin(
    queryParams,
    { query: { queryKey: getListVotersAdminQueryKey(queryParams) } },
  );

  const deleteMutation = useDeleteVoter();
  const updateMutation = useUpdateVoter();
  const createMutation = useCreateVoter();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListVotersAdminQueryKey(queryParams) });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  function openEdit(voter: NonNullable<typeof data>["voters"][number]) {
    setEditVoter({
      id: voter.id,
      voterNo: voter.voterNo ?? "",
      name: voter.name ?? "",
      fatherName: voter.fatherName ?? "",
      motherName: voter.motherName ?? "",
      occupation: voter.occupation ?? "",
      dob: voter.dob ?? "",
      generalAddress: voter.generalAddress ?? "",
      district: voter.district ?? "",
      upazilaThana: voter.upazilaThana ?? "",
      postOffice: voter.postOffice ?? "",
      ward: voter.ward ?? "",
      serialNo: voter.serialNo ?? "",
    });
  }

  function handleDelete(id: number, name: string) {
    if (confirm(`"${name}" — এই ভোটারের তথ্য মুছে ফেলবেন?`)) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "ভোটার রেকর্ড মুছে ফেলা হয়েছে" });
          invalidate();
        },
        onError: () => toast({ title: "মুছতে ব্যর্থ হয়েছে", variant: "destructive" }),
      });
    }
  }

  function handleEditSave() {
    if (!editVoter) return;
    const { id, ...fields } = editVoter;
    updateMutation.mutate({ id, data: fields }, {
      onSuccess: () => {
        toast({ title: "ভোটার তথ্য আপডেট হয়েছে" });
        setEditVoter(null);
        invalidate();
      },
      onError: () => toast({ title: "আপডেট ব্যর্থ হয়েছে", variant: "destructive" }),
    });
  }

  function handleAddSave() {
    if (!addForm.name || !addForm.voterNo) {
      toast({ title: "নাম ও ভোটার নং আবশ্যিক", variant: "destructive" });
      return;
    }
    createMutation.mutate(addForm, {
      onSuccess: () => {
        toast({ title: "নতুন ভোটার যোগ হয়েছে" });
        setShowAdd(false);
        setAddForm(EMPTY_FORM);
        invalidate();
      },
      onError: () => toast({ title: "যোগ করতে ব্যর্থ হয়েছে", variant: "destructive" }),
    });
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">ভোটার পরিচালনা</h1>
            <p className="text-muted-foreground mt-1 font-bengali">
              ভোটার রেকর্ড খুঁজুন, সম্পাদনা করুন ও মুছুন।
              {data?.total != null && (
                <span className="ml-2 text-primary font-semibold">মোট: {data.total.toLocaleString("bn-BD")}</span>
              )}
            </p>
          </div>
          <Button onClick={() => { setAddForm(EMPTY_FORM); setShowAdd(true); }} className="font-bengali">
            + নতুন ভোটার যোগ
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b flex gap-3 items-center">
              <Input
                placeholder="নাম বা ভোটার নং দিয়ে খুঁজুন..."
                className="max-w-sm font-bengali"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
              {search && (
                <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setPage(1); }}>
                  ✕ Clear
                </Button>
              )}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>ভোটার নং</TableHead>
                  <TableHead>নাম</TableHead>
                  <TableHead>পিতা</TableHead>
                  <TableHead>জেলা</TableHead>
                  <TableHead>পেশা</TableHead>
                  <TableHead className="text-right w-36">কার্যক্রম</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground font-bengali">
                      লোড হচ্ছে...
                    </TableCell>
                  </TableRow>
                ) : data?.voters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground font-bengali">
                      কোনো রেকর্ড পাওয়া যায়নি
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.voters.map((voter, idx) => (
                    <TableRow key={voter.id} className="hover:bg-muted/30">
                      <TableCell className="text-xs text-muted-foreground font-bengali">
                        {((page - 1) * PAGE_SIZE + idx + 1).toLocaleString("bn-BD")}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{voter.voterNo}</TableCell>
                      <TableCell className="font-bengali font-semibold max-w-[140px] truncate">{voter.name}</TableCell>
                      <TableCell className="font-bengali text-sm text-muted-foreground max-w-[120px] truncate">{voter.fatherName}</TableCell>
                      <TableCell className="font-bengali text-sm">{voter.district}</TableCell>
                      <TableCell className="font-bengali text-sm text-muted-foreground">{voter.occupation}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => openEdit(voter)}
                          >
                            সম্পাদনা
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-7 px-2 text-xs font-bengali"
                            onClick={() => handleDelete(voter.id, voter.name ?? "")}
                          >
                            মুছুন
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {data && data.total > PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-muted-foreground font-bengali">
                  পৃষ্ঠা {page} / {totalPages} — মোট {data.total.toLocaleString("bn-BD")} রেকর্ড
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    ← পূর্ববর্তী
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    পরবর্তী →
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editVoter} onOpenChange={(open) => !open && setEditVoter(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-bengali">ভোটার তথ্য সম্পাদনা</DialogTitle>
          </DialogHeader>
          {editVoter && (
            <VoterFormFields
              data={editVoter}
              onChange={(field, value) =>
                setEditVoter((prev) => prev ? { ...prev, [field]: value } : prev)
              }
            />
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditVoter(null)} className="font-bengali">বাতিল</Button>
            <Button
              onClick={handleEditSave}
              disabled={updateMutation.isPending}
              className="font-bengali"
            >
              {updateMutation.isPending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-bengali">নতুন ভোটার যোগ করুন</DialogTitle>
          </DialogHeader>
          <VoterFormFields
            data={addForm}
            onChange={(field, value) => setAddForm((prev) => ({ ...prev, [field]: value }))}
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAdd(false)} className="font-bengali">বাতিল</Button>
            <Button
              onClick={handleAddSave}
              disabled={createMutation.isPending}
              className="font-bengali"
            >
              {createMutation.isPending ? "যোগ হচ্ছে..." : "যোগ করুন"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

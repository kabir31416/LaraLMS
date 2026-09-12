import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Pencil, Trash2, MoreVertical, UserPlus, Search } from "lucide-react";
import { useStaff } from "@/contexts/StaffContext";
import { STAFF_TYPES, STAFF_TYPE_LABELS, type Staff } from "@/types/staff";
import { StaffForm } from "@/components/staff/StaffForm";
import { toast } from "sonner";
import { ApiClientError } from "@/contexts/AuthContext";

const StaffPage = () => {
  const { staff, deleteStaff } = useStaff();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editStaff, setEditStaff] = useState<Staff | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return staff.filter((s) => {
      const matchSearch = !q || s.name.toLowerCase().includes(q) || s.mobile.includes(q) || (s.email || "").toLowerCase().includes(q);
      const matchType = type === "all" || s.staffType === type;
      return matchSearch && matchType;
    });
  }, [staff, search, type]);

  const handleEdit = (s: Staff) => { setEditStaff(s); setOpen(true); };
  const handleDelete = async (id: string) => {
    try {
      await deleteStaff(id);
      toast.success("স্টাফ মুছে ফেলা হয়েছে");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "মুছতে ব্যর্থ হয়েছে");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">স্টাফ ম্যানেজমেন্ট</h1>
            <p className="text-sm text-muted-foreground">মোট {staff.length} জন স্টাফ</p>
          </div>
          <Button onClick={() => { setEditStaff(null); setOpen(true); }}>
            <UserPlus className="mr-2 h-4 w-4" /> নতুন স্টাফ
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="নাম, মোবাইল বা ইমেইল..." className="pl-9" />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="স্টাফ টাইপ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সকল টাইপ</SelectItem>
              {STAFF_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{STAFF_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card className="border-none shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">ছবি</TableHead>
                  <TableHead>নাম</TableHead>
                  <TableHead>টাইপ</TableHead>
                  <TableHead>মোবাইল</TableHead>
                  <TableHead className="hidden md:table-cell">ইমেইল</TableHead>
                  <TableHead className="text-right">বেতন</TableHead>
                  <TableHead>যোগদান</TableHead>
                  <TableHead>স্ট্যাটাস</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-10">কোনো স্টাফ পাওয়া যায়নি</TableCell></TableRow>
                ) : (
                  filtered.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{s.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{STAFF_TYPE_LABELS[s.staffType]}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{s.mobile}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{s.email || "—"}</TableCell>
                      <TableCell className="text-right">৳ {s.salary.toLocaleString("bn-BD")}</TableCell>
                      <TableCell className="text-sm">{s.joinDate}</TableCell>
                      <TableCell>
                        <Badge className={s.status === "সক্রিয়" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}>
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(s)}><Pencil className="mr-2 h-4 w-4" /> সম্পাদনা</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(s.id)}>
                              <Trash2 className="mr-2 h-4 w-4" /> মুছে ফেলুন
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        <StaffForm open={open} onOpenChange={setOpen} editStaff={editStaff} />
      </div>
    </DashboardLayout>
  );
};

export default StaffPage;

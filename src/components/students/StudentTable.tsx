import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Student } from "@/types/student";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Eye, Pencil, Trash2, MoreVertical, KeyRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useBatches } from "@/contexts/BatchContext";
import { useStaff } from "@/contexts/StaffContext";
import { api } from "@/lib/apiClient";
import { ApiClientError } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface StudentTableProps {
  students: Student[];
  onEdit: (student: Student) => void;
  onDelete: (id: string) => void;
}

export function StudentTable({ students, onEdit, onDelete }: StudentTableProps) {
  const navigate = useNavigate();
  const { batches } = useBatches();
  const { getStaff } = useStaff();
  const getBatchByStudent = (studentBatchId?: string) => batches.find((b) => b.id === studentBatchId);
  const [creatingLoginId, setCreatingLoginId] = useState<string | null>(null);

  // Login credential convention for the Student Portal: identifier = phone
  // number, password = Roll Number — both already assigned during
  // admission, so no separate credential needs to be communicated.
  //
  // If a login already exists for this student (e.g. it was created
  // earlier and the Roll Number has since changed, leaving a stale
  // password), this resets it to match the student's current mobile/roll
  // number instead of just failing with "already exists" — that was a real
  // bug: the button could only create, never fix, a login.
  const handleCreateLogin = async (student: Student) => {
    if (!student.mobile || !student.rollNumber) {
      toast.error("লগইন তৈরির জন্য মোবাইল নম্বর ও রোল নম্বর থাকা আবশ্যক");
      return;
    }
    setCreatingLoginId(student.id);
    try {
      const existing = await api.get<{ _id: string }[]>(`/users?linkedStudentId=${student.id}&limit=1`);
      if (existing.length > 0) {
        await api.patch(`/users/${existing[0]._id}/reset-credentials`, {
          identifier: student.mobile,
          password: student.rollNumber,
        });
        toast.success(
          `লগইন আপডেট হয়েছে — মোবাইল: ${student.mobile}, পাসওয়ার্ড: ${student.rollNumber}`,
          { duration: 15000 },
        );
        return;
      }

      const roles = await api.get<{ _id: string; name: string }[]>("/roles");
      const studentRoleId = roles.find((r) => r.name === "student")?._id;
      if (!studentRoleId) {
        toast.error("Student role খুঁজে পাওয়া যায়নি");
        return;
      }
      await api.post("/users", {
        identifier: student.mobile,
        password: student.rollNumber,
        roleId: studentRoleId,
        linkedStudentId: student.id,
      });
      toast.success(
        `লগইন তৈরি হয়েছে — মোবাইল: ${student.mobile}, পাসওয়ার্ড: ${student.rollNumber}`,
        { duration: 15000 },
      );
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "CONFLICT") {
        toast.error("এই মোবাইল নম্বরে অন্য একটি অ্যাকাউন্ট আগে থেকেই আছে");
      } else {
        toast.error(err instanceof ApiClientError ? err.message : "লগইন তৈরি/আপডেট ব্যর্থ হয়েছে");
      }
    } finally {
      setCreatingLoginId(null);
    }
  };

  if (students.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        কোনো শিক্ষার্থী পাওয়া যায়নি
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]">ছবি</TableHead>
            <TableHead>আইডি</TableHead>
            <TableHead>রোল</TableHead>
            <TableHead>নাম</TableHead>
            <TableHead className="hidden lg:table-cell">ব্যাচ</TableHead>
            <TableHead className="hidden lg:table-cell">সময়</TableHead>
            <TableHead className="hidden md:table-cell">রুম</TableHead>
            <TableHead className="hidden xl:table-cell">ডিরেক্টর</TableHead>
            <TableHead>মোবাইল</TableHead>
            <TableHead className="text-right">বকেয়া</TableHead>
            <TableHead>স্ট্যাটাস</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((student) => {
            const batch = getBatchByStudent(student.batchId);
            const directorName = batch?.directorId ? getStaff(batch.directorId)?.name : undefined;
            return (
              <TableRow
                key={student.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => navigate(`/students/${student.id}`)}
              >
                <TableCell>
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {student.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {student.studentId}
                </TableCell>
                <TableCell className="font-mono text-xs">{student.rollNumber || "—"}</TableCell>
                <TableCell className="font-medium">{student.name}</TableCell>
                <TableCell className="hidden lg:table-cell text-xs">
                  {batch ? batch.name : <span className="text-muted-foreground italic">Batch assigned হয়নি</span>}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{batch?.batchTime || "—"}</TableCell>
                <TableCell className="hidden md:table-cell text-sm">{batch?.roomNumber || "—"}</TableCell>
                <TableCell className="hidden xl:table-cell text-sm">{directorName || "—"}</TableCell>
                <TableCell className="text-sm">{student.mobile}</TableCell>
                <TableCell className="text-right">
                  {student.due > 0 ? (
                    <span className="text-destructive font-semibold text-sm">৳ {student.due.toLocaleString("bn-BD")}</span>
                  ) : (
                    <span className="text-success text-sm">পরিশোধিত</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={student.status === "সক্রিয়" ? "default" : "secondary"}
                    className={
                      student.status === "সক্রিয়"
                        ? "bg-success/10 text-success border-success/20 hover:bg-success/20"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {student.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/students/${student.id}`); }}>
                        <Eye className="mr-2 h-4 w-4" /> প্রোফাইল দেখুন
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(student); }}>
                        <Pencil className="mr-2 h-4 w-4" /> সম্পাদনা
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={creatingLoginId === student.id}
                        onClick={(e) => { e.stopPropagation(); handleCreateLogin(student); }}
                      >
                        <KeyRound className="mr-2 h-4 w-4" />
                        {creatingLoginId === student.id ? "প্রসেস হচ্ছে..." : "লগইন তৈরি/রিসেট করুন"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => { e.stopPropagation(); onDelete(student.id); }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> মুছে ফেলুন
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

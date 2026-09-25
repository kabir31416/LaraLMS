import { useNavigate } from "react-router-dom";
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
import { Eye, Pencil, Trash2, MoreVertical, ImageUp, Check, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useBatches } from "@/contexts/BatchContext";

interface StudentTableProps {
  students: Student[];
  onEdit: (student: Student) => void;
  onDelete: (id: string) => void;
  onUploadPhoto: (student: Student) => void;
  /** Student Entry Workflow — omitted entirely (rather than shown disabled) when the caller has no STUDENTS_APPROVE_ENTRY permission, same "hide, don't disable" convention as the rest of this menu. */
  onApprove?: (student: Student) => void;
  onReject?: (student: Student) => void;
}

/** dd MMM yyyy from a "yyyy-mm-dd" dob string, without pulling in date-fns just for this — malformed/absent values fall back to "—". */
function formatDob(dob?: string): string {
  if (!dob) return "—";
  const parts = dob.split("-");
  if (parts.length !== 3) return dob;
  const [y, m, d] = parts;
  const MONTHS = ["জানু", "ফেব্রু", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্ট", "অক্টো", "নভে", "ডিসে"];
  const monthIdx = Number(m) - 1;
  if (Number.isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) return dob;
  return `${Number(d)} ${MONTHS[monthIdx]} ${y}`;
}

export function StudentTable({ students, onEdit, onDelete, onUploadPhoto, onApprove, onReject }: StudentTableProps) {
  const navigate = useNavigate();
  const { batches } = useBatches();
  const getBatchByStudent = (studentBatchId?: string) => batches.find((b) => b.id === studentBatchId);

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
            <TableHead>রেজিস্ট্রেশন নম্বর</TableHead>
            <TableHead>নাম</TableHead>
            <TableHead className="hidden lg:table-cell">ব্যাচ</TableHead>
            <TableHead>মোবাইল</TableHead>
            <TableHead className="hidden md:table-cell">অভিভাবকের নম্বর</TableHead>
            <TableHead className="hidden xl:table-cell">জন্মতারিখ</TableHead>
            <TableHead className="text-right">বকেয়া</TableHead>
            <TableHead>স্ট্যাটাস</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((student) => {
            const batch = getBatchByStudent(student.batchId);
            return (
              <TableRow
                key={student.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => navigate(`/students/${student.id}`)}
              >
                <TableCell>
                  <Avatar className="h-9 w-9">
                    {student.photo && <AvatarImage src={student.photo} alt={student.name} className="object-cover" />}
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
                <TableCell className="text-sm">{student.mobile}</TableCell>
                <TableCell className="hidden md:table-cell text-sm">{student.guardianMobile || "—"}</TableCell>
                <TableCell className="hidden xl:table-cell text-sm">{formatDob(student.dob)}</TableCell>
                <TableCell className="text-right">
                  {student.due > 0 ? (
                    <span className="text-destructive font-semibold text-sm">৳ {student.due.toLocaleString("bn-BD")}</span>
                  ) : (
                    <span className="text-success text-sm">পরিশোধিত</span>
                  )}
                </TableCell>
                <TableCell>
                  {student.admissionStatus === "pending" ? (
                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">পেন্ডিং</Badge>
                  ) : (
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
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {student.admissionStatus === "pending" && onApprove && (
                        <DropdownMenuItem
                          className="text-success focus:text-success"
                          onClick={(e) => { e.stopPropagation(); onApprove(student); }}
                        >
                          <Check className="mr-2 h-4 w-4" /> অনুমোদন করুন
                        </DropdownMenuItem>
                      )}
                      {student.admissionStatus === "pending" && onReject && (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onReject(student); }}>
                          <X className="mr-2 h-4 w-4" /> বাতিল করুন
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/students/${student.id}`); }}>
                        <Eye className="mr-2 h-4 w-4" /> প্রোফাইল দেখুন
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(student); }}>
                        <Pencil className="mr-2 h-4 w-4" /> সম্পাদনা
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUploadPhoto(student); }}>
                        <ImageUp className="mr-2 h-4 w-4" /> ছবি আপলোড
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

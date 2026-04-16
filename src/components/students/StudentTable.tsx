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
import { Eye, Pencil, Trash2, MoreVertical } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface StudentTableProps {
  students: Student[];
  onEdit: (student: Student) => void;
  onDelete: (id: string) => void;
}

export function StudentTable({ students, onEdit, onDelete }: StudentTableProps) {
  const navigate = useNavigate();

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
            <TableHead>নাম</TableHead>
            <TableHead className="hidden md:table-cell">শ্রেণি</TableHead>
            <TableHead className="hidden lg:table-cell">কোর্স</TableHead>
            <TableHead className="hidden lg:table-cell">ব্যাচ</TableHead>
            <TableHead>মোবাইল</TableHead>
            <TableHead className="text-right">বকেয়া</TableHead>
            <TableHead>স্ট্যাটাস</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((student) => (
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
              <TableCell className="font-medium">{student.name}</TableCell>
              <TableCell className="hidden md:table-cell">{student.class}</TableCell>
              <TableCell className="hidden lg:table-cell">{student.course}</TableCell>
              <TableCell className="hidden lg:table-cell text-xs">{student.batch}</TableCell>
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
                      className="text-destructive focus:text-destructive"
                      onClick={(e) => { e.stopPropagation(); onDelete(student.id); }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> মুছে ফেলুন
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

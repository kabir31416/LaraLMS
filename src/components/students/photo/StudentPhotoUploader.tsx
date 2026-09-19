import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, ImageUp, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { CameraCapture } from "./CameraCapture";
import { PhotoCropper } from "./PhotoCropper";
import { loadImageFromBlob } from "@/lib/imageProcessing";
import { validatePhoto, FACE_VALIDATION_MESSAGES } from "@/lib/faceValidation";
import { ApiClientError } from "@/lib/apiClient";

const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 15 * 1024 * 1024; // generous pre-crop limit — the actual upload is always a compressed ~500px file regardless of the original's size

interface StudentPhotoUploaderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName: string;
  currentPhotoUrl?: string | null;
  onUpload: (blob: Blob) => Promise<void>;
  /** Present only where the caller allows removing a photo outright (Admin) — the Student Portal/public entry flows only ever replace, never blank out. */
  onRemove?: () => Promise<void>;
}

/**
 * The single entry point for Student Photo Management's whole client-side
 * pipeline (Camera/Gallery → Face Validation → Crop → Compress → Upload) —
 * reused as-is by the Admin Student Profile/List, the Student Portal's own
 * profile, and the public /studententry page. Each caller only supplies
 * `onUpload`/`onRemove`, which decide which API endpoint the resulting blob
 * actually goes to (Admin's /students/:id/photo, the portal's /students/me/photo,
 * or the public entry's token-scoped /public/student-entry/photo) — this
 * component never knows or cares which one it's talking to.
 */
export function StudentPhotoUploader({ open, onOpenChange, studentName, currentPhotoUrl, onUpload, onRemove }: StudentPhotoUploaderProps) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSource, setCropSource] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setCameraOpen(false);
      setCropOpen(false);
      setCropSource(null);
      setBusy(false);
    }
  }, [open]);

  const mainDialogOpen = open && !cameraOpen && !cropOpen;

  const handleGalleryPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the exact same file later
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("শুধুমাত্র JPG, PNG বা WEBP ছবি আপলোড করা যাবে।");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("ছবির আকার অনেক বড়। ছোট আকারের ছবি ব্যবহার করুন।");
      return;
    }
    if (file.size === 0) {
      toast.error("ফাইলটি খালি — সঠিক ছবি নির্বাচন করুন।");
      return;
    }
    setCropSource(file);
    setCropOpen(true);
  };

  /** Shared by both the camera and gallery paths — runs the real face+quality gate, then hands off to the caller's onUpload. */
  const validateAndUpload = async (blob: Blob, onInvalid: () => void) => {
    setBusy(true);
    try {
      const img = await loadImageFromBlob(blob);
      const result = await validatePhoto(img);
      if (!result.ok) {
        toast.error(result.reason ? FACE_VALIDATION_MESSAGES[result.reason] : "ছবিটি ব্যবহারযোগ্য নয়।");
        onInvalid();
        return;
      }
      await onUpload(blob);
      toast.success("✓ প্রোফাইল ছবি সফলভাবে আপডেট হয়েছে");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "ছবি আপলোড ব্যর্থ হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setBusy(false);
    }
  };

  const handleCameraCapture = (blob: Blob) => {
    setCameraOpen(false);
    void validateAndUpload(blob, () => {
      // Reopen the camera fresh for a retake, same trick CameraCapture's own "আবার তুলুন" uses.
      setTimeout(() => setCameraOpen(true), 50);
    });
  };

  const handleCropped = (blob: Blob) => {
    setCropOpen(false);
    void validateAndUpload(blob, () => {
      // Let them re-crop the same source rather than forcing a fresh file pick.
      setTimeout(() => setCropOpen(true), 50);
    });
  };

  const handleRemove = async () => {
    if (!onRemove) return;
    setBusy(true);
    try {
      await onRemove();
      toast.success("ছবি মুছে ফেলা হয়েছে");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "ছবি মুছতে ব্যর্থ হয়েছে।");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={mainDialogOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>প্রোফাইল ছবি</DialogTitle>
            <DialogDescription>{studentName}-এর ছবি আপলোড বা পরিবর্তন করুন</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-2">
            <Avatar className="h-32 w-32 border-4 border-muted">
              {currentPhotoUrl && <AvatarImage src={currentPhotoUrl} alt={studentName} className="object-cover" />}
              <AvatarFallback className="bg-primary/10 text-primary">
                <User className="h-14 w-14" />
              </AvatarFallback>
            </Avatar>
            {!currentPhotoUrl && <p className="text-xs text-muted-foreground">কোনো ছবি আপলোড করা হয়নি</p>}

            <div className="grid grid-cols-2 gap-2 w-full">
              <Button variant="outline" onClick={() => setCameraOpen(true)} disabled={busy}>
                <Camera className="h-4 w-4 mr-2" /> ক্যামেরা
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                <ImageUp className="h-4 w-4 mr-2" /> গ্যালারি
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={handleGalleryPick}
            />

            {onRemove && currentPhotoUrl && (
              <Button variant="ghost" className="text-destructive hover:text-destructive w-full" onClick={handleRemove} disabled={busy}>
                <Trash2 className="h-4 w-4 mr-2" /> ছবি মুছুন
              </Button>
            )}

            {busy && <p className="text-xs text-muted-foreground">প্রক্রিয়াকরণ হচ্ছে...</p>}
          </div>
        </DialogContent>
      </Dialog>

      <CameraCapture open={cameraOpen} onOpenChange={setCameraOpen} onCapture={handleCameraCapture} />
      <PhotoCropper open={cropOpen} source={cropSource} onOpenChange={setCropOpen} onCropped={handleCropped} />
    </>
  );
}

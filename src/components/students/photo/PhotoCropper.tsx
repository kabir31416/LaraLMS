import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn } from "lucide-react";
import { loadImageFromBlob, cropAndResizeImage } from "@/lib/imageProcessing";

interface PhotoCropperProps {
  open: boolean;
  /** The raw, unvalidated source image (gallery pick or a re-crop of a camera capture) — face/quality validation runs again on the cropped output, not here. */
  source: Blob | null;
  onOpenChange: (open: boolean) => void;
  onCropped: (blob: Blob) => void;
}

/**
 * A fixed 1:1 crop with pan + zoom only — no rotation, filters, or other
 * editor features (Student Photo Management §7: "keep the crop UI simple").
 * react-easy-crop handles the touch/mouse drag and zoom-gesture plumbing;
 * this component only wires it to the app's own Dialog/Button/Slider and
 * does the final crop-to-canvas export.
 */
export function PhotoCropper({ open, source, onOpenChange, onCropped }: PhotoCropperProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  // A fresh object URL per source blob, reset crop/zoom for the new image, and revoke the old URL so it never leaks.
  useEffect(() => {
    if (!source) {
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(source);
    setImageUrl(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    return () => URL.revokeObjectURL(url);
  }, [source]);

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!source || !croppedAreaPixels) return;
    setProcessing(true);
    try {
      const img = await loadImageFromBlob(source);
      const blob = await cropAndResizeImage(img, croppedAreaPixels);
      onCropped(blob);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ছবি ক্রপ করুন</DialogTitle>
          <DialogDescription>ছবিটি টেনে সরান ও জুম করে ফ্রেমে মুখ ঠিকভাবে রাখুন</DialogDescription>
        </DialogHeader>

        <div className="relative w-full h-72 bg-muted rounded-lg overflow-hidden">
          {imageUrl && (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
            />
          )}
        </div>

        <div className="flex items-center gap-3 px-1">
          <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
          <Slider value={[zoom]} onValueChange={([v]) => setZoom(v)} min={1} max={3} step={0.05} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>বাতিল</Button>
          <Button onClick={handleConfirm} disabled={processing || !croppedAreaPixels}>
            {processing ? "প্রক্রিয়াকরণ হচ্ছে..." : "নিশ্চিত করুন"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, RotateCcw, Check, X, AlertCircle } from "lucide-react";
import { detectFace, preloadFaceDetector, type FaceValidationResult } from "@/lib/faceValidation";
import { resizeSquareCanvas } from "@/lib/imageProcessing";

interface CameraCaptureProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the final, already-square, compressed photo — the caller still runs it through the same full validatePhoto() gate before upload, same as a gallery pick (Student Photo Management §5). */
  onCapture: (blob: Blob) => void;
}

type LiveStatus = "starting" | "denied" | "unavailable" | "ready";

const GUIDE_LABEL: Record<FaceValidationResult["reason"] | "ok" | "checking", string> = {
  ok: "✓ মুখ শনাক্ত হয়েছে",
  checking: "যাচাই করা হচ্ছে...",
  "no-face": "আপনার মুখ ফ্রেমের ভেতরে স্পষ্টভাবে রাখুন",
  "multiple-faces": "শুধুমাত্র একজনের মুখ দেখা উচিত",
  "face-too-small": "ক্যামেরার আরও কাছে আসুন",
  "face-off-center": "মুখটি ফ্রেমের মাঝখানে রাখুন",
  "too-blurry": "ছবিটি পরিষ্কার নয়",
  "too-dark": "আরও উজ্জ্বল জায়গায় যান",
};

/**
 * Live camera capture with real-time face guidance — the video feed is
 * center-cropped to a square (independent of the device's actual camera
 * aspect ratio) so what the user frames is exactly what gets saved, no
 * surprise crop after capture.
 */
export function CameraCapture({ open, onOpenChange, onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pollRef = useRef<number | null>(null);

  const [status, setStatus] = useState<LiveStatus>("starting");
  const [liveState, setLiveState] = useState<FaceValidationResult["reason"] | "ok" | "checking">("checking");
  const [captured, setCaptured] = useState<{ canvas: HTMLCanvasElement; dataUrl: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const stopStream = useCallback(() => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stopStream();
      setCaptured(null);
      setStatus("starting");
      return;
    }

    preloadFaceDetector();
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("ready");

        pollRef.current = window.setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const result = await detectFace(videoRef.current);
            setLiveState(result.ok ? "ok" : result.reason ?? "no-face");
          } catch {
            // A transient detector hiccup shouldn't flip the guidance text to an error state.
          }
        }, 500);
      } catch (err) {
        if (cancelled) return;
        setStatus(err instanceof DOMException && err.name === "NotAllowedError" ? "denied" : "unavailable");
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video) return;
    const side = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - side) / 2;
    const sy = (video.videoHeight - side) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext("2d")!;
    // Mirror horizontally to match what the user actually saw in the (mirrored) preview.
    ctx.translate(side, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, side, side, 0, 0, side, side);

    setCaptured({ canvas, dataUrl: canvas.toDataURL("image/jpeg", 0.9) });
    stopStream();
  };

  const handleRetake = () => {
    setCaptured(null);
    onOpenChange(false);
    // Reopen fresh next tick so the camera stream is requested again cleanly.
    setTimeout(() => onOpenChange(true), 50);
  };

  const handleUsePhoto = async () => {
    if (!captured) return;
    setConfirming(true);
    try {
      const blob = await resizeSquareCanvas(captured.canvas);
      onCapture(blob);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) stopStream(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ছবি তুলুন</DialogTitle>
          <DialogDescription>আপনার মুখ ফ্রেমের মধ্যে রেখে ছবি তুলুন</DialogDescription>
        </DialogHeader>

        {captured ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-center">ছবির প্রিভিউ</p>
            <div className="mx-auto w-56 h-56 rounded-full overflow-hidden border-4 border-primary/20">
              <img src={captured.dataUrl} alt="প্রিভিউ" className="w-full h-full object-cover" />
            </div>
          </div>
        ) : status === "denied" ? (
          <div className="py-8 text-center space-y-2">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <p className="text-sm font-medium">ক্যামেরা অ্যাক্সেস দেওয়া হয়নি।</p>
            <p className="text-xs text-muted-foreground">ক্যামেরা পারমিশন দিন অথবা গ্যালারি থেকে ছবি বেছে নিন।</p>
          </div>
        ) : status === "unavailable" ? (
          <div className="py-8 text-center space-y-2">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <p className="text-sm font-medium">এই ডিভাইসে ক্যামেরা ব্যবহার করা যাচ্ছে না।</p>
            <p className="text-xs text-muted-foreground">গ্যালারি থেকে ছবি বেছে নিন।</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative mx-auto w-64 h-64 rounded-full overflow-hidden border-4 border-primary/30 bg-muted">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
              {status === "starting" && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted text-xs text-muted-foreground">ক্যামেরা চালু হচ্ছে...</div>
              )}
            </div>
            {status === "ready" && (
              <p className={`text-center text-sm font-medium ${liveState === "ok" ? "text-success" : "text-muted-foreground"}`}>
                {GUIDE_LABEL[liveState]}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="sm:justify-center gap-2">
          {captured ? (
            <>
              <Button variant="outline" onClick={handleRetake} disabled={confirming}>
                <RotateCcw className="h-4 w-4 mr-2" /> আবার তুলুন
              </Button>
              <Button onClick={handleUsePhoto} disabled={confirming}>
                <Check className="h-4 w-4 mr-2" /> {confirming ? "প্রক্রিয়াকরণ হচ্ছে..." : "এই ছবি ব্যবহার করুন"}
              </Button>
            </>
          ) : status === "ready" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4 mr-2" /> বাতিল
              </Button>
              <Button onClick={handleCapture}>
                <Camera className="h-4 w-4 mr-2" /> ছবি তুলুন
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>বন্ধ করুন</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

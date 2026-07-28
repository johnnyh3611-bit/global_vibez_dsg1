/**
 * Create entry for MY VIBEZ — unified ingestion via VideoRecorder
 * → POST /api/my-vibez/upload (same path as the in-loop Create FAB).
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { VideoRecorder } from "@/components/my-vibez/VideoRecorder";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/ToastNotification";

export default function CreateVibePage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const { toasts, removeToast, success } = useToast();

  return (
    <div
      className="min-h-[100dvh] bg-black flex items-center justify-center"
      data-testid="my-vibez-create-page"
    >
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <VideoRecorder
        isOpen={open}
        onClose={() => {
          setOpen(false);
          navigate("/my-vibez");
        }}
        onVideoUploaded={() => {
          success("Video uploaded! 🎬", "Upload Complete");
          setOpen(false);
          navigate("/my-vibez");
        }}
      />
      {!open ? null : (
        <p className="text-white/50 text-sm absolute bottom-10">
          Recording uploads into the MY VIBEZ For You loop
        </p>
      )}
    </div>
  );
}

import { CheckCircle } from "lucide-react";

export default function VerifiedBadge({ verified, size = "md" }) {
  if (!verified) return null;

  const sizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6"
  };

  return (
    <div className="inline-flex items-center gap-1" title="Verified User">
      <CheckCircle className={`${sizes[size]} text-cyan-400 fill-cyan-400`} />
    </div>
  );
}

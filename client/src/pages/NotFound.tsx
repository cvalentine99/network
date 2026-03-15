import { Link } from "wouter";
import { AlertTriangle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <AlertTriangle
          className="w-12 h-12 mx-auto mb-4"
          style={{ color: "oklch(0.769 0.108 85.805)" }}
        />
        <h1 className="text-4xl font-bold mb-2 gradient-text">404</h1>
        <p className="text-sm mb-6" style={{ color: "oklch(0.6 0.01 260)" }}>
          The page you are looking for does not exist.
        </p>
        <Link
          href="/"
          className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: "oklch(0.769 0.108 85.805 / 15%)",
            color: "oklch(0.95 0.005 85)",
            border: "1px solid oklch(0.769 0.108 85.805 / 30%)",
          }}
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}

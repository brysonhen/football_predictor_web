import Link from "next/link";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-20 text-center">
      <Target className="h-12 w-12 text-primary opacity-80" />
      <div>
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-muted-foreground">
          This page does not exist.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Back to the predictor</Link>
      </Button>
    </div>
  );
}

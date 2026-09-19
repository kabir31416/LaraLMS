import { LogOut } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Full-screen block shown instead of any protected page while
 * user.mustChangePassword is true (set by the backend for the seeded root
 * Super Admin, and for any login created/reset without an explicit
 * password — user.service.ts's createUser/resetCredentials). Previously
 * this flag was tracked but never enforced anywhere in the frontend, so a
 * known default credential (backend/src/config/env.ts's ADMIN_SEED_PASSWORD)
 * could never actually be rotated through the app. ChangePasswordForm's
 * onSuccess isn't needed here — a successful change flips
 * user.mustChangePassword to false in AuthContext, which unmounts this gate
 * and renders the real page on the next render.
 */
export function ChangePasswordGate() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm p-6 space-y-4">
        <div className="space-y-1 text-center">
          <h1 className="text-lg font-bold">পাসওয়ার্ড পরিবর্তন আবশ্যক</h1>
          <p className="text-sm text-muted-foreground">
            নিরাপত্তার জন্য চালিয়ে যাওয়ার আগে আপনাকে একটি নতুন পাসওয়ার্ড সেট করতে হবে।
          </p>
        </div>
        <ChangePasswordForm />
        <Button variant="ghost" size="sm" className="w-full" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" /> লগআউট
        </Button>
      </Card>
    </div>
  );
}

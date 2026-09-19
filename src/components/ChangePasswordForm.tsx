import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ApiClientError, useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Mirrors the backend's changePasswordSchema (auth.validation.ts) — kept in
// sync manually since the two can't share a literal.
const MIN_PASSWORD_LENGTH = 6;

interface Props {
  onSuccess?: () => void;
  submitLabel?: string;
}

export function ChangePasswordForm({ onSuccess, submitLabel = "পাসওয়ার্ড পরিবর্তন করুন" }: Props) {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      toast.error(`নতুন পাসওয়ার্ড কমপক্ষে ${MIN_PASSWORD_LENGTH} অক্ষরের হতে হবে`);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("নতুন পাসওয়ার্ড দুটি মিলছে না");
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success("পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="currentPassword">বর্তমান পাসওয়ার্ড</Label>
        <Input
          id="currentPassword"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">নতুন পাসওয়ার্ড</Label>
        <Input
          id="newPassword"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmNewPassword">নতুন পাসওয়ার্ড নিশ্চিত করুন</Label>
        <Input
          id="confirmNewPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
        />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "অপেক্ষা করুন..." : submitLabel}
      </Button>
    </form>
  );
}

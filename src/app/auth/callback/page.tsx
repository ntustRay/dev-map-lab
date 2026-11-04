import type { Metadata } from "next";
import { AuthCallback } from "../../../components/auth-callback";

export const metadata: Metadata = {
  title: "會員驗證",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function CallbackPage() {
  return <AuthCallback />;
}

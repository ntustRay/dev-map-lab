import type { Metadata } from "next";
import { AccountPanel } from "../../components/account-panel";

export const metadata: Metadata = {
  title: "會員與備份",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function AccountPage() {
  return <AccountPanel />;
}

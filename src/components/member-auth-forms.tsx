"use client";
import { useEffect, useState } from "react";
import { AuthPanel, AuthProvider, AuthField, PasswordField } from "@ntustray/web-authentication-component/react";
import { getSharedAuth } from "../auth/shared";
export function AuthForms() {
  const [controller, setController] = useState<ReturnType<typeof getSharedAuth>>(null);
  useEffect(() => { setController(getSharedAuth()); }, []);
  if (!controller) return <p role="status">確認登入服務…</p>;
  return <AuthProvider controller={controller} locale="zh-TW"><AuthPanel className="account-card" slots={{ field: ({ secret, ...props }) => secret ? <PasswordField {...props} /> : <AuthField {...props} {...(props.name === "code" ? { pattern: "[0-9]{6}", maxLength: 6 } : {})} /> }} /></AuthProvider>;
}

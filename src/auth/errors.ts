export class MemberOperationError extends Error {}

export function authErrorMessage(error: unknown): string {
  if (error instanceof MemberOperationError) return error.message;
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "";
  switch (code) {
    case "invalid_credentials":
      return "Email 或密碼不正確，請重新輸入。";
    case "email_not_confirmed":
      return "請先開啟註冊確認信，完成信箱驗證後再登入。";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "操作次數過多，請稍後再試。";
    case "weak_password":
      return "密碼未符合會員服務的安全要求，請設定更長的密碼。";
    case "otp_expired":
    case "flow_state_expired":
    case "flow_state_not_found":
      return "驗證連結已過期，或不是從這個瀏覽器發起；請重新寄送連結。";
    case "email_address_not_authorized":
      return "目前會員寄信服務尚未開放這個信箱，請聯絡網站管理者。";
    case "email_address_invalid":
      return "這個信箱目前無法接收會員信件，請確認地址。";
    case "40001":
      return "雲端備份已被其他裝置更新，請先讀取並合併雲端資料，再重新備份。";
    case "42501":
      return "帳號或資料權限已變更，請重新登入後再試。";
    case "23514":
      return "備份格式或大小超過雲端限制，請先匯出檔案備份。";
    case "42P01":
    case "PGRST202":
    case "PGRST205":
      return "雲端資料服務尚未完成設定，請聯絡網站管理者。";
    default:
      return "會員服務暫時無法完成操作，請確認網路後重試。";
  }
}

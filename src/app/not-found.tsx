import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page empty-state">
      <h1>這個單元不存在。</h1>
      <p>回到學習地圖，選擇一個現有單元。</p>
      <Link className="button primary" href="/">
        回到學習地圖
      </Link>
    </div>
  );
}

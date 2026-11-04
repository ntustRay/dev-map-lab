import type { ReactNode } from "react";

type Name =
  | "member"
  | "map"
  | "book"
  | "code"
  | "note"
  | "check"
  | "arrow"
  | "download"
  | "upload"
  | "search"
  | "close"
  | "plus"
  | "menu"
  | "play"
  | "stop"
  | "trash";
const shapes: Record<Name, ReactNode> = {
  member: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
  map: (
    <>
      <path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Z" />
      <path d="M9 3v16M15 5v16" />
    </>
  ),
  book: (
    <>
      <path d="M4 3h13a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2V3Z" />
      <path d="M4 17h15M8 7h7M8 10h5" />
    </>
  ),
  code: (
    <>
      <path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 20" />
    </>
  ),
  note: (
    <>
      <path d="M14 3H5v18h14V8l-5-5Z" />
      <path d="M14 3v5h5M8 12h8M8 16h6" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  download: (
    <>
      <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
  plus: <path d="M12 4v16M4 12h16" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  play: <path d="m8 4 12 8-12 8V4Z" />,
  stop: <rect x="6" y="6" width="12" height="12" />,
  trash: (
    <>
      <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
    </>
  ),
};
export function Icon({ name, size = 18 }: { name: Name; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shapes[name]}
    </svg>
  );
}

export function Brand() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path
          d="M8 24V8h8a8 8 0 0 1 0 16H8Z"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <path d="M8 16h15" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="8" cy="8" r="3" fill="currentColor" />
        <circle cx="8" cy="24" r="3" fill="currentColor" />
        <circle cx="24" cy="16" r="3" fill="currentColor" />
      </svg>
    </span>
  );
}

import type { NoteAnchor } from "../storage/schema";

type SelectionAnchor = Extract<NoteAnchor, { kind: "selection" }>;

export function locateQuote(
  text: string,
  anchor: SelectionAnchor,
): { start: number; end: number } | null {
  if (
    text.slice(anchor.start, anchor.end) === anchor.quote &&
    matchesContext(text, anchor.start, anchor)
  )
    return { start: anchor.start, end: anchor.end };
  const candidates: number[] = [];
  let position = text.indexOf(anchor.quote);
  while (position !== -1) {
    if (matchesContext(text, position, anchor)) candidates.push(position);
    position = text.indexOf(anchor.quote, position + 1);
  }
  const first = candidates[0];
  return candidates.length === 1 && first !== undefined
    ? { start: first, end: first + anchor.quote.length }
    : null;
}

function matchesContext(
  text: string,
  position: number,
  anchor: SelectionAnchor,
): boolean {
  return (
    text.slice(Math.max(0, position - anchor.prefix.length), position) ===
      anchor.prefix &&
    text.slice(
      position + anchor.quote.length,
      position + anchor.quote.length + anchor.suffix.length,
    ) === anchor.suffix
  );
}

export function readSelection(root: HTMLElement): SelectionAnchor | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0)
    return null;
  const range = selection.getRangeAt(0);
  if (
    !root.contains(range.startContainer) ||
    !root.contains(range.endContainer)
  )
    return null;
  const startElement =
    range.startContainer instanceof Element
      ? range.startContainer
      : range.startContainer.parentElement;
  const endElement =
    range.endContainer instanceof Element
      ? range.endContainer
      : range.endContainer.parentElement;
  const startBlock = startElement?.closest("[data-block-content]");
  const endBlock = endElement?.closest("[data-block-content]");
  if (!startBlock || startBlock !== endBlock) return null;
  const blockId = startBlock.getAttribute("data-block-content");
  const quote = selection.toString();
  if (!blockId || quote.trim().length === 0 || quote.length > 4000) return null;
  const before = range.cloneRange();
  before.selectNodeContents(startBlock);
  before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length;
  const text = startBlock.textContent ?? "";
  return {
    kind: "selection",
    blockId,
    quote,
    start,
    end: start + quote.length,
    prefix: text.slice(Math.max(0, start - 40), start),
    suffix: text.slice(start + quote.length, start + quote.length + 40),
  };
}

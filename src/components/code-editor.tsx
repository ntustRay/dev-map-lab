"use client";

import { javascript } from "@codemirror/lang-javascript";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { useEffect, useRef, useState } from "react";
import type { Language } from "../core/content-schema";
import { MAX_CODE_LENGTH } from "../core/limits";

export default function CodeEditor({
  value,
  language,
  onChange,
  readOnly,
}: {
  value: string;
  language: Language;
  onChange: (value: string) => void;
  readOnly: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  const change = useRef(onChange);
  const initialValue = useRef(value);
  const [editability] = useState(() => new Compartment());
  useEffect(() => {
    change.current = onChange;
  }, [onChange]);
  useEffect(() => {
    if (!container.current) return;
    const view = new EditorView({
      doc: initialValue.current,
      parent: container.current,
      extensions: [
        basicSetup,
        EditorState.transactionFilter.of((transaction) =>
          transaction.newDoc.length > MAX_CODE_LENGTH ? [] : transaction,
        ),
        editability.of([]),
        javascript({ typescript: language === "typescript" }),
        EditorView.contentAttributes.of({
          "aria-label": `${language === "typescript" ? "TypeScript" : "JavaScript"} 程式碼編輯器`,
          spellcheck: "false",
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) change.current(update.state.doc.toString());
        }),
        EditorView.theme({
          "&": { fontSize: "14px", background: "#fbfcfe" },
          ".cm-scroller": {
            fontFamily:
              "'Cascadia Code', 'SFMono-Regular', Consolas, monospace",
            overflow: "auto",
            minHeight: "240px",
            maxHeight: "500px",
          },
          ".cm-content": { padding: "18px 0" },
          ".cm-gutters": {
            background: "#f3f6fa",
            color: "#78869a",
            border: "none",
            paddingRight: "10px",
          },
          "&.cm-focused": {
            outline: "2px solid #315ad6",
            outlineOffset: "-2px",
          },
        }),
      ],
    });
    editor.current = view;
    return () => {
      editor.current = null;
      view.destroy();
    };
  }, [language, editability]);
  useEffect(() => {
    editor.current?.dispatch({
      effects: editability.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ]),
    });
  }, [editability, readOnly]);
  useEffect(() => {
    const view = editor.current;
    if (view && view.state.doc.toString() !== value)
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
  }, [value]);
  return <div className="code-editor" ref={container} />;
}

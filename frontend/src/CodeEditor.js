import React, { forwardRef, useImperativeHandle, useRef } from "react";
import Editor from "@monaco-editor/react";

const CodeEditor = forwardRef(({ value, onChange, language = "javascript", theme = "vs-dark" }, ref) => {
  const editorRef = useRef(null);

  useImperativeHandle(ref, () => ({
    undo: () => editorRef.current?.trigger("toolbar", "undo"),
    redo: () => editorRef.current?.trigger("toolbar", "redo"),
    focus: () => editorRef.current?.focus()
  }), []);

  return (
    <div className="monaco-editor-container" style={{ height: "100%", overflow: "hidden" }}>
      <Editor
        height="100%"
        defaultLanguage={language}
        value={value}
        theme={theme}
        onMount={(editor) => {
          editorRef.current = editor;
        }}
        onChange={(newValue) => onChange(newValue || "")}
        options={{
          fontSize: 14,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 10 },
          wordWrap: "on",
          bracketPairColorization: { enabled: true },
          guides: {
            bracketPairs: true,
            indentation: true
          },
          suggest: {
            showKeywords: true,
            showSnippets: true
          },
          quickSuggestions: {
            other: true,
            comments: true,
            strings: true
          }
        }}
      />
    </div>
  );
});

export default CodeEditor;

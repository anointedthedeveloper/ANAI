import React from "react";
import Editor from "@monaco-editor/react";

const CodeEditor = ({ value, onChange, language = "javascript", theme = "vs-dark" }) => {
  return (
    <div className="monaco-editor-container" style={{ height: "100%", border: "1px solid #333", borderRadius: "8px", overflow: "hidden" }}>
      <Editor
        height="100%"
        defaultLanguage={language}
        value={value}
        theme={theme}
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
};

export default CodeEditor;

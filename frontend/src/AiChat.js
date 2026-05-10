import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import {
  VscAdd,
  VscCircleFilled,
  VscClearAll,
  VscCloud,
  VscCopy,
  VscDebugStop,
  VscHistory,
  VscSend,
  VscSync
} from "react-icons/vsc";
import "./AiChat.css";

const DEFAULT_SESSION = () => ({
  id: `${Date.now()}`,
  title: "New Chat",
  createdAt: Date.now(),
  messages: [
    {
      role: "assistant",
      content: "Hi, I am ANAI. I can explain code, create or edit files in the open folder, and run terminal commands when you ask.",
      timestamp: Date.now(),
      model: "ANAI"
    }
  ]
});

const fastModels = ["orca-mini", "mistral", "neural-chat", "llama3:latest", "llama2"];
const qualityModels = ["gpt-4.1-mini:cloud", "llama3:latest", "mistral", "neural-chat", "llama2"];

const buildSystemPrompt = (workspacePath) => `You are ANAI, a coding AI assistant inside a VS Code-like IDE.
The owner and creator of this AI is anointedthedeveloper. If asked who owns or created you, answer: anointedthedeveloper.
Be concise, practical, and friendly.
Current workspace folder: ${workspacePath || "No folder selected"}.

You can request actions by including fenced tool blocks in your answer:
\`\`\`anai-write path=relative/path.ext
file contents here
\`\`\`
\`\`\`anai-run
terminal command here
\`\`\`

Only write files or run commands when the user asks you to. Use relative paths inside the selected workspace.`;

const extractActions = (text) => {
  const actions = [];
  const writeRegex = /```anai-(?:write|create|edit)\s+path=([^\n]+)\n([\s\S]*?)```/gi;
  const runRegex = /```anai-run\s*\n([\s\S]*?)```/gi;
  let match;

  while ((match = writeRegex.exec(text)) !== null) {
    actions.push({
      type: "writeFile",
      path: match[1].trim(),
      content: match[2].replace(/\n$/, "")
    });
  }

  while ((match = runRegex.exec(text)) !== null) {
    actions.push({
      type: "runCommand",
      command: match[1].trim()
    });
  }

  return actions;
};

const stripActionBlocks = (text) => {
  return text
    .replace(/```anai-(?:write|create|edit)\s+path=[^\n]+\n[\s\S]*?```/gi, "")
    .replace(/```anai-run\s*\n[\s\S]*?```/gi, "")
    .trim();
};

const extractThinking = (text) => {
  const closed = text.match(/<think>([\s\S]*?)<\/think>/i);
  if (closed?.[1]) return closed[1].trim();

  const open = text.match(/<think>([\s\S]*)$/i);
  if (open?.[1]) return open[1].trim();

  return "";
};

const cleanAssistantText = (text) => {
  return stripActionBlocks(text)
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/gi, "")
    .trim();
};

const renderMessageContent = (content) => {
  const parts = content.split(/(```[\s\S]*?```)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (!part.startsWith("```")) {
      return <span key={index} className="message-text-part">{part}</span>;
    }

    const match = part.match(/^```([^\n]*)\n?([\s\S]*?)```$/);
    const language = match?.[1]?.trim() || "text";
    const code = match?.[2] || "";

    return (
      <div key={index} className="code-block">
        <div className="code-block-header">
          <span>{language}</span>
          <button type="button" onClick={() => navigator.clipboard?.writeText(code)} title="Copy code">
            <VscCopy /> Copy
          </button>
        </div>
        <pre><code>{code}</code></pre>
      </div>
    );
  });
};

function AiChat({
  workspacePath,
  terminalProfileId,
  onWorkspaceRefresh,
  onOpenFile,
  onTerminalOutput
}) {
  const [sessions, setSessions] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("anai.chatSessions") || "[]");
      return stored.length ? stored : [DEFAULT_SESSION()];
    } catch {
      return [DEFAULT_SESSION()];
    }
  });
  const [activeSessionId, setActiveSessionId] = useState(() => sessions[0]?.id);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [thinkingText, setThinkingText] = useState("");
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [modePreference, setModePreference] = useState("fast");
  const abortRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const activeSession = sessions.find((session) => session.id === activeSessionId) || sessions[0];
  const activeModel = models.find((model) => model.name === selectedModel);
  const localModel = models.find((model) => !model.cloud)?.name || "llama3:latest";

  const visibleMessages = useMemo(() => activeSession?.messages || [], [activeSession]);

  useEffect(() => {
    localStorage.setItem("anai.chatSessions", JSON.stringify(sessions.slice(0, 20)));
  }, [sessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages, thinkingText]);

  const updateActiveSession = useCallback((updater) => {
    setSessions((prev) => prev.map((session) => (
      session.id === activeSessionId ? updater(session) : session
    )));
  }, [activeSessionId]);

  const appendMessage = useCallback((message) => {
    updateActiveSession((session) => ({
      ...session,
      title: session.title === "New Chat" && message.role === "user"
        ? message.content.slice(0, 36) || "New Chat"
        : session.title,
      messages: [...session.messages, { ...message, timestamp: Date.now() }]
    }));
  }, [updateActiveSession]);

  const patchLastAssistant = useCallback((patcher) => {
    updateActiveSession((session) => {
      const messages = [...session.messages];
      const index = messages.map((msg) => msg.role).lastIndexOf("assistant");
      if (index >= 0) {
        messages[index] = patcher(messages[index]);
      }
      return { ...session, messages };
    });
  }, [updateActiveSession]);

  const fetchModels = useCallback(async () => {
    try {
      const response = await axios.get("http://localhost:3001/models");
      const modelList = (response.data.models || []).map((model) => ({
        name: model.name,
        provider: model.provider || (model.cloud ? "Cloud" : "Ollama"),
        cloud: Boolean(model.cloud)
      }));
      setModels(modelList);
      const preferred = modePreference === "quality"
        ? qualityModels.find((name) => modelList.some((model) => model.name === name))
        : fastModels.find((name) => modelList.some((model) => model.name === name));
      setSelectedModel((current) => current || preferred || modelList[0]?.name || "");
    } catch (error) {
      console.error("Error fetching models:", error);
      setModels([{ name: "llama3:latest", provider: "Ollama", cloud: false }]);
      setSelectedModel("llama3:latest");
    }
  }, [modePreference]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  useEffect(() => {
    if (!models.length) return;
    const preference = modePreference === "quality" ? qualityModels : fastModels;
    const next = preference.find((name) => models.some((model) => model.name === name));
    if (next) setSelectedModel(next);
  }, [modePreference, models]);

  const runActions = useCallback(async (content) => {
    const actions = extractActions(content);
    if (!actions.length) return;

    try {
      const res = await axios.post("http://localhost:3001/ai/actions", {
        actions,
        workspacePath,
        profileId: terminalProfileId
      });

      const summary = res.data.results.map((result) => {
        if (result.type === "writeFile") {
          if (result.ok) {
            onWorkspaceRefresh?.();
            onOpenFile?.(result.path);
            return `Created/updated ${result.path}`;
          }
          return `File action failed: ${result.error}`;
        }

        if (result.type === "runCommand") {
          const output = [result.stdout, result.stderr, result.error].filter(Boolean).join("\n");
          onTerminalOutput?.(`$ ${result.command}\n${output || "Command executed"}`);
          return result.ok ? `Ran: ${result.command}` : `Command failed: ${result.command}`;
        }

        return result.ok ? `${result.type} complete` : `${result.type} failed`;
      }).join("\n");

      appendMessage({
        role: "assistant",
        content: `Action results:\n${summary}`,
        model: "ANAI tools"
      });
    } catch (error) {
      appendMessage({
        role: "assistant",
        content: `Action error: ${error.response?.data?.error || error.message}`,
        error: true,
        model: "ANAI tools"
      });
    }
  }, [appendMessage, onOpenFile, onTerminalOutput, onWorkspaceRefresh, terminalProfileId, workspacePath]);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
    setThinkingText("");
    patchLastAssistant((msg) => ({ ...msg, pending: false, stopped: true }));
  }, [patchLastAssistant]);

  const sendMessage = useCallback(async (event) => {
    event?.preventDefault();
    const promptText = input.trim();
    if (!promptText) {
      if (loading) stopGeneration();
      return;
    }

    if (loading) {
      stopGeneration();
    }

    const modelToUse = activeModel?.cloud ? localModel : selectedModel || localModel;
    const modelNotice = activeModel?.cloud
      ? `\n\nNote: ${selectedModel} is listed as a cloud model. No provider key is configured in this local app, so I am answering with ${modelToUse}.`
      : "";

    appendMessage({ role: "user", content: promptText });
    appendMessage({ role: "assistant", content: "", pending: true, model: modelToUse });
    setInput("");
    setLoading(true);
    setThinkingText("Thinking through the workspace...");

    const controller = new AbortController();
    abortRef.current = controller;
    let finalText = "";
    let buffer = "";
    const thinkingTimer = window.setInterval(() => {
      setThinkingText((prev) => {
        if (prev.includes("Checking files")) return "Preparing response...";
        if (prev.includes("workspace")) return "Checking files, commands, and context...";
        return "Thinking through the workspace...";
      });
    }, 1400);

    try {
      const historyContext = visibleMessages.slice(-8).map((msg) => `${msg.role}: ${msg.content}`).join("\n");
      const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: modelToUse,
          prompt: `${buildSystemPrompt(workspacePath)}\n\nConversation:\n${historyContext}\n\nUser: ${promptText}${modelNotice}\nAssistant:`,
          stream: true,
          temperature: modePreference === "fast" ? 0.15 : 0.35,
          max_tokens: modePreference === "fast" ? 512 : 1024,
          num_ctx: 4096
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Readable stream not available from Ollama.");
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value || new Uint8Array(), { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            if (json.response) {
              finalText += json.response;
              const currentText = finalText;
              const thinking = extractThinking(currentText);
              setThinkingText(thinking ? thinking.slice(0, 140) : "");
              patchLastAssistant((msg) => ({ ...msg, content: cleanAssistantText(currentText), model: modelToUse }));
            }
          } catch {
            // Wait for the next stream chunk if Ollama splits a JSON line.
          }
        }
      }

      if (buffer.trim()) {
        try {
          const json = JSON.parse(buffer.trim());
          if (json.response) {
            finalText += json.response;
          }
        } catch {
          // Ignore final partial chunks.
        }
      }

      patchLastAssistant((msg) => ({
        ...msg,
        content: cleanAssistantText(finalText) || "Done.",
        pending: false,
        model: modelToUse
      }));
      await runActions(finalText);
    } catch (error) {
      if (error.name !== "AbortError") {
        patchLastAssistant((msg) => ({
          ...msg,
          content: `Error: ${error.message}. Make sure Ollama is running and CORS is enabled by setting OLLAMA_ORIGINS="*" and restarting Ollama.`,
          pending: false,
          error: true,
          model: modelToUse
        }));
      }
    } finally {
      window.clearInterval(thinkingTimer);
      setThinkingText("");
      setLoading(false);
      abortRef.current = null;
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [activeModel, appendMessage, input, loading, localModel, modePreference, patchLastAssistant, runActions, selectedModel, stopGeneration, visibleMessages, workspacePath]);

  const newChat = () => {
    const session = DEFAULT_SESSION();
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    setInput("");
  };

  const clearCurrent = () => {
    updateActiveSession((session) => ({ ...session, messages: DEFAULT_SESSION().messages }));
  };

  const modelSummary = activeModel
    ? `${activeModel.provider}${activeModel.cloud ? " cloud" : " local"}`
    : "Loading models";

  return (
    <div className="ai-chat-container q-chat">
      <aside className="chat-history">
        <button className="history-action" onClick={newChat} title="New chat"><VscAdd /> New</button>
        <div className="history-title"><VscHistory /> History</div>
        <div className="history-list">
          {sessions.map((session) => (
            <button key={session.id} className={`history-item ${session.id === activeSessionId ? "active" : ""}`} onClick={() => setActiveSessionId(session.id)}>
              {session.title}
            </button>
          ))}
        </div>
      </aside>

      <section className="chat-main">
        <div className="chat-header">
          <div className="chat-title-section">
            <h3 className="chat-title">ANAI</h3>
            <p className="chat-subtitle">Owner: anointedthedeveloper</p>
            <div className="model-status"><VscCircleFilled /> {modelSummary}</div>
          </div>
          <button className="clear-btn" onClick={fetchModels} title="Refresh models"><VscSync /></button>
          <button className="clear-btn" onClick={clearCurrent} title="Clear current chat"><VscClearAll /></button>
          <div className="model-toggle-group">
            <button className={`model-toggle ${modePreference === "fast" ? "active" : ""}`} type="button" onClick={() => setModePreference("fast")}>Fast</button>
            <button className={`model-toggle ${modePreference === "quality" ? "active" : ""}`} type="button" onClick={() => setModePreference("quality")}>Quality</button>
          </div>
          <div className="model-selector">
            <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="model-select">
              {models.map((model) => (
                <option key={model.name} value={model.name}>
                  {model.name}{model.cloud ? " cloud" : ""}
                </option>
              ))}
            </select>
            {activeModel?.cloud && <VscCloud className="model-cloud-icon" />}
          </div>
        </div>

        <div className="messages-container">
          {visibleMessages.map((msg, idx) => (
            <div key={idx} className={`message message-${msg.role} ${msg.error ? "error" : ""} ${msg.pending ? "message-pending" : ""}`}>
              <div className="message-role">{msg.role === "user" ? "You" : "ANAI"}</div>
              <div className="message-content">{renderMessageContent(msg.content)}</div>
              {msg.pending && !msg.content && (
                <div className="loader-row"><span /><span /><span /> {thinkingText || "Waiting for model..."}</div>
              )}
              <div className="message-meta">
                <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                {msg.model && <span>Answered by {msg.model}</span>}
                {msg.stopped && <span>Stopped</span>}
              </div>
            </div>
          ))}
          {loading && thinkingText && (
            <div className="thinking-strip">{thinkingText}</div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="input-form" onSubmit={sendMessage}>
          <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder={loading ? "Type a new message and press Enter to stop and continue..." : "Ask ANAI anything..."} className="chat-input" />
          <button type={loading ? "button" : "submit"} className={`send-btn ${loading ? "stop" : ""}`} onClick={loading ? stopGeneration : undefined} title={loading ? "Stop" : "Send"}>
            {loading ? <VscDebugStop /> : <VscSend />}
          </button>
        </form>
      </section>
    </div>
  );
}

export default AiChat;

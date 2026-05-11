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

const fastModels = ["deepseek-r1:1.5b", "orca-mini", "mistral", "neural-chat", "llama3:latest", "llama2"];
const qualityModels = ["deepseek-r1:1.5b", "gpt-4.1-mini:cloud", "llama3:latest", "mistral", "neural-chat", "llama2"];

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
\`\`\`anai-read path=relative/path.ext
\`\`\`
\`\`\`anai-mkdir path=relative/folder
\`\`\`

Only write files or run commands when the user asks you to. Use relative paths inside the selected workspace.`;

const extractActions = (text) => {
  const actions = [];
  const writeRegex = /```anai-(?:write|create|edit)\s+path=([^\n]+)\n([\s\S]*?)```/gi;
  const folderRegex = /```anai-mkdir\s+path=([^\n]+)\s*```/gi;
  const readRegex = /```anai-read\s+path=([^\n]+)\s*```/gi;
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

  while ((match = readRegex.exec(text)) !== null) {
    actions.push({
      type: "readFile",
      path: match[1].trim()
    });
  }

  while ((match = folderRegex.exec(text)) !== null) {
    actions.push({
      type: "createFolder",
      path: match[1].trim()
    });
  }

  return actions;
};

const stripActionBlocks = (text) => {
  return text
    .replace(/```anai-(?:write|create|edit)\s+path=[^\n]+\n[\s\S]*?```/gi, "")
    .replace(/```anai-mkdir\s+path=[^\n]+\s*```/gi, "")
    .replace(/```anai-read\s+path=[^\n]+\s*```/gi, "")
    .replace(/```anai-run\s*\n[\s\S]*?```/gi, "")
    .trim();
};

const extractThinking = (text) => {
  // Handle split tags across chunks by tracking partial matches
  const thinkOpen = /<think>/i;
  const thinkClose = /<\/think>/i;
  
  // Find complete thinking blocks
  const closed = text.match(/<think>([\s\S]*?)<\/think>/i);
  if (closed?.[1]) return closed[1].trim();

  // Find open thinking blocks (no closing tag yet)
  const openMatch = text.match(/<think>([\s\S]*)$/i);
  if (openMatch?.[1]) return openMatch[1].trim();

  return "";
};

const isInThinkingBlock = (text) => {
  const openCount = (text.match(/<think>/gi) || []).length;
  const closeCount = (text.match(/<\/think>/gi) || []).length;
  return openCount > closeCount;
};

const cleanAssistantText = (text) => {
  return stripActionBlocks(text)
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/gi, "")
    .trim();
};

const flattenTree = (items = [], depth = 0, limit = 80, lines = []) => {
  for (const item of items) {
    if (lines.length >= limit) break;
    lines.push(`${"  ".repeat(depth)}${item.type === "folder" ? "/" : ""}${item.path || item.name}`);
    if (item.children) flattenTree(item.children, depth + 1, limit, lines);
  }
  return lines;
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
  const [isThinking, setIsThinking] = useState(false);
  const [currentStreamingModel, setCurrentStreamingModel] = useState("");
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [modePreference, setModePreference] = useState("fast");
  const [streamUpdateTimer, setStreamUpdateTimer] = useState(null);
  const abortRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const workspaceCacheRef = useRef({ path: null, data: null, timestamp: 0 });

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
      // Use abort controller for request timeout (5 second timeout)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await axios.get("http://localhost:3001/models", {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
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

        if (result.type === "createFolder") {
          if (result.ok) {
            onWorkspaceRefresh?.();
            return `Created folder ${result.path}`;
          }
          return `Folder action failed: ${result.error}`;
        }

        if (result.type === "runCommand") {
          const output = [result.stdout, result.stderr, result.error].filter(Boolean).join("\n");
          onTerminalOutput?.(`$ ${result.command}\n${output || "Command executed"}`);
          return result.ok ? `Ran: ${result.command}` : `Command failed: ${result.command}`;
        }

        if (result.type === "readFile") {
          if (result.ok) {
            return `Read ${result.path}:\n\`\`\`\n${result.content.slice(0, 4000)}\n\`\`\``;
          }
          return `Read failed: ${result.error}`;
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
    setCurrentStreamingModel(modelToUse);
    setThinkingText("");
    setIsThinking(false);

    const controller = new AbortController();
    abortRef.current = controller;
    let finalText = "";
    let buffer = "";
    let accumulatedThinking = "";

    try {
      let workspaceSummary = "No workspace folder is open.";
      if (workspacePath) {
        try {
          // Use cached workspace data if it's less than 30 seconds old
          const now = Date.now();
          if (workspaceCacheRef.current.path === workspacePath && 
              now - workspaceCacheRef.current.timestamp < 30000) {
            workspaceSummary = workspaceCacheRef.current.data;
          } else {
            // Use abort controller for request timeout (3 second timeout)
            const cacheController = new AbortController();
            const cacheTimeoutId = setTimeout(() => cacheController.abort(), 3000);
            
            const treeRes = await axios.get(`http://localhost:3001/files?path=${encodeURIComponent(workspacePath)}`, {
              signal: cacheController.signal
            });
            clearTimeout(cacheTimeoutId);
            
            const treeData = flattenTree(treeRes.data.tree).join("\n") || "Workspace is empty.";
            workspaceSummary = treeData;
            
            // Update cache
            workspaceCacheRef.current = {
              path: workspacePath,
              data: treeData,
              timestamp: now
            };
          }
        } catch {
          // Use cached data even if request fails
          if (workspaceCacheRef.current.path === workspacePath && workspaceCacheRef.current.data) {
            workspaceSummary = workspaceCacheRef.current.data;
          } else {
            workspaceSummary = "Workspace tree could not be loaded.";
          }
        }
      }

      // Use only last 6 messages instead of 8 to reduce token usage and improve speed
      const historyContext = visibleMessages.slice(-6).map((msg) => `${msg.role}: ${msg.content.slice(0, 500)}`).join("\n");
      const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: modelToUse,
          prompt: `${buildSystemPrompt(workspacePath)}\n\nWorkspace file tree:\n${workspaceSummary}\n\nConversation:\n${historyContext}\n\nUser: ${promptText}${modelNotice}\nAssistant:`,
          stream: true, // Ensure streaming is enabled
          temperature: modePreference === "fast" ? 0.05 : 0.25,
          max_tokens: modePreference === "fast" ? 384 : 768,
          num_ctx: 3072,
          keep_alive: "10m"
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
        
        const chunk = decoder.decode(value || new Uint8Array(), { stream: true });
        console.log("RAW CHUNK:", chunk); // Debug: Log raw data from Ollama
        
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          console.log("PARSING LINE:", line); // Debug: Log each JSON line
          try {
            const json = JSON.parse(line);
            if (json.response) {
              finalText += json.response;
              const currentText = finalText;
              
              // Debounce UI updates for smoother streaming
              if (streamUpdateTimer) {
                clearTimeout(streamUpdateTimer);
              }
              
              const timer = setTimeout(() => {
                console.log("CURRENT TEXT:", currentText); // Debug: Log accumulated text
                
                // Check if we're in a thinking block
                const currentlyThinking = isInThinkingBlock(currentText);
                if (currentlyThinking !== isThinking) {
                  console.log("THINKING STATE CHANGED:", currentlyThinking); // Debug: Log state changes
                  setIsThinking(currentlyThinking);
                }
                
                // Extract thinking content if in thinking block
                if (currentlyThinking) {
                  const thinking = extractThinking(currentText);
                  if (thinking && thinking !== accumulatedThinking) {
                    accumulatedThinking = thinking;
                    console.log("THINKING CONTENT:", thinking); // Debug: Log thinking content
                    setThinkingText(thinking);
                  }
                } else {
                  // Not thinking anymore, show cleaned response
                  const cleanedText = cleanAssistantText(currentText);
                  console.log("FINAL ANSWER:", cleanedText); // Debug: Log final answer
                  patchLastAssistant((msg) => ({ ...msg, content: cleanedText, model: modelToUse }));
                }
              }, 50); // Debounce with 50ms delay for smoother updates
              
              setStreamUpdateTimer(timer);
            }
          } catch (error) {
            console.log("JSON PARSE ERROR:", error, "LINE:", line); // Debug: Log parse errors
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
      if (streamUpdateTimer) {
        clearTimeout(streamUpdateTimer);
        setStreamUpdateTimer(null);
      }
      setThinkingText("");
      setIsThinking(false);
      setCurrentStreamingModel("");
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
            {currentStreamingModel && (
              <div className="current-model-indicator">
                <VscCircleFilled className="model-indicator-icon" />
                <span>Model: {currentStreamingModel}</span>
              </div>
            )}
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
              <div className="message-role">
                {msg.role === "user" ? "You" : "ANAI"}
                {msg.model && msg.role === "assistant" && (
                  <span className="message-model-badge">{msg.model}</span>
                )}
              </div>
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
          {isThinking && thinkingText && (
            <div className="thinking-container">
              <div className="thinking-content">
                {renderMessageContent(thinkingText)}
              </div>
            </div>
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

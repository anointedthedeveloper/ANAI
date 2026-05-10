import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { VscSend, VscSync } from "react-icons/vsc";
import "./AiChat.css";

const fastModels = ["orca-mini", "mistral", "neural-chat", "llama3:latest", "llama2"];
const qualityModels = ["llama3:latest", "llama2", "neural-chat", "mistral", "orca-mini"];

function AiChat() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello! I'm ANAI, your coding AI assistant. Ask me anything about coding or let me help you with your projects!",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [modelStatus, setModelStatus] = useState("Connecting to Ollama...");
  const [modePreference, setModePreference] = useState("fast");
  const messagesEndRef = useRef(null);

  const pickBestModel = useCallback((availableModels, preferenceList) => {
    return preferenceList.find((model) => availableModels.includes(model)) || availableModels[0] || "";
  }, []);

  const modelSummary = useMemo(() => {
    if (!models.length) return modelStatus;
    return `Connected: ${models.length} model${models.length > 1 ? "s" : ""} - ${modePreference === "quality" ? "Quality" : "Fast"} mode`;
  }, [models.length, modePreference, modelStatus]);

  const fetchModels = useCallback(async () => {
    try {
      const response = await axios.get("http://localhost:3001/models");
      const modelNames = (response.data.models || []).map((m) => m.name).filter(Boolean);

      if (modelNames.length > 0) {
        const defaultModel = modePreference === "quality"
          ? pickBestModel(modelNames, qualityModels)
          : pickBestModel(modelNames, fastModels);
        setModels(modelNames);
        setSelectedModel(defaultModel);
        setModelStatus(`Connected: ${modelNames.length} model${modelNames.length > 1 ? "s" : ""}`);
      } else {
        throw new Error("No models found");
      }
    } catch (error) {
      console.error("Error fetching models:", error);
      setModels(["llama3:latest", "mistral", "neural-chat"]);
      setSelectedModel("llama3:latest");
      setModelStatus("Unable to fetch models. Using fallback list.");
    }
  }, [modePreference, pickBestModel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  useEffect(() => {
    if (models.length > 0) {
      const nextModel = modePreference === "quality"
        ? pickBestModel(models, qualityModels)
        : pickBestModel(models, fastModels);
      setSelectedModel(nextModel);
      setModelStatus(modelSummary);
    }
  }, [modePreference, models, modelSummary, pickBestModel]);

  const sendMessage = useCallback(async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input, timestamp: new Date() };
    const thinkingMessage = {
      role: "assistant",
      content: "",
      timestamp: new Date(),
      pending: true
    };

    setMessages((prev) => [...prev, userMessage, thinkingMessage]);
    setInput("");
    setLoading(true);

    let buffer = "";

    try {
      const isFastMode = modePreference === "fast";
      const res = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel || "llama3:latest",
          prompt: input,
          stream: true,
          temperature: isFastMode ? 0.1 : 0.3,
          max_tokens: isFastMode ? 256 : 512,
          top_p: isFastMode ? 0.5 : 0.9,
          top_k: isFastMode ? 20 : 40,
          repeat_penalty: 1.05,
          num_ctx: 2048
        })
      });

      if (!res.ok) {
        throw new Error(`Ollama request failed: ${res.status} ${res.statusText}`);
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("Readable stream not available from Ollama.");
      }

      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        buffer += decoder.decode(value || new Uint8Array(), { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            if (json.response) {
              setMessages((prev) => prev.map((msg, idx) => (
                idx === prev.length - 1 ? { ...msg, content: msg.content + json.response } : msg
              )));
            }
          } catch {
            // Ollama streams line-delimited JSON; incomplete chunks are retried.
          }
        }
      }

      if (buffer.trim()) {
        try {
          const json = JSON.parse(buffer.trim());
          if (json.response) {
            setMessages((prev) => prev.map((msg, idx) => (
              idx === prev.length - 1 ? { ...msg, content: msg.content + json.response } : msg
            )));
          }
        } catch {
          // Ignore leftover parse failures from partial stream endings.
        }
      }

      setMessages((prev) => prev.map((msg, idx) => (
        idx === prev.length - 1 ? { ...msg, pending: false } : msg
      )));
    } catch (error) {
      const errorText = `Error: ${error.message}. Make sure Ollama is running and CORS is enabled by setting OLLAMA_ORIGINS="*" and restarting Ollama.`;
      setMessages((prev) => prev.map((msg, idx) => (
        idx === prev.length - 1 ? { ...msg, content: errorText, pending: false, error: true } : msg
      )));
      console.error("Error talking to Ollama:", error);
    } finally {
      setLoading(false);
    }
  }, [input, modePreference, selectedModel]);

  const clearHistory = async () => {
    try {
      await axios.post("http://localhost:3001/clear");
      setMessages([
        {
          role: "assistant",
          content: "Chat history cleared. Ready for a new conversation!",
          timestamp: new Date()
        }
      ]);
    } catch (error) {
      console.error("Error clearing history:", error);
    }
  };

  return (
    <div className="ai-chat-container">
      <div className="chat-header">
        <div className="chat-title-section">
          <h3 className="chat-title">ANAI</h3>
          <p className="chat-subtitle">Ollama Powered</p>
          <div className="model-status">{modelSummary}</div>
        </div>
        <button className="clear-btn" onClick={clearHistory} title="Clear chat history">
          <VscSync />
        </button>
        <div className="model-toggle-group">
          <button className={`model-toggle ${modePreference === "fast" ? "active" : ""}`} type="button" onClick={() => setModePreference("fast")}>
            Fast
          </button>
          <button className={`model-toggle ${modePreference === "quality" ? "active" : ""}`} type="button" onClick={() => setModePreference("quality")}>
            Quality
          </button>
        </div>
        <div className="model-selector">
          <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="model-select">
            {models.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="messages-container">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message message-${msg.role} ${msg.error ? "error" : ""} ${msg.pending ? "message-pending" : ""}`}>
            <div className="message-role">{msg.role === "user" ? "You" : "ANAI"}</div>
            <div className="message-content">{msg.content}</div>
            <div className="message-time">{msg.timestamp.toLocaleTimeString()}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="input-form" onSubmit={sendMessage}>
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask ANAI anything..." className="chat-input" disabled={loading} />
        <button type="submit" className="send-btn" disabled={loading || !input.trim()}>
          {loading ? "..." : <VscSend />}
        </button>
      </form>
    </div>
  );
}

export default AiChat;

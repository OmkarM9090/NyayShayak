import { useState } from "react";
import FileUploader from "./FileUploader";
import axios from "axios";

function ChatBox() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const sendMessage = async () => {
    if (!input.trim() && !selectedFile) return;

    // USER MESSAGE SHOW
    const userMessage = {
      type: "user",
      text: input || "",
      file: selectedFile ? selectedFile.name : null,
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      let data;

      // ✅ IMAGE CASE
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);

        let url = "";

        // 🔥 Check file type
        if (selectedFile.type === "application/pdf") {
          url = "http://localhost:5000/api/pdf/analyse-pdf";
        } else {
          url = "http://localhost:5000/api/analyse-image";
        }

        const response = await axios.post(url, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        data = response.data;
      }
      // ✅ TEXT CASE
      else {
        const response = await fetch("http://localhost:5000/api/analyse", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: input }),
        });

        data = await response.json();
      }

      // BOT MESSAGE
      const botMessage = {
        type: "bot",
        text:
          data.text || (data.results ? data.results.join("\n\n") : "No result"),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error(error);
    }

    setInput("");
    setSelectedFile(null);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-md">
      {/* Header */}
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Legal Document Analysis</h2>
      </div>

      {/* Chat Body */}
      <div className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-3">
        {messages.map((msg, index) => (
          <div
            key={index}
            className="max-w-xl p-3 rounded-lg bg-blue-600 text-white ml-auto"
          >
            {msg.text && <p>{msg.text}</p>}
            {msg.file && <p className="text-sm mt-2 italic">📎 {msg.file}</p>}
          </div>
        ))}
      </div>

      {/* Selected File Preview */}
      {selectedFile && (
        <div className="px-4 py-2 text-sm bg-gray-100 border-t">
          Selected: {selectedFile.name}
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t flex flex-col gap-3">
        <textarea
          rows="2"
          className="border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="Paste your legal document..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />

        <div className="flex justify-between items-center">
          <FileUploader onFileSelect={setSelectedFile} />

          <button
            onClick={sendMessage}
            className="px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Analyse
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatBox;

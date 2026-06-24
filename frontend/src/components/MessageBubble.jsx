import React from "react";

export default function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`bubble-row ${isUser ? "right" : "left"}`}>
      <div
        className={`bubble ${isUser ? "user" : "ai"} ${msg.panicMode ? "calm" : ""}`}
      >
        {!isUser && msg.panicMode && (
          <div className="calm-badge">🫶 Calm Mode · grounding response</div>
        )}
        <div className="bubble-text">{msg.content}</div>
      </div>
    </div>
  );
}

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static("public"));

const FILE_PATH = "./messages.json";
let messages = [];

// ✅ Supabase クライアント（keepalive で Render でも接続切れしにくく）
const supabase = createClient(
  "https://ecqivwqwcckmgilchsot.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjcWl2d3F3Y2NrbWdpbGNoc290Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0NTg3MDgsImV4cCI6MjA3ODAzNDcwOH0.xrAsXWGzb5ElwTdPOoVT29brMIVea3n385Gd6oMfsaU",
  { global: { fetch: (url, options) => fetch(url, { ...options, keepalive: true }) } }
);

// ========= Render起動時(SQL → messages.jsonへ復元) =========
async function loadMessagesFromDB() {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("data")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("❌ Supabase読み込み失敗:", error);
    return;
  }

  messages = [];
  for (const row of data) {
    if (Array.isArray(row.data)) messages.push(...row.data);
    else if (row.data) messages.push(row.data);
  }

  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(messages, null, 2));
    console.log("✅ Supabase → messages.json へ復元完了！（", messages.length, "件）");
  } catch (err) {
    console.warn("⚠ messages.json 書き込み失敗(Render環境の可能性):", err.message);
  }
}

// ========= Socket.io =========
io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);

  socket.emit("init", messages);

  socket.on("chat", async (data) => {
    const message = {
      text: data.text ?? data.message ?? "",
      username: data.username ?? data.name ?? "anonymous",
      time: new Date().toISOString()
    };

    if (!message.text.trim()) {
      console.warn("⚠ 空メッセージのため保存スキップ");
      return;
    }

    console.log("📦 保存データ:", message);

    messages.push(message);

    try {
      fs.writeFileSync(FILE_PATH, JSON.stringify(messages, null, 2));
    } catch (err) {
      console.warn("⚠ JSON書き込み失敗(Render環境でもこれはOK):", err.message);
    }

    // ✅ ここで Supabase に保存（1件ずつ INSERT）
    const { error } = await supabase
      .from("chat_messages")
      .insert({ data: message });

    if (error) {
      console.error("❌ Supabase保存エラー:", error);
    } else {
      console.log("✅ Supabase 保存完了!");
    }

    io.emit("chat", message);
  });

  socket.on("disconnect", () => console.log("❌ Client disconnected"));
});

// ========= サーバー起動 =========
const PORT = process.env.PORT || 10000;
server.listen(PORT, async () => {
  console.log(`🚀 Server running on ${PORT}`);
  await loadMessagesFromDB();
});

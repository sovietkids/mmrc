const express = require('express');
const host = '0.0.0.0';
const app = express();
const http = require('http');
const https = require('https');
const { Server } = require("socket.io");
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
let PAGE = '/public/main.html'; 
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
// --- Drawing persistent storage ---
const drawingFile = path.join(__dirname, 'data', 'drawing.json');
let drawingData = [];
let AIMessage = "";

// Load drawing data on startup
if (fs.existsSync(drawingFile)) {
  try {
    drawingData = JSON.parse(fs.readFileSync(drawingFile, 'utf8'));
    console.log("Drawing data loaded.");
  } catch (err) {
    console.error("Error loading drawing:", err);
  }
}

// Save drawing data
function saveDrawing() {
  try {
    fs.writeFileSync(drawingFile, JSON.stringify(drawingData));
  } catch (err) {
    console.error("Error saving drawing:", err);
  }
}

app.use(express.json());
app.use(express.static('public'));

// Multer setup for image uploads
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'img-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

app.get('/', (req, res) => {
  res.sendFile(__dirname + PAGE);
});

// Image upload endpoint
app.post('/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.json({ error: 'No file uploaded' });
  }
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
});

// Google Images search endpoint (using Bing or similar)
app.get('/search-images', async (req, res) => {
  const q = req.query.q;
  if (!q) {
    return res.json({ results: [] });
  }

  try {
    // Using Google Custom Search API (requires API key and search engine ID)
    // For now, we'll use a simpler approach with Bing Image Search API or a public endpoint
    // NOTE: You'll need to set up API keys for production
    
    // Simple fallback: return mock results or use a free API
    // For demonstration, we use Unsplash API (free tier)
    const apiUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=20&client_id=YOUR_UNSPLASH_KEY`;
    
    // Alternative: Use Pexels API (also free)
    const pexelsUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=20`;
    const pexelsKey = 'YOUR_PEXELS_KEY'; // Set this environment variable
    
    // For now, return a placeholder message
    console.log(`Image search for: ${q}`);
    
    // Mock results for demonstration
    const results = [];
    try {
      // Try Pexels API if key is available
      if (process.env.PEXELS_KEY && process.env.PEXELS_KEY !== 'YOUR_PEXELS_KEY') {
        const response = await axios.get(pexelsUrl, {
          headers: { 'Authorization': process.env.PEXELS_KEY }
        });
        if (response.data.photos) {
          response.data.photos.forEach(photo => {
            results.push({
              url: photo.src.medium,
              title: `Photo by ${photo.photographer}`
            });
          });
        }
      }
    } catch (err) {
      console.error('API error:', err.message);
    }

    // If no results, add some mock results for testing
    if (results.length === 0) {
      results.push(
        { url: 'https://picsum.photos/300/300?random=1', title: 'Sample 1' },
        { url: 'https://picsum.photos/300/300?random=2', title: 'Sample 2' },
        { url: 'https://picsum.photos/300/300?random=3', title: 'Sample 3' },
        { url: 'https://picsum.photos/300/300?random=4', title: 'Sample 4' },
        { url: 'https://picsum.photos/300/300?random=5', title: 'Sample 5' },
        { url: 'https://picsum.photos/300/300?random=6', title: 'Sample 6' }
      );
    }

    res.json({ results });
  } catch (err) {
    console.error('Search error:', err);
    res.json({ results: [], error: err.message });
  }
});

const threads = {
  "general": { name: "雑談", messages: [] },
  "hobbies": { name: "趣味", messages: [] },
  "tech": { name: "技術", messages: [] },
};
const users = {}; // { username: socket.id }

// Persistent storage for messages
const dataFilePath = path.join(__dirname, 'data', 'messages.json');
const dataDir = path.join(__dirname, 'data');

// Create data directory if it doesn't exist
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load messages from JSON file on startup
const loadMessagesFromFile = () => {
  try {
    if (fs.existsSync(dataFilePath)) {
      const data = fs.readFileSync(dataFilePath, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') {
        Object.keys(parsed).forEach(threadId => {
          if (threads[threadId]) {
            threads[threadId].messages = parsed[threadId].messages || [];
          } else {
            threads[threadId] = parsed[threadId];
          }
        });
        console.log('Messages loaded from file');
     }
    }
  } catch (err) {
    console.error('Error loading messages:', err);
  }
};

// Save messages to JSON file
const saveMessagesToFile = () => {
  try {
    const data = {};
    Object.keys(threads).forEach(threadId => {
      data[threadId] = {
        name: threads[threadId].name,
        messages: threads[threadId].messages
      };
    });
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving messages:', err);
  }
};

// Load messages on startup
loadMessagesFromFile();
// Create HTTP or HTTPS server depending on available certs or environment
let server;
let io;
let usingHttps = false;
const keyPath = process.env.SSL_KEY_PATH || path.join(__dirname, 'certs', 'server.key');
const certPath = process.env.SSL_CERT_PATH || path.join(__dirname, 'certs', 'server.crt');
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  try {
    const options = { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
    server = https.createServer(options, app);
    usingHttps = true;
    console.log('Starting HTTPS server');
  } catch (err) {
    console.error('Failed to initialize HTTPS, falling back to HTTP:', err);
    server = http.createServer(app);
  }
} else {
  if (process.env.USE_HTTPS === '1') {
    console.warn('USE_HTTPS=1 but cert files not found. Falling back to HTTP. Expected:', keyPath, certPath);
  }
  server = http.createServer(app);
}
io = new Server(server);

io.on('connection', (socket) => {
  console.log('a user connected');
  const defaultThread = "general";
  socket.emit("updateList", drawingData);
  // 1. 接続時にデフォルトスレッドに参加し、履歴を送信
  socket.join(defaultThread);
  socket.emit('init', {
    threadId: defaultThread,
    messages: threads[defaultThread].messages
  });
  socket.currentThread = defaultThread;


  // スレッド一覧をクライアントに送信
  socket.on('get threads', (callback) => {
    // threadsオブジェクトからmessagesを除いたデータを送る
    const threadList = Object.keys(threads).reduce((acc, key) => {
      acc[key] = { name: threads[key].name };
      return acc;
    }, {});
    callback(threadList);
  });

  // ユーザーが名前を入力して参加したとき
  socket.on('user joined', (username) => {
    users[username] = socket.id;
    socket.username = username; // socketオブジェクトにusernameを保存
    io.emit('update users', Object.keys(users));
    console.log(`${username} joined`);
  });

  // スレッド切り替え
  socket.on('switch thread', (threadId, callback) => {
    if (threads[threadId] && socket.currentThread !== threadId) {
      socket.leave(socket.currentThread);
      socket.join(threadId);
      socket.currentThread = threadId;
      callback(threads[threadId].messages);
      console.log(`${socket.username || 'user'} switched to thread ${threadId}`);
    }
  });

  // スレッド作成
  socket.on('create thread', (name, callback) => {
    const base = name.trim() || 'unnamed';
    // 簡易ID生成（重複回避のためタイムスタンプを付与）
    const id = `${base.toLowerCase().replace(/[^a-z0-9\-]/g, '-').replace(/-+/g, '-')}-${Date.now()}`;
    threads[id] = { name: name, messages: [] };

    // 送信者へコールバックで新しいスレッドIDと一覧を返す
    const threadList = Object.keys(threads).reduce((acc, key) => {
      acc[key] = { name: threads[key].name };
      return acc;
    }, {});
    // 全クライアントにスレッド一覧更新を通知
    io.emit('threads updated', threadList);
    if (typeof callback === 'function') callback({ threads: threadList, newThreadId: id });
    // Save to file after thread creation
    saveMessagesToFile();
    console.log(`thread created: ${id} (${name})`);
  });

  // メッセージ検索
  socket.on('search messages', (payload, callback) => {
    const q = (payload && payload.query) ? String(payload.query).toLowerCase() : '';
    const threadId = payload && payload.threadId;
    if (!q) {
      if (typeof callback === 'function') callback([]);
      return;
    }

    let pool = [];
    if (threadId && threads[threadId]) {
      pool = threads[threadId].messages;
    } else {
      pool = Object.keys(threads).reduce((acc, key) => acc.concat(threads[key].messages), []);
    }

    const results = pool.filter(msg => {
      const text = (msg.text || '').toString().toLowerCase();
      const user = (msg.username || msg.from || '').toString().toLowerCase();
      return text.includes(q) || user.includes(q);
    });

    // コールバックで結果を返す
    if (typeof callback === 'function') callback(results);
  });

  // 公開メッセージ -> スレッドメッセージに変更
  socket.on('chat message', (msgData) => {
    const currentThreadId = socket.currentThread;
    if (!threads[currentThreadId]) return;

    console.log(`message to ${currentThreadId} from ${msgData.username}: ${msgData.text}`);
    const fullMessage = { 
      type: 'public',
      text: msgData.text,
      username: socket.username || msgData.username,
      socketId: socket.id,
      messageId: `${new Date().getTime()}-${Math.random()}`,
      parentId: msgData.parentId || null,
      threadId: currentThreadId,
      timestamp: new Date().toISOString()
    };
    threads[currentThreadId].messages.push(fullMessage);
    // 同じスレッドに参加しているクライアントにのみ送信（送信者も含む）
    io.to(currentThreadId).emit('chat message', fullMessage);
    // Save to file after message
    saveMessagesToFile();
  });

  // ダイレクトメッセージ (変更なし)
  socket.on('direct message', (msgData) => {
    const recipientSocketId = users[msgData.to];
    if (recipientSocketId) {
      const fullMessage = {
        type: 'dm',
        text: msgData.text,
        from: socket.username,
        to: msgData.to,
        timestamp: new Date()
      };
      io.to(recipientSocketId).emit('direct message', fullMessage);
      socket.emit('direct message', fullMessage);
      console.log(`DM from ${socket.username} to ${msgData.to}`);
    }
  });

  // Collaborative drawing events
  socket.on('drawing', (data) => {
    // broadcast to the same thread room
    const room = socket.currentThread || null;
    if (room) {
      io.to(room).emit('drawing', data);
    }
  });

  socket.on('clear drawing', () => {
    const room = socket.currentThread || null;
    if (room) {
      io.to(room).emit('clear drawing');
    }
  });

  socket.on('code', (code) => {
    console.log(`Received code: ${code} from ${socket.username || 'unknown user'}`);
    // You can add additional handling for the received code here
  });

  socket.on("uploadList", (list) => {
        console.log("received list:", list);

        drawingData = list;  // ★サーバー側に保存
        saveDrawing();        // ★ファイル保存
        io.emit("updateList", list);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
    if (socket.username) {
      delete users[socket.username];
      io.emit('update users', Object.keys(users));
      console.log(`${socket.username} left`);
    }
  });

socket.on('AIMessage', async (data) => { // 👈 async を追加
        console.log('AIMessage received:', data);
        
        // ----------------------------------------------------
        // main() のロジックをここに移動
        let AIMessage = data; // ローカル変数として扱う
        let NewAIMessage = AIMessage.substring(0, 36);
        AIMessage = AIMessage.substring(36);
        
        // 【AIサービスとの統合】

        //利用制限　1日に20回まで過ぎたら貼り付ける
        //        const response = await ai.models.generateContent({
        //    model: "gemini-2.5-flash",
      //    contents: AIMessage,
        //});

        console.log(response.text);
        // console.log(API_KEY); // APIキーのコンソール出力はデバッグ目的で削除しても良い
        
        // socket はこのスコープ内で定義されているため、正常に動作する
        console.log("SERVER: Emitting AI Response:", response.text);
        socket.emit('AIResponse', response.text); 
        // ----------------------------------------------------
        
        // main() の呼び出しは不要
        // main(); 
    });
    
    // ... (io.on('connection') の閉じ括弧)
});


const { GoogleGenAI } = require("@google/genai");

// 環境変数からAPIキーを読み込む
const API_KEY = process.env.GEMINI_API_KEY;

// APIキーがない場合は処理を停止する
if (!API_KEY) {
    console.error("Error: GEMINI_API_KEY environment variable is not set.");
    // 適切なエラーコードでプロセスを終了
    process.exit(1); 
}

const ai = new GoogleGenAI({ apiKey: API_KEY }); 



// Start the server

server.listen(PORT, host, () => {
  const proto = usingHttps ? 'https' : 'http';
  console.log(`Listening on ${proto}://${host}:${PORT}`);
});


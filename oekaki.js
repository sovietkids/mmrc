let camera_x = -190;
let camera_y = -150;

const socket = io("http://153.224.43.222:3000/");
const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");

const keys = {};

// 四つの値で 1 つの四角形 [x, y, w, h] が並んでいる
let edge_positions_renderer = [

];

function draw() {
    updateCamera();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 四角形の数ぶんループ
    for (let i = 0; i < edge_positions_renderer.length / 5; i++) {
        const base = i * 5;

        const draw_x = edge_positions_renderer[base] - camera_x;
        const draw_y = edge_positions_renderer[base + 1] - camera_y;
        const w = edge_positions_renderer[base + 2];
        const h = edge_positions_renderer[base + 3];
        const color = edge_positions_renderer[base + 4];

        ctx.fillStyle = color;
        ctx.fillRect(draw_x, draw_y, w, h);
    }

    requestAnimationFrame(draw);
}

draw();

let isDrawing = false;

canvas.addEventListener("mousedown", () => {
    isDrawing = true;
});

canvas.addEventListener("mouseup", () => {
    isDrawing = false;
});

canvas.addEventListener("mouseleave", () => {
    isDrawing = false;
});

canvas.addEventListener("mousemove", (e) => {
    if (!isDrawing) return;

    // canvas 上の座標を取得
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // カメラ補正を逆にかけて「マップ座標」に変換
    const worldX = x + camera_x;
    const worldY = y + camera_y;

    // 20x20 の四角を追加
    const colorPicker = document.getElementById("colorPicker");
    const color = colorPicker.value;
    edge_positions_renderer.push(worldX, worldY, 5, 5, color);

    // サーバーに送信
    upload()
});


// カメラ操作
window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
});

window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
});

function updateCamera() {
    const speedPicker = document.getElementById("speedInput");
    const speed = parseInt(speedPicker.value) || 5;

    if (keys["w"]) camera_y -= speed;
    if (keys["s"]) camera_y += speed;
    if (keys["a"]) camera_x -= speed;
    if (keys["d"]) camera_x += speed;

    if (keys["arrowup"])    camera_y -= speed;
    if (keys["arrowdown"])  camera_y += speed;
    if (keys["arrowleft"])  camera_x -= speed;
    if (keys["arrowright"]) camera_x += speed;
}

// サーバーにデータを送信
function upload() {
    socket.emit("uploadList", edge_positions_renderer);
}

// サーバーからデータを受信
socket.on("updateList", (list) => {
    edge_positions_renderer = list;
});
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const PORT = process.env.PORT || 9090;
const PUBLIC_DIR = path.join(__dirname, 'public');

// --- Persistent Native Input Injector ---
let inputProcess = null;
let screenWidth = 1920;
let screenHeight = 1080;

function startInputInjector() {
    const exePath = path.join(__dirname, 'InputInjector.exe');
    if (!fs.existsSync(exePath)) {
        console.warn('[Native] InputInjector.exe not found. Running without native input simulation.');
        return;
    }

    try {
        inputProcess = spawn(exePath, [], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        inputProcess.stdout.on('data', (data) => {
            const str = data.toString();
            const lines = str.split(/\r?\n/);
            for (const line of lines) {
                if (line.startsWith('SCREEN')) {
                    const parts = line.split(' ');
                    if (parts.length >= 3) {
                        screenWidth = parseInt(parts[1], 10) || screenWidth;
                        screenHeight = parseInt(parts[2], 10) || screenHeight;
                        console.log(`[Native] Primary screen detected: ${screenWidth}x${screenHeight}`);
                    }
                }
            }
        });

        inputProcess.stderr.on('data', (data) => {
            console.error('[Native ERR]', data.toString().trim());
        });

        inputProcess.on('exit', (code) => {
            console.log('[Native] InputInjector exited with code', code);
            inputProcess = null;
        });

        // Query screen size
        sendNativeCommand('SCREEN');
        console.log('[Native] InputInjector started successfully.');
    } catch (err) {
        console.error('[Native] Failed to start InputInjector:', err);
    }
}

function sendNativeCommand(cmd) {
    if (inputProcess && inputProcess.stdin && inputProcess.stdin.writable) {
        inputProcess.stdin.write(cmd + '\n');
    }
}

startInputInjector();

// --- HTTP Server for UI and static assets ---
const mimeTypes = {
    '.html': 'text/html; charset=UTF-8',
    '.css': 'text/css; charset=UTF-8',
    '.js': 'application/javascript; charset=UTF-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const os = require('os');

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

const server = http.createServer((req, res) => {
    let reqUrl = req.url.split('?')[0];
    if (reqUrl === '/') reqUrl = '/index.html';

    // API to get local screen resolution and IP
    if (reqUrl === '/api/info' || reqUrl === '/api/screen') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ 
            width: screenWidth, 
            height: screenHeight,
            ip: getLocalIp(),
            port: PORT
        }));
        return;
    }

    // API to execute native input directly from WebRTC DataChannel
    if (reqUrl === '/api/input' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                handleNativeInput(data);
                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ ok: true }));
            } catch (e) {
                res.writeHead(400);
                res.end('Bad Request');
            }
        });
        return;
    }

    const filePath = path.join(PUBLIC_DIR, reqUrl);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('File Not Found');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            res.end(content);
        }
    });
});

// --- WebSocket Signaling & Control Server ---
const wss = new WebSocket.Server({ server });

// Map of peerId -> { ws, isHost, remoteId, permissions }
const peers = new Map();

function normalizeId(id) {
    return (id || '').toString().replace(/[\s\-_]/g, '').trim();
}

function findPeer(targetQuery) {
    if (!targetQuery) return null;
    const cleanTarget = normalizeId(targetQuery);
    const reversedTarget = cleanTarget.split('').reverse().join('');

    // 1. Direct match by exact key
    if (peers.has(targetQuery)) return { id: targetQuery, peer: peers.get(targetQuery) };

    // 2. Match by normalized (spaces stripped)
    for (const [id, peer] of peers.entries()) {
        const cleanKey = normalizeId(id);
        if (cleanKey === cleanTarget) {
            return { id, peer };
        }
    }

    // 3. Match by reversed digits (handles RTL input flipping!)
    for (const [id, peer] of peers.entries()) {
        const cleanKey = normalizeId(id);
        if (cleanKey === reversedTarget) {
            return { id, peer };
        }
    }

    return null;
}

function generatePeerId() {
    // Generate AnyDesk-like 9-digit ID formatted like "1 263 108 267"
    const digits = Math.floor(100000000 + Math.random() * 900000000).toString();
    return `${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)}`.trim();
}

wss.on('connection', (ws) => {
    let peerId = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            const { type } = data;

            // 1. Peer Registration
            if (type === 'register') {
                let requestedId = data.peerId;
                // If requested ID is already active on another open socket (e.g. second tab), generate fresh ID
                if (!requestedId || (peers.has(requestedId) && peers.get(requestedId).ws !== ws && peers.get(requestedId).ws.readyState === WebSocket.OPEN)) {
                    peerId = generatePeerId();
                } else {
                    peerId = requestedId;
                }

                peers.set(peerId, {
                    ws,
                    name: data.name || 'Desktop Device',
                    allowControl: true,
                    allowAudio: true,
                    registeredAt: Date.now()
                });

                ws.send(JSON.stringify({
                    type: 'registered',
                    peerId: peerId,
                    screenWidth: screenWidth,
                    screenHeight: screenHeight
                }));

                broadcastPeerList();
                console.log(`[Signaling] Peer registered: ${peerId}`);
            }

            // 2. Connect Request from Client to Host
            else if (type === 'connect_request') {
                const targetResult = findPeer(data.targetId);
                if (targetResult && targetResult.peer && targetResult.peer.ws.readyState === WebSocket.OPEN) {
                    targetResult.peer.ws.send(JSON.stringify({
                        type: 'incoming_connection',
                        fromId: peerId,
                        fromName: data.fromName || 'Remote Client'
                    }));
                } else {
                    // Send list of online peers to help user connect
                    const onlineIds = Array.from(peers.keys()).filter(id => id !== peerId);
                    let onlineMsg = onlineIds.length > 0 ? `\nئامێرە ئۆنلاینەکانی ئێستا: ${onlineIds.join(', ')}` : '\nهیچ ئامێرێکی تر لەسەر ئەم سێرڤەرە پەیوەست نییە.';
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: `ئامێری مەبەست (${data.targetId}) نەدۆزرایەوە یان ئۆفلاینە.${onlineMsg}`
                    }));
                }
            }

            // 3. Host Accept / Reject Connection
            else if (type === 'connection_response') {
                const targetResult = findPeer(data.targetId);
                if (targetResult && targetResult.peer && targetResult.peer.ws.readyState === WebSocket.OPEN) {
                    targetResult.peer.ws.send(JSON.stringify({
                        type: 'connection_decision',
                        accepted: data.accepted,
                        fromId: peerId,
                        permissions: data.permissions || { control: true, audio: true }
                    }));
                }
            }

            // 4. WebRTC Signaling (Offer, Answer, ICE Candidate)
            else if (type === 'signal') {
                const targetResult = findPeer(data.targetId);
                if (targetResult && targetResult.peer && targetResult.peer.ws.readyState === WebSocket.OPEN) {
                    targetResult.peer.ws.send(JSON.stringify({
                        type: 'signal',
                        fromId: peerId,
                        signalData: data.signalData
                    }));
                }
            }

            // 5. Native Remote Control (Mouse & Keyboard)
            else if (type === 'remote_input') {
                handleNativeInput(data);
            }

            // 6. Session terminated
            else if (type === 'session_end') {
                const targetPeer = peers.get(data.targetId);
                if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
                    targetPeer.ws.send(JSON.stringify({
                        type: 'session_ended',
                        fromId: peerId
                    }));
                }
            }
        } catch (err) {
            console.error('[Signaling Error]', err);
        }
    });

    ws.on('close', () => {
        if (peerId) {
            peers.delete(peerId);
            broadcastPeerList();
            console.log(`[Signaling] Peer disconnected: ${peerId}`);
        }
    });
});

function handleNativeInput(data) {
    if (!data) return;
    const action = data.action;
    if (!action) return;

    if (action === 'move') {
        const x = Math.round(data.x * screenWidth);
        const y = Math.round(data.y * screenHeight);
        sendNativeCommand(`MOVE ${x} ${y}`);
    } else if (action === 'mouse_down') {
        sendNativeCommand(`DOWN ${data.button || 'left'}`);
    } else if (action === 'mouse_up') {
        sendNativeCommand(`UP ${data.button || 'left'}`);
    } else if (action === 'mouse_click') {
        sendNativeCommand(`CLICK ${data.button || 'left'}`);
    } else if (action === 'mouse_dblclick') {
        sendNativeCommand(`DBLCLICK`);
    } else if (action === 'mouse_wheel') {
        sendNativeCommand(`WHEEL ${data.delta || 120}`);
    } else if (action === 'key_down') {
        if (data.vk) sendNativeCommand(`KEYDOWN ${data.vk}`);
    } else if (action === 'key_up') {
        if (data.vk) sendNativeCommand(`KEYUP ${data.vk}`);
    } else if (action === 'key_type') {
        if (data.text) sendNativeCommand(`TYPE ${data.text}`);
    }
}

function broadcastPeerList() {
    const list = [];
    for (const [id, peer] of peers.entries()) {
        list.push({ id, name: peer.name });
    }
    const message = JSON.stringify({ type: 'peer_list', peers: list });
    for (const peer of peers.values()) {
        if (peer.ws.readyState === WebSocket.OPEN) {
            peer.ws.send(message);
        }
    }
}

server.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`  NazhaDesk (AnyDesk Alternative) Running on Port ${PORT}`);
    console.log(`  Local URL:  http://localhost:${PORT}`);
    console.log(`=======================================================`);
});

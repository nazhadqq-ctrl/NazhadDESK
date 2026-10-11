// NazhaDesk - Full Remote Desktop Engine (PeerJS Global Cloud + Native C# Input)
let currentLanguage = 'ckb';
let myDisplayId = localStorage.getItem('nazhadesk_id') || null;
let peer = null;
let activeDataConn = null;
let activeMediaCall = null;
let localStream = null;
let activeSessionId = null;
let isHost = false;
let pendingCall = null;
let pendingConn = null;

// DOM Elements
const myAddressText = document.getElementById('myAddressText');
const copyAddressBtn = document.getElementById('copyAddressBtn');
const remoteAddressInput = document.getElementById('remoteAddressInput');
const connectBtn = document.getElementById('connectBtn');
const testHostBtn = document.getElementById('testHostBtn');
const mainDashboard = document.getElementById('mainDashboard');
const remoteViewerContainer = document.getElementById('remoteViewerContainer');
const remoteVideo = document.getElementById('remoteVideo');
const remoteCanvas = document.getElementById('remoteCanvas');
const viewerTab = document.getElementById('viewerTab');
const mainTab = document.getElementById('mainTab');
const remoteSessionTitle = document.getElementById('remoteSessionTitle');
const closeSessionTabBtn = document.getElementById('closeSessionTabBtn');
const btnDisconnectSession = document.getElementById('btnDisconnectSession');
const btnToggleFullscreen = document.getElementById('btnToggleFullscreen');
const btnCtrlAltDel = document.getElementById('btnCtrlAltDel');
const btnSendText = document.getElementById('btnSendText');
const incomingModal = document.getElementById('incomingModal');
const incomingCallerId = document.getElementById('incomingCallerId');
const acceptCallBtn = document.getElementById('acceptCallBtn');
const rejectCallBtn = document.getElementById('rejectCallBtn');
const langToggleBtn = document.getElementById('langToggleBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const sessionsGrid = document.getElementById('sessionsGrid');
const onlineCountBadge = document.getElementById('onlineCountBadge');
const statLatency = document.getElementById('statLatency');
const statFps = document.getElementById('statFps');
const globalStatus = document.getElementById('globalStatus');

// Translations
const translations = {
    ckb: {
        yourAddress: "ناونیشانی ئەم کۆمپیوتەرە (Your Address):",
        remotePlaceholder: "ناونیشانی شوێنی مەبەست بنووسە (Enter Remote Address)...",
        license: "وەشانی تایبەت (Private Full Control)",
        recentTitle: "شوێنەکانی دوایی (Recent Sessions)",
        invite: "✉ بانگهێشتکردن (Invite)",
        copied: "ئایدی کۆپی کرا!",
        connecting: "پەیوەستبوون بە سێرڤەری گڵۆباڵ...",
        connected: "ئامادەیە بۆ پەیوەندی (Online)",
        deviceOnline: "ئامێر لە تۆڕدایە",
        sendTextPrompt: "ئەو دەقە یان وشەی نهێنی بنووسە کە دەتەوێت لە شوێنی مەبەست تایپ بکرێت:"
    },
    en: {
        yourAddress: "Your Address (This Computer):",
        remotePlaceholder: "Enter Remote Address...",
        license: "Private License (Full Control)",
        recentTitle: "Recent Sessions",
        invite: "✉ Invite",
        copied: "ID Copied!",
        connecting: "Connecting to Global Cloud...",
        connected: "Ready for Connection (Online)",
        deviceOnline: "Devices Online",
        sendTextPrompt: "Enter text or password to type on remote computer:"
    }
};

function formatAnyDeskId(digits) {
    const clean = digits.toString().replace(/\D/g, '');
    if (clean.length < 9) return clean;
    return `${clean.slice(0, 1)} ${clean.slice(1, 4)} ${clean.slice(4, 7)} ${clean.slice(7, 9)}`.trim();
}

function cleanDigits(id) {
    return (id || '').toString().replace(/\D/g, '').trim();
}

function getPeerJsId(displayId) {
    return 'nzh-' + cleanDigits(displayId);
}

// Initialize PeerJS Cloud Connection
function initPeerConnection() {
    if (!myDisplayId) {
        // Generate random 9-digit ID
        const rand = Math.floor(100000000 + Math.random() * 900000000).toString();
        myDisplayId = formatAnyDeskId(rand);
        localStorage.setItem('nazhadesk_id', myDisplayId);
    }

    myAddressText.textContent = myDisplayId;
    const peerJsId = getPeerJsId(myDisplayId);

    console.log('[PeerJS] Connecting to cloud broker with ID:', peerJsId);

    // Connect to free public WebRTC cloud broker
    peer = new Peer(peerJsId, {
        host: '0.peerjs.com',
        port: 443,
        secure: true,
        path: '/',
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun.services.mozilla.com' }
            ]
        }
    });

    peer.on('open', (id) => {
        console.log('[PeerJS] Connected to Global Cloud broker. My ID:', id);
        globalStatus.className = 'status-indicator online';
        globalStatus.title = translations[currentLanguage].connected;
        document.getElementById('systemStatusText').textContent = 'ئامادەیە! پەیوەستە بە تۆڕی جیهانی WebRTC.';
    });

    // Handle Incoming Data Connection (for remote control commands)
    peer.on('connection', (conn) => {
        console.log('[PeerJS] Incoming data connection from:', conn.peer);
        activeDataConn = conn;

        conn.on('data', (data) => {
            if (data.type === 'remote_input') {
                // Forward command to local native input injector
                fetch('/api/input', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                }).catch(err => console.error('Error forwarding input to native driver:', err));
            } else if (data.type === 'session_end') {
                alert('دانیشتنەکە لەلایەن لایەنی بەرامبەرەوە کۆتایی پێهات.');
                endSession();
            }
        });

        conn.on('close', () => {
            console.log('[PeerJS] Data connection closed');
            endSession();
        });
    });

    // Handle Incoming Media Call (Screen Stream Request)
    peer.on('call', (call) => {
        console.log('[PeerJS] Incoming screen call from:', call.peer);
        pendingCall = call;

        const remoteIdFormatted = formatAnyDeskId(call.peer.replace('nzh-', ''));
        incomingCallerId.textContent = `ئایدی: ${remoteIdFormatted}`;
        incomingModal.style.display = 'flex';
    });

    peer.on('error', (err) => {
        console.error('[PeerJS Error]', err);
        if (err.type === 'unavailable-id') {
            // ID already taken on cloud, regenerate fresh ID
            const newRand = Math.floor(100000000 + Math.random() * 900000000).toString();
            myDisplayId = formatAnyDeskId(newRand);
            localStorage.setItem('nazhadesk_id', myDisplayId);
            myAddressText.textContent = myDisplayId;
            setTimeout(initPeerConnection, 1000);
        } else if (err.type === 'peer-unavailable') {
            alert('ئامێری مەبەست ئۆفلاینە یان بەرنامەی NazhaDesk ی نەکردۆتەوە (Remote device offline). دڵنیابە لەوەی بەرنامەکە لەوێش کراوەتەوە.');
            connectBtn.disabled = false;
        } else {
            document.getElementById('systemStatusText').textContent = 'سێرڤەر لە حاڵەتی بەستنەوەدایە...';
        }
    });

    peer.on('disconnected', () => {
        console.log('[PeerJS] Disconnected, reconnecting...');
        globalStatus.className = 'status-indicator';
        peer.reconnect();
    });
}

// --- Accept Incoming Connection (Host side) ---
acceptCallBtn.addEventListener('click', async () => {
    incomingModal.style.display = 'none';
    if (!pendingCall) return;

    try {
        isHost = true;
        // Request desktop screen capture
        localStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                frameRate: { ideal: 60, max: 60 },
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: document.getElementById('modalPermAudio').checked
        });

        // Answer call with our screen stream
        pendingCall.answer(localStream);
        activeMediaCall = pendingCall;

        localStream.getVideoTracks()[0].onended = () => {
            endSession();
        };

        alert('شاشەکەت ئێستا هاوبەش کراوە لەگەڵ بەکارهێنەری دووربەدەست.');
    } catch (err) {
        console.error('Display media error:', err);
        pendingCall.close();
        pendingCall = null;
    }
});

rejectCallBtn.addEventListener('click', () => {
    incomingModal.style.display = 'none';
    if (pendingCall) {
        pendingCall.close();
        pendingCall = null;
    }
});

// --- Start Outgoing Connection (Client Controller side) ---
async function startConnection(targetAddress) {
    if (!targetAddress || targetAddress.trim() === '') {
        alert('تکایە ناونیشانی شوێنی مەبەست بنووسە.');
        return;
    }

    const cleanTarget = cleanDigits(targetAddress);
    const cleanMine = cleanDigits(myDisplayId);

    if (cleanTarget === cleanMine) {
        alert('ئەمە ئایدی هەمان ئەم کۆمپیوتەرەیە! بۆ تاقیکردنەوە پێویستە ئایدی کۆمپیوتەرێکی تر بنووسیت.');
        return;
    }

    if (!peer || peer.disconnected) {
        alert('پەیوەندی بە تۆڕی جیهانی نەبەستراوە. تکایە چەند چرکەیەک چاوەڕێ بکە...');
        return;
    }

    const remotePeerId = 'nzh-' + cleanTarget;
    console.log('[Connect] Connecting to remote peer:', remotePeerId);

    connectBtn.disabled = true;
    connectBtn.innerHTML = '⏳';
    activeSessionId = formatAnyDeskId(cleanTarget);

    // Save to recent sessions
    saveRecentSession(activeSessionId);

    const connectTimeout = setTimeout(() => {
        connectBtn.disabled = false;
        connectBtn.innerHTML = '▶';
        alert(`ئامێری مەبەست (${targetAddress}) وەڵامی نەدایەوە.\n\nتکایە دڵنیابە لەوەی:\n١. لە کۆمپیوتەری بەرامبەر بەرنامەی NazhaDesk کراوەتەوە و نیشاندەری سەوزە.\n٢. هەردوو کۆمپیوتەر وەشانی نوێی Setup-NazhaDesk.exe یان دابەزاندووە.\n٣. ئەگەر لەسەر هەمان ئینتەرنێتن، لە کۆمپیوتەری ترەوە دەتوانن بچنە سەر ئەم ئایپییە: http://192.168.219.167:9090`);
    }, 12000);

    // 1. Establish Data Connection for Mouse & Keyboard
    activeDataConn = peer.connect(remotePeerId, { reliable: true });

    activeDataConn.on('open', () => {
        console.log('[DataConn] Connected to remote host data channel!');
        clearTimeout(connectTimeout);
        connectBtn.disabled = false;
        connectBtn.innerHTML = '▶';
    });

    activeDataConn.on('error', (err) => {
        console.error('[DataConn Error]', err);
        clearTimeout(connectTimeout);
        connectBtn.disabled = false;
        connectBtn.innerHTML = '▶';
        alert('پەیوەندی بە ئامێری مەبەستەوە پچڕا (Connection error). دڵنیابە لەوەی ئایدیەکە بە دروستی نووسراوە.');
    });

    // 2. Call remote peer to request their screen
    const dummyCanvas = document.createElement('canvas');
    dummyCanvas.width = 1;
    dummyCanvas.height = 1;
    const dummyStream = dummyCanvas.captureStream();

    const call = peer.call(remotePeerId, dummyStream);
    activeMediaCall = call;

    call.on('stream', (remoteStream) => {
        console.log('[Media] Received remote screen stream!');
        clearTimeout(connectTimeout);
        connectBtn.disabled = false;
        connectBtn.innerHTML = '▶';
        remoteVideo.srcObject = remoteStream;
        remoteVideo.play();
        setupCanvasRendering();
        showViewer(activeSessionId);
    });

    call.on('close', () => {
        clearTimeout(connectTimeout);
        connectBtn.disabled = false;
        connectBtn.innerHTML = '▶';
        endSession();
    });

    call.on('error', (err) => {
        console.error('[Call Error]', err);
        clearTimeout(connectTimeout);
        connectBtn.disabled = false;
        connectBtn.innerHTML = '▶';
    });
}

// --- Canvas Rendering & Input Handling (Client Viewer) ---
function setupCanvasRendering() {
    const ctx = remoteCanvas.getContext('2d');
    let lastTime = performance.now();
    let frameCount = 0;

    function renderLoop() {
        if (!remoteVideo.paused && !remoteVideo.ended && remoteVideo.videoWidth > 0) {
            remoteCanvas.width = remoteVideo.videoWidth;
            remoteCanvas.height = remoteVideo.videoHeight;
            ctx.drawImage(remoteVideo, 0, 0, remoteCanvas.width, remoteCanvas.height);

            frameCount++;
            const now = performance.now();
            if (now - lastTime >= 1000) {
                statFps.textContent = `${frameCount} FPS`;
                frameCount = 0;
                lastTime = now;
            }
        }
        if (remoteViewerContainer.style.display !== 'none') {
            requestAnimationFrame(renderLoop);
        }
    }
    requestAnimationFrame(renderLoop);
}

function showViewer(targetId) {
    mainDashboard.style.display = 'none';
    remoteViewerContainer.style.display = 'flex';
    viewerTab.style.display = 'flex';
    viewerTab.classList.add('active');
    mainTab.classList.remove('active');
    remoteSessionTitle.textContent = `Session: ${targetId}`;
    connectBtn.disabled = false;
    setupRemoteInputListeners();
}

function endSession() {
    if (activeDataConn && activeDataConn.open) {
        activeDataConn.send({ type: 'session_end' });
        activeDataConn.close();
    }
    if (activeMediaCall) {
        activeMediaCall.close();
        activeMediaCall = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
    }
    activeSessionId = null;
    remoteViewerContainer.style.display = 'none';
    viewerTab.style.display = 'none';
    mainDashboard.style.display = 'block';
    mainTab.classList.add('active');
    connectBtn.disabled = false;
}

// --- Send Mouse & Keyboard to Remote Host ---
function setupRemoteInputListeners() {
    let moveThrottle = 0;

    remoteCanvas.onmousemove = (e) => {
        const now = Date.now();
        if (now - moveThrottle < 16) return; // 60 updates/sec
        moveThrottle = now;

        const rect = remoteCanvas.getBoundingClientRect();
        const normX = (e.clientX - rect.left) / rect.width;
        const normY = (e.clientY - rect.top) / rect.height;

        if (normX >= 0 && normX <= 1 && normY >= 0 && normY <= 1) {
            sendRemoteCommand({ action: 'move', x: normX, y: normY });
        }
    };

    remoteCanvas.onmousedown = (e) => {
        e.preventDefault();
        const btn = e.button === 0 ? 'left' : e.button === 2 ? 'right' : 'middle';
        sendRemoteCommand({ action: 'mouse_down', button: btn });
    };

    remoteCanvas.onmouseup = (e) => {
        e.preventDefault();
        const btn = e.button === 0 ? 'left' : e.button === 2 ? 'right' : 'middle';
        sendRemoteCommand({ action: 'mouse_up', button: btn });
    };

    remoteCanvas.oncontextmenu = (e) => {
        e.preventDefault();
    };

    remoteCanvas.ondblclick = (e) => {
        e.preventDefault();
        sendRemoteCommand({ action: 'mouse_dblclick' });
    };

    remoteCanvas.onwheel = (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -120 : 120;
        sendRemoteCommand({ action: 'mouse_wheel', delta: delta });
    };

    window.onkeydown = (e) => {
        if (remoteViewerContainer.style.display === 'none') return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (['Tab', 'Backspace', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
        }

        sendRemoteCommand({ action: 'key_down', vk: e.keyCode });
    };

    window.onkeyup = (e) => {
        if (remoteViewerContainer.style.display === 'none') return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        sendRemoteCommand({ action: 'key_up', vk: e.keyCode });
    };
}

function sendRemoteCommand(inputData) {
    if (activeDataConn && activeDataConn.open) {
        activeDataConn.send({
            type: 'remote_input',
            ...inputData
        });
    }
}

// Save recent sessions
function saveRecentSession(id) {
    let recents = JSON.parse(localStorage.getItem('nazhadesk_recent') || '[]');
    if (!recents.some(r => r.id === id)) {
        recents.unshift({ id: id, name: 'Remote PC (' + id + ')', online: true });
        localStorage.setItem('nazhadesk_recent', JSON.stringify(recents.slice(0, 10)));
        renderRecentSessions();
    }
}

function renderRecentSessions() {
    let savedSessions = JSON.parse(localStorage.getItem('nazhadesk_recent') || '[]');
    sessionsGrid.innerHTML = '';
    savedSessions.slice(0, 8).forEach(session => {
        const card = document.createElement('div');
        card.className = 'session-card';
        card.innerHTML = `
            <div class="card-thumb" style="background: linear-gradient(135deg, #1e3a8a, #0284c7)">
                <div class="thumb-overlay">
                    <span class="session-status-dot"></span>
                    <span class="star-btn">★</span>
                </div>
            </div>
            <div class="card-info">
                <div>
                    <div class="session-name">${session.name || 'Remote PC'}</div>
                    <div class="session-id">${session.id}</div>
                </div>
                <button class="connect-btn" style="width:28px;height:28px;">▶</button>
            </div>
        `;
        card.addEventListener('click', () => {
            remoteAddressInput.value = session.id;
            startConnection(session.id);
        });
        sessionsGrid.appendChild(card);
    });
}

// UI Buttons & Listeners
connectBtn.addEventListener('click', () => {
    startConnection(remoteAddressInput.value.trim());
});

remoteAddressInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        startConnection(remoteAddressInput.value.trim());
    }
});

copyAddressBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(myDisplayId).then(() => {
        const originalText = myAddressText.textContent;
        myAddressText.textContent = translations[currentLanguage].copied;
        setTimeout(() => {
            myAddressText.textContent = originalText;
        }, 1500);
    });
});

testHostBtn.addEventListener('click', async () => {
    incomingCallerId.textContent = 'تاقیکردنەوەی لۆکاڵی شاشە (Local Test)';
    pendingCall = {
        answer: (stream) => {
            remoteVideo.srcObject = stream;
            remoteVideo.play();
            setupCanvasRendering();
            showViewer(myDisplayId);
        },
        close: () => {}
    };
    incomingModal.style.display = 'flex';
});

btnDisconnectSession.addEventListener('click', endSession);
closeSessionTabBtn.addEventListener('click', endSession);

mainTab.addEventListener('click', () => {
    if (remoteViewerContainer.style.display === 'flex') {
        remoteViewerContainer.style.display = 'none';
        mainDashboard.style.display = 'block';
        mainTab.classList.add('active');
        viewerTab.classList.remove('active');
    }
});

viewerTab.addEventListener('click', () => {
    if (activeSessionId) {
        mainDashboard.style.display = 'none';
        remoteViewerContainer.style.display = 'flex';
        viewerTab.classList.add('active');
        mainTab.classList.remove('active');
    }
});

btnToggleFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        remoteViewerContainer.requestFullscreen().catch(err => console.error(err));
    } else {
        document.exitFullscreen();
    }
});

btnSendText.addEventListener('click', () => {
    const text = prompt(translations[currentLanguage].sendTextPrompt);
    if (text) {
        sendRemoteCommand({ action: 'key_type', text: text });
    }
});

btnCtrlAltDel.addEventListener('click', () => {
    sendRemoteCommand({ action: 'key_down', vk: 17 });
    sendRemoteCommand({ action: 'key_down', vk: 18 });
    sendRemoteCommand({ action: 'key_down', vk: 46 });
    setTimeout(() => {
        sendRemoteCommand({ action: 'key_up', vk: 46 });
        sendRemoteCommand({ action: 'key_up', vk: 18 });
        sendRemoteCommand({ action: 'key_up', vk: 17 });
    }, 100);
});

langToggleBtn.addEventListener('click', () => {
    currentLanguage = currentLanguage === 'ckb' ? 'en' : 'ckb';
    document.documentElement.lang = currentLanguage;
    document.documentElement.dir = currentLanguage === 'ckb' ? 'rtl' : 'ltr';
    langToggleBtn.textContent = currentLanguage === 'ckb' ? '🌐 English' : '🌐 کوردی';
    document.getElementById('yourAddressLabel').textContent = translations[currentLanguage].yourAddress;
    document.getElementById('licenseLabel').textContent = translations[currentLanguage].license;
    document.getElementById('recentSessionsTitle').textContent = translations[currentLanguage].recentTitle;
    document.getElementById('inviteBtn').textContent = translations[currentLanguage].invite;
    remoteAddressInput.placeholder = translations[currentLanguage].remotePlaceholder;
});

themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('theme-dark');
});

// Fetch local IP badge
fetch('/api/info').then(res => res.json()).then(info => {
    const ipBadge = document.getElementById('localIpBadge');
    if (ipBadge && info.ip) {
        ipBadge.textContent = `ئایپی لۆکاڵ: ${info.ip}:${info.port || 9090}`;
    }
}).catch(() => {});

window.addEventListener('DOMContentLoaded', () => {
    initPeerConnection();
    renderRecentSessions();
});

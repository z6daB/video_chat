// Текстовый чат
const roomName = JSON.parse(document.getElementById('room-name').textContent);

const chatSocket = new WebSocket(
    'ws://' + window.location.host + '/ws/chat/' + roomName + '/'
);

chatSocket.onmessage = function(e) {
    const data = JSON.parse(e.data);
    const chatLog = document.querySelector('#chat-log');
    chatLog.value += data.username + ': ' + data.message + '\n';
    chatLog.scrollTop = chatLog.scrollHeight; // Автопрокрутка вниз
};

chatSocket.onclose = function(e) {
    console.error('Чат-сокет неожиданно закрылся');
};

document.querySelector('#chat-message-input').focus();
document.querySelector('#chat-message-input').onkeyup = function(e) {
    if (e.key === 'Enter') {
        document.querySelector('#chat-message-submit').click();
    }
};

document.querySelector('#chat-message-submit').onclick = function(e) {
    const messageInputDom = document.querySelector('#chat-message-input');
    const message = messageInputDom.value;
    const username = 'ваше_имя';

    chatSocket.send(JSON.stringify({
        'message': message,
        'username': username
    }));
    messageInputDom.value = '';
};

document.querySelector('#leave-chat-button').onclick = function(e) {
    window.location.pathname = '/';
};

// Видеочат
let localStream;
let peerConnection;
let isInitiator = false;
const iceCandidatesQueue = [];

const startVideoChatButton = document.getElementById('startVideoChat');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

const videoSocket = new WebSocket('ws://' + window.location.host + '/ws/video_chat/' + roomName + '/');

videoSocket.onopen = () => {
    console.log('WebSocket connection opened');
};

videoSocket.onclose = () => {
    console.log('WebSocket connection closed');
};

videoSocket.onerror = (error) => {
    console.error('WebSocket error:', error);
};

videoSocket.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    console.log('WebSocket message received:', data);

    // Инициализация PeerConnection, если это еще не сделано
    if (!peerConnection) {
        initializePeerConnection();
    }

    try {
        switch (data.type) {
            case 'offer':
                console.log('Received offer');
                if (!isInitiator) {
                    await handleOffer(data.offer);
                }
                break;
            case 'answer':
                console.log('Received answer');
                if (peerConnection.signalingState === 'have-local-offer') {
                    await handleAnswer(data.answer);
                }
                break;
            case 'ice-candidate':
                console.log('Received ICE candidate');
                handleIceCandidate(data.candidate);
                break;
            default:
                console.error('Unknown message type:', data.type);
        }
    } catch (e) {
        console.error('Error processing WebSocket message:', e);
    }
};

const servers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
        // Вы можете добавить свои ICE-серверы (STUN/TURN)
    ]
};

function initializePeerConnection() {
    console.log('Initializing PeerConnection');
    peerConnection = new RTCPeerConnection(servers);

    // Убедитесь, что обработчик получения треков настроен сразу
    peerConnection.ontrack = event => {
        console.log('Remote stream received:', event.streams[0]);
        if (remoteVideo.srcObject !== event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
        }
    };

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            console.log('Sending ICE candidate');
            videoSocket.send(JSON.stringify({
                type: 'ice-candidate',
                candidate: event.candidate
            }));
        }
    };

    // Добавляем локальные потоки, если они уже доступны
    if (localStream) {
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    }
}

async function handleOffer(offer) {
    console.log('Handling offer');
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    videoSocket.send(JSON.stringify({
        type: 'answer',
        answer: answer
    }));
    processIceCandidates();
}

async function handleAnswer(answer) {
    console.log('Handling answer');
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    processIceCandidates();
}

function handleIceCandidate(candidate) {
    console.log('Handling ICE candidate');
    if (peerConnection.signalingState === 'stable') {
        peerConnection.addIceCandidate(candidate).catch(e => console.error('Error adding ICE candidate:', e));
    } else {
        iceCandidatesQueue.push(candidate);
    }
}

startVideoChatButton.onclick = async () => {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        console.log('Local stream obtained:', localStream);

        if (!peerConnection) {
            initializePeerConnection();
        }

        // Добавляем локальные потоки, если их еще нет
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        if (!isInitiator) {
            isInitiator = true;
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            videoSocket.send(JSON.stringify({
                type: 'offer',
                offer: offer
            }));
        }
    } catch (e) {
        console.error('Error starting video chat:', e);
    }
};

function processIceCandidates() {
    console.log('Processing queued ICE candidates');
    while (iceCandidatesQueue.length > 0) {
        const candidate = iceCandidatesQueue.shift();
        peerConnection.addIceCandidate(candidate).catch(e => console.error('Error adding ICE candidate:', e));
    }
}

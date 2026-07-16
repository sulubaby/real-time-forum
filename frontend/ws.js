let socket = null;
const listeners = {};
let reconnectTimer = null;
let shouldReconnect = false;

export function connectSocket() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        return socket;
    }

    shouldReconnect = true;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

    socket.addEventListener("message", (event) => {
        let parsed;
        try {
            parsed = JSON.parse(event.data);
        } catch {
            return;
        }
        const { type, data } = parsed;
        (listeners[type] || []).forEach((cb) => cb(data));
    });

    socket.addEventListener("close", () => {
        if (shouldReconnect) {
            clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(connectSocket, 2000);
        }
    });

    return socket;
}

export function onSocketMessage(type, callback) {
    if (!listeners[type]) listeners[type] = [];
    listeners[type].push(callback);
    return () => {
        listeners[type] = (listeners[type] || []).filter(cb => cb !== callback);
    };
}

export function disconnectSocket() {
    shouldReconnect = false;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    if (socket) {
        socket.close();
        socket = null;
    }
}

export function sendSocketMessage(type, data) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ type, data }));
    return true;
}

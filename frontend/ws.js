let socket = null;
const listeners = {};

export function connectSocket() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        return socket;
    }

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
        setTimeout(connectSocket, 2000);
    });

    return socket;
}

export function onSocketMessage(type, callback) {
    if (!listeners[type]) listeners[type] = [];
    listeners[type].push(callback);
}

export function sendSocketMessage(type, data) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ type, data }));
    return true;
}
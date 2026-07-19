export class ApiError extends Error {
    constructor(message, status = 0, data = null) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.data = data;
    }
}

async function apiRequest(method, path, body) {
    const options = {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
    };
    if (body) options.body = JSON.stringify(body);

    let response;
    try {
        response = await fetch(path, options);
    } catch {
        throw new ApiError("The server is unreachable. Check your connection and try again.", 0);
    }
    const text = await response.text();

    let data;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }

    if (!response.ok) {
        const message = typeof data === "object" && data
            ? data.error || data.message
            : String(data || "").trim();
        throw new ApiError(message || `Request failed (${response.status})`, response.status, data);
    }

    return data;
}

export const api = {
    login: (data) => apiRequest("POST", "/api/login", data),
    register: (data) => apiRequest("POST", "/api/register", data),
    getMe: () => apiRequest("GET", "/api/me"),
    getCategories: () => apiRequest("GET", "/api/categories"),
    getPosts: (categoryIds) => {
        const params = categoryIds && categoryIds.length > 0
            ? "?categories=" + categoryIds.join(",")
            : "";
        return apiRequest("GET", "/api/posts" + params);
    },
    getPost: (id) => apiRequest("GET", "/api/post?id=" + id),
    createPost: (data) => apiRequest("POST", "/api/posts", data),
    createComment: (data) => apiRequest("POST", "/api/comments", data),
    toggleReaction: (data) => apiRequest("POST", "/api/reactions", data),
    logout: () => apiRequest("POST", "/api/logout"),
    getUsers: () => apiRequest("GET", "/api/users"),
    getMessages: (userId, beforeId = 0) => apiRequest(
        "GET",
        `/api/messages?user_id=${encodeURIComponent(userId)}${beforeId ? `&before_id=${encodeURIComponent(beforeId)}` : ""}`
    ),
};

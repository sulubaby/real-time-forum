async function apiRequest(method, path, body) {
    const options = {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(path, options);
    const text = await response.text();

    let data;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }

    if (!response.ok) {
        throw new Error(data.error || data.message || text || "Request failed");
    }

    return data;
}

export const api = {
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
};

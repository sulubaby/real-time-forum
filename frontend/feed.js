import { api } from "./api.js";
import { connectSocket, disconnectSocket, onSocketMessage, sendSocketMessage } from "./ws.js";
import { icon, notify, setButtonLoading } from "./ui.js";

let me;
let categories = [];
let users = [];
let filters = [];
let activeChat = null;
let hasMoreMessages = false;
let loadingMessages = false;
let socketHandlersBound = false;
let navigate;
let lastRefreshedAt = null;

const icons = {
    like: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v11H3V10h4Zm4.2 11H9V10l3.6-7c.4-.8 1.4-1.2 2.2-.8.7.3 1.1 1 1 1.8l-.7 4H20c1.1 0 2 .9 2 2l-1 8c-.2 1.7-1.7 3-3.5 3h-6.3Z"/></svg>`,
    dislike: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14V3H3v11h4Zm4.2-11H9v11l3.6 7c.4.8 1.4 1.2 2.2.8.7-.3 1.1-1 1-1.8l-.7-4H20c1.1 0 2-.9 2-2l-1-8c-.2-1.7-1.7-3-3.5-3h-6.3Z"/></svg>`,
};

function escapeHTML(value = "") {
    const element = document.createElement("div");
    element.textContent = value;
    return element.innerHTML;
}

function initials(name = "") {
    return name.slice(0, 2).toUpperCase();
}

function sortUsers() {
    users.sort((a, b) => {
        if (a.online !== b.online) return a.online ? -1 : 1;
        const aHasMessages = Boolean(a.lastMessage);
        const bHasMessages = Boolean(b.lastMessage);
        if (aHasMessages && bHasMessages && a.lastMessage !== b.lastMessage) {
            return b.lastMessage.localeCompare(a.lastMessage);
        }
        if (aHasMessages !== bHasMessages) return aHasMessages ? -1 : 1;
        return a.nickname.localeCompare(b.nickname, undefined, { sensitivity: "base" });
    });
}

function date(value, compact = false) {
    if (!value) return "";
    const parsed = new Date(value.replace(" ", "T"));
    return new Intl.DateTimeFormat(undefined, compact
        ? { hour: "numeric", minute: "2-digit" }
        : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
    ).format(parsed);
}

function handleRequestError(error, title = "Request failed") {
    if (error?.status === 401) {
        disconnectSocket();
        navigate("login");
        return;
    }
    if (error?.status === 404 || error?.status >= 500 || error?.status === 0) {
        disconnectSocket();
        navigate("error", {
            status: error.status || 503,
            message: error.message,
            authenticated: true,
        });
        return;
    }
    notify(error?.message || "Please try again.", "error", title);
}

function reactionButtons(item, type) {
    const idName = type === "post" ? "post-id" : "comment-id";
    return `<div class="${type}-reactions reactions">
        <button class="reaction-btn ${item.userReaction === "like" ? "active" : ""}" data-reaction="like" data-${idName}="${item.id}" aria-label="Like">${icons.like}<span>${item.likeCount}</span></button>
        <button class="reaction-btn ${item.userReaction === "dislike" ? "active dislike" : ""}" data-reaction="dislike" data-${idName}="${item.id}" aria-label="Dislike">${icons.dislike}<span>${item.dislikeCount}</span></button>
    </div>`;
}

function postHTML(post) {
    return `<article class="post-card" data-post-id="${post.id}">
        <div class="post-clickable">
            <header class="post-header">
                <span class="avatar">${initials(post.author)}</span>
                <div><strong title="${escapeHTML(post.author)}">${escapeHTML(post.author)}</strong><time>${date(post.createdAt)}</time></div>
            </header>
            <p class="post-content">${escapeHTML(post.content)}</p>
            <div class="post-tags">${(post.categories || []).map(cat => `<span>${escapeHTML(cat.name)}</span>`).join("")}</div>
            <footer class="post-footer">
                ${reactionButtons(post, "post")}
                <button class="comments-link" data-open-comments="${post.id}">${icon("message")} ${post.commentCount} ${post.commentCount === 1 ? "comment" : "comments"}</button>
            </footer>
        </div>
        <section class="post-comments" id="comments-${post.id}" hidden>
            <div class="comments-list" id="comments-list-${post.id}"></div>
            <form class="comment-form" data-post-id="${post.id}">
                <textarea id="comment-input-${post.id}" maxlength="1000" placeholder="Join the conversation…" rows="2"></textarea>
                <button class="primary-btn compact" type="submit">Reply</button>
            </form>
        </section>
    </article>`;
}

function commentHTML(comment) {
    return `<div class="comment" data-comment-id="${comment.id}">
        <div class="comment-line"><strong title="${escapeHTML(comment.author)}">${escapeHTML(comment.author)}</strong><time>${date(comment.createdAt)}</time></div>
        <p>${escapeHTML(comment.content)}</p>
        ${reactionButtons(comment, "comment")}
    </div>`;
}

async function loadPosts({ announce = false, showSkeleton = true } = {}) {
    const container = document.getElementById("posts-container");
    if (!container) return;
    const refreshButton = document.getElementById("refresh-feed");
    if (showSkeleton) container.innerHTML = `<div class="post-skeleton"><i></i><i></i><i></i></div><div class="post-skeleton"><i></i><i></i><i></i></div>`;
    setButtonLoading(refreshButton, true, "Refreshing…");
    try {
        const posts = await api.getPosts(filters);
        container.innerHTML = posts.length ? posts.map(postHTML).join("") :
            `<div class="empty-state"><strong>No posts here yet</strong><span>Start a conversation with the community.</span></div>`;
        lastRefreshedAt = new Date();
        const stamp = document.getElementById("refresh-stamp");
        if (stamp) stamp.textContent = `Updated ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(lastRefreshedAt)}`;
        if (announce) notify("The latest discussions are now visible.", "success", "Feed refreshed");
    } catch (error) {
        handleRequestError(error, "Could not load posts");
    } finally {
        setButtonLoading(refreshButton, false);
    }
}

function renderFilters() {
    const host = document.getElementById("category-filter");
    if (!host) return;
    host.innerHTML = `<button class="filter-chip ${filters.length ? "" : "active"}" data-filter="all">All posts</button>` +
        categories.map(cat => `<button class="filter-chip ${filters.includes(cat.id) ? "active" : ""}" data-filter="${cat.id}">${escapeHTML(cat.name)}</button>`).join("");
}

async function toggleComments(postId) {
    const section = document.getElementById(`comments-${postId}`);
    section.hidden = !section.hidden;
    if (section.hidden || section.dataset.loaded) return;
    try {
        const post = await api.getPost(postId);
        document.getElementById(`comments-list-${postId}`).innerHTML = post.comments?.length
            ? post.comments.map(commentHTML).join("")
            : `<p class="empty-comments">No comments yet. Be the first to reply.</p>`;
        section.dataset.loaded = "true";
    } catch {
        notify("Comments could not be loaded.", "error");
    }
}

async function sendComment(form) {
    const postId = Number(form.dataset.postId);
    const input = document.getElementById(`comment-input-${postId}`);
    if (!input.value.trim()) {
        notify("Write a comment before replying.", "error", "Comment is empty");
        return;
    }
    try {
        await api.createComment({ postId, content: input.value.trim() });
        input.value = "";
        const post = await api.getPost(postId);
        const list = document.getElementById(`comments-list-${postId}`);
        list.innerHTML = post.comments?.length ? post.comments.map(commentHTML).join("") : `<p class="empty-comments">No comments yet.</p>`;
        const link = document.querySelector(`[data-post-id="${postId}"] .comments-link`);
        if (link) link.innerHTML = `${icon("message")} ${post.commentCount} ${post.commentCount === 1 ? "comment" : "comments"}`;
        notify("Your comment was added.", "success");
    } catch (err) {
        handleRequestError(err, "Comment failed");
    }
}

async function react(button) {
    const targetType = button.dataset.postId ? "post" : "comment";
    const targetId = Number(button.dataset.postId || button.dataset.commentId);
    try {
        await api.toggleReaction({ targetType, targetId, reactionType: button.dataset.reaction });
        const item = targetType === "post" ? await api.getPost(targetId) : null;
        if (item) {
            const old = button.closest(".post-reactions");
            const holder = document.createElement("div");
            holder.innerHTML = reactionButtons(item, "post");
            old.replaceWith(holder.firstElementChild);
        } else {
            const card = button.closest(".post-card");
            if (card) {
                const post = await api.getPost(Number(card.dataset.postId));
                card.querySelector(".comments-list").innerHTML = post.comments.map(commentHTML).join("");
            }
        }
    } catch (error) {
        handleRequestError(error, "Reaction failed");
    }
}

function userItem(user) {
    const unread = user.unread || 0;
    return `<button class="user-item ${user.online ? "online" : ""} ${activeChat?.id === user.id ? "selected" : ""}" data-user-id="${user.id}">
        <span class="avatar">${initials(user.nickname)}<i></i></span>
        <span class="user-copy"><strong title="${escapeHTML(user.nickname)}">${escapeHTML(user.nickname)}</strong><small>${user.online ? "Online" : "Offline"}</small></span>
        ${unread ? `<b class="unread">${unread}</b>` : ""}
    </button>`;
}

function renderUsers() {
    const list = document.getElementById("users-list");
    if (!list) return;
    sortUsers();
    list.innerHTML = users.length ? users.map(userItem).join("") : `<p class="empty-users">No other members yet.</p>`;
}

async function loadUsers() {
    try {
        const fresh = await api.getUsers();
        users = fresh.map(user => ({ ...user, unread: users.find(old => old.id === user.id)?.unread || 0 }));
        sortUsers();
        renderUsers();
    } catch (error) {
        handleRequestError(error, "Members could not load");
    }
}

function chatMessageHTML(message) {
    const own = message.senderId === me.id;
    return `<div class="chat-message ${own ? "own" : ""}" data-message-id="${message.id}">
        <div><strong>${own ? "You" : escapeHTML(message.sender)}</strong><p>${escapeHTML(message.content)}</p><time>${date(message.createdAt, true)}</time></div>
    </div>`;
}

async function openChat(userId) {
    activeChat = users.find(user => user.id === userId);
    if (!activeChat) return;
    activeChat.unread = 0;
    renderUsers();
    document.getElementById("chat-empty").hidden = true;
    document.getElementById("chat-view").hidden = false;
    document.getElementById("chat-name").textContent = activeChat.nickname;
    document.getElementById("chat-name").title = activeChat.nickname;
    document.getElementById("chat-status").textContent = activeChat.online ? "Online now" : "Offline";
    updateChatComposer();
    const list = document.getElementById("chat-messages");
    list.innerHTML = `<div class="loading-state">Loading messages…</div>`;
    loadingMessages = true;
    try {
        const page = await api.getMessages(userId);
        hasMoreMessages = page.hasMore;
        list.innerHTML = page.messages.length
            ? page.messages.map(chatMessageHTML).join("")
            : `<div class="chat-start"><strong>Start a conversation</strong><span>Say hello to ${escapeHTML(activeChat.nickname)}.</span></div>`;
        list.scrollTop = list.scrollHeight;
    } catch (error) {
        hasMoreMessages = false;
        list.innerHTML = `<div class="chat-start"><strong>Messages could not load</strong><span>Please close this chat and try again.</span></div>`;
        handleRequestError(error, "Messages could not load");
    } finally {
        loadingMessages = false;
    }
}

function updateChatComposer() {
    if (!activeChat) return;
    const input = document.getElementById("chat-input");
    const button = document.getElementById("chat-send");
    input.disabled = !activeChat.online;
    button.disabled = !activeChat.online;
    input.placeholder = activeChat.online ? `Message ${activeChat.nickname}…` : `${activeChat.nickname} is offline`;
}

async function loadOlderMessages() {
    const list = document.getElementById("chat-messages");
    const first = list.querySelector("[data-message-id]");
    if (!activeChat || !hasMoreMessages || loadingMessages || !first || list.scrollTop > 80) return;
    loadingMessages = true;
    const oldHeight = list.scrollHeight;
    try {
        const page = await api.getMessages(activeChat.id, Number(first.dataset.messageId));
        hasMoreMessages = page.hasMore;
        if (page.messages.length) {
            list.insertAdjacentHTML("afterbegin", page.messages.map(chatMessageHTML).join(""));
            list.scrollTop = list.scrollHeight - oldHeight;
        }
    } finally {
        loadingMessages = false;
    }
}

function sendChat() {
    const input = document.getElementById("chat-input");
    if (!activeChat) return;
    if (!activeChat.online) {
        notify(`${activeChat.nickname} is offline right now.`, "info", "Message not sent");
        return;
    }
    if (!input.value.trim()) {
        notify("Write a message before sending.", "error", "Message is empty");
        return;
    }
    if (!sendSocketMessage("chat_message", { receiverId: activeChat.id, content: input.value.trim() })) {
        notify("Chat is reconnecting. Please try again in a moment.", "error", "Not connected");
        return;
    }
    input.value = "";
}

function receiveChatMessage(message) {
    const otherId = message.senderId === me.id ? message.receiverId : message.senderId;
    const user = users.find(item => item.id === otherId);
    if (user) {
        user.lastMessage = message.createdAt;
        if (activeChat?.id !== otherId && message.senderId !== me.id) user.unread = (user.unread || 0) + 1;
        sortUsers();
        renderUsers();
    }
    if (activeChat?.id !== otherId) return;
    const list = document.getElementById("chat-messages");
    list.querySelector(".chat-start")?.remove();
    if (!list.querySelector(`[data-message-id="${message.id}"]`)) list.insertAdjacentHTML("beforeend", chatMessageHTML(message));
    list.scrollTop = list.scrollHeight;
}

function bindSocketHandlers() {
    if (socketHandlersBound) return;
    socketHandlersBound = true;
    onSocketMessage("user_online", data => updatePresence(data.userId, true));
    onSocketMessage("user_offline", data => updatePresence(data.userId, false));
    onSocketMessage("chat_message", receiveChatMessage);
    onSocketMessage("chat_error", data => {
        notify(data.message, "error", "Message not sent");
    });
}

function updatePresence(id, online) {
    const user = users.find(item => item.id === id);
    if (!user) return loadUsers();
    user.online = online;
    if (activeChat?.id === id) {
        activeChat.online = online;
        document.getElementById("chat-status").textContent = online ? "Online now" : "Offline";
        updateChatComposer();
    }
    sortUsers();
    renderUsers();
}

function throttle(callback, wait = 250) {
    let lastCall = 0;
    let timeoutId = null;

    return (...args) => {
        const now = Date.now();
        const remaining = wait - (now - lastCall);

        if (remaining <= 0) {
            lastCall = now;
            callback(...args);
            return;
        }

        if (!timeoutId) {
            timeoutId = setTimeout(() => {
                timeoutId = null;
                lastCall = Date.now();
                callback(...args);
            }, remaining);
        }
    };
}

function bindEvents(navigateTo) {
    document.getElementById("logout-btn").addEventListener("click", async () => {
        disconnectSocket();
        try { await api.logout(); } finally { navigateTo("login"); }
    });
    document.getElementById("new-post-btn").addEventListener("click", () => document.getElementById("composer").classList.toggle("open"));
    document.getElementById("cancel-post").addEventListener("click", () => document.getElementById("composer").classList.remove("open"));
    document.getElementById("refresh-feed").addEventListener("click", () => loadPosts({ announce: true, showSkeleton: false }));
    document.getElementById("submit-post").addEventListener("click", async () => {
        const content = document.getElementById("post-content");
        const selected = [...document.querySelectorAll("#create-category-checkboxes input:checked")].map(input => Number(input.value));
        const button = document.getElementById("submit-post");
        if (!content.value.trim()) {
            notify("Write something before publishing your post.", "error", "Post is empty");
            content.focus();
            return;
        }
        if (!selected.length) {
            notify("Choose at least one topic for your post.", "error", "Topic required");
            return;
        }
        setButtonLoading(button, true, "Publishing…");
        try {
            await api.createPost({ content: content.value.trim(), categoryIds: selected });
            content.value = "";
            document.querySelectorAll("#create-category-checkboxes input").forEach(input => input.checked = false);
            document.getElementById("composer").classList.remove("open");
            await loadPosts({ showSkeleton: false });
            notify("Your post is now in the feed.", "success", "Post published");
        } catch (error) {
            handleRequestError(error, "Post could not be published");
        } finally {
            setButtonLoading(button, false);
        }
    });
    document.getElementById("category-filter").addEventListener("click", event => {
        const button = event.target.closest("[data-filter]");
        if (!button) return;
        if (button.dataset.filter === "all") filters = [];
        else {
            const id = Number(button.dataset.filter);
            filters = filters.includes(id) ? filters.filter(value => value !== id) : [...filters, id];
        }
        renderFilters();
        loadPosts();
    });
    document.getElementById("posts-container").addEventListener("click", event => {
        const reaction = event.target.closest(".reaction-btn");
        if (reaction) return react(reaction);
        const comments = event.target.closest("[data-open-comments]");
        if (comments) toggleComments(Number(comments.dataset.openComments));
    });
    document.getElementById("posts-container").addEventListener("submit", event => {
        const form = event.target.closest(".comment-form");
        if (form) { event.preventDefault(); sendComment(form); }
    });
    document.getElementById("users-list").addEventListener("click", event => {
        const item = event.target.closest("[data-user-id]");
        if (item) openChat(Number(item.dataset.userId));
    });
    document.getElementById("chat-close").addEventListener("click", () => {
        activeChat = null;
        document.getElementById("chat-view").hidden = true;
        document.getElementById("chat-empty").hidden = false;
        renderUsers();
    });
    document.getElementById("chat-send").addEventListener("click", sendChat);
    document.getElementById("chat-input").addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendChat(); }
    });
    let scrollFrame;
    const throttledLoadOlderMessages = throttle(() => loadOlderMessages(), 250);
    document.getElementById("chat-messages").addEventListener("scroll", () => {
        if (scrollFrame) return;
        scrollFrame = requestAnimationFrame(() => {
            scrollFrame = null;
            throttledLoadOlderMessages();
        });
    });
}

export async function renderFeed(app, navigateTo) {
    navigate = navigateTo;
    try {
        [me, categories] = await Promise.all([api.getMe(), api.getCategories()]);
    } catch (error) {
        if (error.status === 401) navigateTo("login");
        else navigateTo("error", { status: error.status || 503, message: error.message });
        return;
    }
    app.innerHTML = `<div class="app-shell">
        <header class="topbar">
            <div class="brand"><strong>Real-Time Forum</strong><small>Community space</small></div>
            <div class="top-actions"><button id="new-post-btn" class="primary-btn">${icon("plus")} <span>Create post</span></button><span class="profile-avatar">${initials(me.nickname)}</span><span class="profile-name" title="${escapeHTML(me.nickname)}">${escapeHTML(me.nickname)}</span><button id="logout-btn" class="icon-btn" title="Log out" aria-label="Log out">${icon("logout")}</button></div>
        </header>
        <main class="workspace">
            <aside class="people-panel">
                <div class="panel-heading"><div><strong>Messages</strong><small>Your conversations</small></div><span class="live-dot"></span></div>
                <div id="users-list" class="users-list"></div>
            </aside>
            <section class="feed-panel">
                <div class="feed-heading"><div><p class="eyebrow">Community</p><h1>Latest discussions</h1><p>Share an idea, ask a question, or join the conversation.</p></div><div class="feed-refresh"><button id="refresh-feed" class="secondary-btn refresh-btn">${icon("refresh")} <span>Refresh</span></button><small id="refresh-stamp">Not refreshed yet</small></div></div>
                <section id="composer" class="composer">
                    <textarea id="post-content" maxlength="5000" rows="4" placeholder="What would you like to discuss?"></textarea>
                    <div id="create-category-checkboxes" class="category-options">${categories.map(cat => `<label><input type="checkbox" value="${cat.id}"><span>${escapeHTML(cat.name)}</span></label>`).join("")}</div>
                    <div class="composer-actions"><button id="cancel-post" class="secondary-btn">${icon("close")} Cancel</button><button id="submit-post" class="primary-btn">${icon("check")} Publish post</button></div>
                </section>
                <nav id="category-filter" class="filter-row" aria-label="Filter posts"></nav>
                <div id="posts-container" class="posts"></div>
            </section>
            <aside class="chat-panel">
                <div id="chat-empty" class="chat-empty"><span class="chat-illustration">${icon("message")}</span><strong>Your messages</strong><p>Choose a member to open a private conversation.</p></div>
                <section id="chat-view" class="chat-view" hidden>
                    <header class="chat-header"><div><strong id="chat-name"></strong><small id="chat-status"></small></div><button id="chat-close" class="icon-btn" aria-label="Close chat">${icon("close")}</button></header>
                    <div id="chat-messages" class="chat-messages"></div>
                    <div class="chat-composer"><textarea id="chat-input" maxlength="2000" rows="1"></textarea><button id="chat-send" class="send-btn" aria-label="Send message">${icon("send")}</button></div>
                </section>
            </aside>
        </main>
    </div>`;
    renderFilters();
    bindEvents(navigateTo);
    // A login can replace the session cookie while an earlier tab's socket is still open.
    // Reconnect here so the WebSocket always belongs to the user currently shown in the UI.
    disconnectSocket();
    connectSocket();
    bindSocketHandlers();
    await Promise.all([loadPosts(), loadUsers()]);
}

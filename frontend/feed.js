import { api } from "./api.js";
import { connectSocket, onSocketMessage } from "./ws.js";

let currentUser = null;
let allCategories = [];
let activeFilterCategories = [];
let users = [];
let socketHandlersRegistered = false;
let globalListenersBound = false;

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr.replace(" ", "T"));
    return d.toLocaleString(undefined, {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit"
    });
}

function formatRelativeDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr.replace(" ", "T"));
    const now = new Date();
    const diff = now - d;
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return days + "d ago";
    return formatDate(dateStr);
}

function createPostHTML(post) {
    const cats = post.categories.map(c =>
        `<span class="category-tag">${escapeHtml(c.name)}</span>`
    ).join("");

    const preview = post.content.length > 200
        ? escapeHtml(post.content.substring(0, 200)) + "&hellip;"
        : escapeHtml(post.content);

    const likeActive = post.userReaction === "like" ? " reaction-active" : "";
    const dislikeActive = post.userReaction === "dislike" ? " reaction-active" : "";

    return `
        <article class="post-card" data-post-id="${post.id}">
            <div class="post-clickable">
                <div class="post-header">
                    <span class="post-author">${escapeHtml(post.author)}</span>
                    <span class="post-date">${formatDate(post.createdAt)}</span>
                </div>
                <div class="post-content">${preview}</div>
                <div class="post-meta">
                    <div class="post-categories">${cats}</div>
                    <span class="post-comments-count">${post.commentCount} comments</span>
                </div>
                <div class="post-reactions">
                    <button class="reaction-btn${likeActive}" data-reaction="like" data-post-id="${post.id}">+${post.likeCount}</button>
                    <button class="reaction-btn${dislikeActive}" data-reaction="dislike" data-post-id="${post.id}">-${post.dislikeCount}</button>
                </div>
            </div>
            <div class="post-comments" id="comments-${post.id}" style="display:none;">
                <div class="comments-list" id="comments-list-${post.id}"></div>
                <div class="comment-form">
                    <textarea id="comment-input-${post.id}" placeholder="Write a comment..." rows="2"></textarea>
                    <button class="btn-comment" data-post-id="${post.id}">REPLY</button>
                </div>
                <p class="error-msg" id="comment-error-${post.id}"></p>
            </div>
        </article>
    `;
}

function createCommentHTML(comment) {
    const likeActive = comment.userReaction === "like" ? " reaction-active" : "";
    const dislikeActive = comment.userReaction === "dislike" ? " reaction-active" : "";

    return `
        <div class="comment" data-comment-id="${comment.id}">
            <div class="comment-header">
                <span class="comment-author">${escapeHtml(comment.author)}</span>
                <span class="comment-date">${formatDate(comment.createdAt)}</span>
            </div>
            <div class="comment-content">${escapeHtml(comment.content)}</div>
            <div class="comment-reactions">
                <button class="reaction-btn reaction-btn-sm${likeActive}" data-reaction="like" data-comment-id="${comment.id}">+${comment.likeCount}</button>
                <button class="reaction-btn reaction-btn-sm${dislikeActive}" data-reaction="dislike" data-comment-id="${comment.id}">-${comment.dislikeCount}</button>
            </div>
        </div>
    `;
}

function renderUserList() {
    const container = document.getElementById("users-list");
    if (!container) return;

    const onlineUsers = users.filter(u => u.online);
    const offlineUsers = users.filter(u => !u.online);

    container.innerHTML = "";

    if (onlineUsers.length > 0) {
        const section = document.createElement("div");
        section.className = "users-section";
        section.innerHTML = '<div class="users-section-title">ONLINE</div>';
        onlineUsers.forEach(u => {
            section.appendChild(createUserItem(u));
        });
        container.appendChild(section);
    }

    if (offlineUsers.length > 0) {
        const section = document.createElement("div");
        section.className = "users-section";
        section.innerHTML = '<div class="users-section-title">OFFLINE</div>';
        offlineUsers.forEach(u => {
            section.appendChild(createUserItem(u));
        });
        container.appendChild(section);
    }
}

function createUserItem(user) {
    const div = document.createElement("div");
    div.className = "user-item" + (user.online ? " user-online" : "");
    div.dataset.userId = user.id;

    const lastMsg = user.lastMessage
        ? `<span class="user-last-msg">${formatRelativeDate(user.lastMessage)}</span>`
        : "";

    div.innerHTML = `
        <span class="user-status-dot"></span>
        <span class="user-name">${escapeHtml(user.nickname)}</span>
        ${lastMsg}
    `;

    div.addEventListener("click", () => {
        document.querySelectorAll(".user-item").forEach(el => el.classList.remove("user-selected"));
        div.classList.add("user-selected");
    });

    return div;
}

async function loadUsers() {
    try {
        users = await api.getUsers();
        if (currentUser) {
            const selfIdx = users.findIndex(u => u.id === currentUser.id);
            if (selfIdx > -1) users[selfIdx].online = true;
        }
        renderUserList();
    } catch {
        console.error("Failed to load users");
    }
}

function renderCategoryFilter() {
    const container = document.getElementById("category-filter");
    if (!container) return;

    container.innerHTML = "";

    const allBtn = document.createElement("button");
    allBtn.className = "filter-btn" + (activeFilterCategories.length === 0 ? " filter-active" : "");
    allBtn.textContent = "ALL";
    allBtn.addEventListener("click", () => {
        activeFilterCategories = [];
        loadPosts();
        renderCategoryFilter();
    });
    container.appendChild(allBtn);

    allCategories.forEach(cat => {
        const btn = document.createElement("button");
        const isActive = activeFilterCategories.includes(cat.id);
        btn.className = "filter-btn" + (isActive ? " filter-active" : "");
        btn.textContent = cat.name.toUpperCase();
        btn.addEventListener("click", () => {
            const idx = activeFilterCategories.indexOf(cat.id);
            if (idx > -1) {
                activeFilterCategories.splice(idx, 1);
            } else {
                activeFilterCategories.push(cat.id);
            }
            loadPosts();
            renderCategoryFilter();
        });
        container.appendChild(btn);
    });
}

async function submitPost() {
    const content = document.getElementById("post-content").value.trim();
    const checkedBoxes = document.querySelectorAll("#create-category-checkboxes input:checked");
    const categoryIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value));
    const errorEl = document.getElementById("create-post-error");
    errorEl.textContent = "";

    if (!content) { errorEl.textContent = "Content is required"; return; }
    if (categoryIds.length === 0) { errorEl.textContent = "Select at least one category"; return; }

    try {
        await api.createPost({ content, categoryIds });
        document.getElementById("post-content").value = "";
        checkedBoxes.forEach(cb => cb.checked = false);
        const section = document.getElementById("create-post-section");
        if (section) section.classList.remove("create-post-open");
        loadPosts();
    } catch (err) {
        errorEl.textContent = err.message;
    }
}

async function loadPosts() {
    const container = document.getElementById("posts-container");
    try {
        const posts = await api.getPosts(activeFilterCategories);
        if (posts.length === 0) {
            container.innerHTML = '<p class="empty-feed">No transmissions match your filter. Be the first!</p>';
            return;
        }
        container.innerHTML = posts.map(createPostHTML).join("");
    } catch {
        container.innerHTML = '<p class="error-msg">Failed to load posts</p>';
    }
}

async function togglePost(postId) {
    const commentsDiv = document.getElementById("comments-" + postId);
    if (!commentsDiv) return;

    if (commentsDiv.style.display === "block") {
        commentsDiv.style.display = "none";
        return;
    }

    commentsDiv.style.display = "block";

    if (!commentsDiv.dataset.loaded) {
        try {
            const post = await api.getPost(postId);
            const list = document.getElementById("comments-list-" + postId);
            if (post.comments && post.comments.length > 0) {
                list.innerHTML = post.comments.map(createCommentHTML).join("");
            } else {
                list.innerHTML = '<p class="empty-comments">No comments yet.</p>';
            }
            commentsDiv.dataset.loaded = "true";
        } catch {
            const errEl = document.getElementById("comment-error-" + postId);
            if (errEl) errEl.textContent = "Failed to load comments";
        }
    }
}

async function submitComment(postId) {
    const input = document.getElementById("comment-input-" + postId);
    const content = input.value.trim();
    const errEl = document.getElementById("comment-error-" + postId);
    if (errEl) errEl.textContent = "";

    if (!content) {
        if (errEl) errEl.textContent = "Comment cannot be empty";
        return;
    }

    try {
        await api.createComment({ postId, content });
        input.value = "";
        const post = await api.getPost(postId);
        const list = document.getElementById("comments-list-" + postId);
        if (post.comments && post.comments.length > 0) {
            list.innerHTML = post.comments.map(createCommentHTML).join("");
        }
    } catch (err) {
        if (errEl) errEl.textContent = err.message;
    }
}

async function handleReaction(e) {
    const btn = e.target.closest(".reaction-btn");
    if (!btn) return;

    const reactionType = btn.dataset.reaction;
    const postId = btn.dataset.postId;
    const commentId = btn.dataset.commentId;

    let targetType, targetId;
    if (postId) {
        targetType = "post";
        targetId = parseInt(postId);
    } else if (commentId) {
        targetType = "comment";
        targetId = parseInt(commentId);
    } else {
        return;
    }

    try {
        await api.toggleReaction({ targetType, targetId, reactionType });

        if (targetType === "post") {
            const postCard = btn.closest(".post-card");
            if (postCard) {
                const postIdVal = postCard.dataset.postId;
                const post = await api.getPost(postIdVal);
                const clickable = postCard.querySelector(".post-clickable");
                const reactionsDiv = clickable.querySelector(".post-reactions");
                if (reactionsDiv) {
                    const likeActive = post.userReaction === "like" ? " reaction-active" : "";
                    const dislikeActive = post.userReaction === "dislike" ? " reaction-active" : "";
                    reactionsDiv.innerHTML = `
                        <button class="reaction-btn${likeActive}" data-reaction="like" data-post-id="${post.id}">+${post.likeCount}</button>
                        <button class="reaction-btn${dislikeActive}" data-reaction="dislike" data-post-id="${post.id}">-${post.dislikeCount}</button>
                    `;
                }
            }
        } else {
            const commentsDiv = btn.closest(".post-comments");
            if (commentsDiv) {
                const postCard = commentsDiv.closest(".post-card");
                if (postCard) {
                    const post = await api.getPost(parseInt(postCard.dataset.postId));
                    const list = commentsDiv.querySelector(".comments-list");
                    if (post.comments && post.comments.length > 0) {
                        list.innerHTML = post.comments.map(createCommentHTML).join("");
                    }
                }
            }
        }
    } catch {
        console.error("Reaction failed");
    }
}


function addNewPostFromSocket(post) {
    const container = document.getElementById("posts-container");
    if (!container) return;

    if (document.querySelector(`.post-card[data-post-id="${post.id}"]`)) return;

    if (activeFilterCategories.length > 0) {
        const matches = (post.categoryIds || []).some(id => activeFilterCategories.includes(id));
        if (!matches) return;
    }

    const categories = allCategories.filter(c => (post.categoryIds || []).includes(c.id));
    const fullPost = { ...post, categories };

    const emptyMsg = container.querySelector(".empty-feed");
    if (emptyMsg) container.innerHTML = "";

    container.insertAdjacentHTML("afterbegin", createPostHTML(fullPost));
}

function addNewCommentFromSocket(comment) {
    const postCard = document.querySelector(`.post-card[data-post-id="${comment.postId}"]`);
    if (postCard) {
        const countEl = postCard.querySelector(".post-comments-count");
        if (countEl) {
            const current = parseInt(countEl.textContent) || 0;
            countEl.textContent = (current + 1) + " comments";
        }
    }

    const commentsDiv = document.getElementById("comments-" + comment.postId);
    if (!commentsDiv || !commentsDiv.dataset.loaded) return;

    if (document.querySelector(`.comment[data-comment-id="${comment.id}"]`)) return;

    const list = document.getElementById("comments-list-" + comment.postId);
    if (!list) return;

    const emptyMsg = list.querySelector(".empty-comments");
    if (emptyMsg) list.innerHTML = "";

    list.insertAdjacentHTML("beforeend", createCommentHTML(comment));
}

function updateReactionCountsFromSocket(data) {
    const { targetType, targetId, likeCount, dislikeCount } = data;

    const selector = targetType === "post"
        ? `.post-card[data-post-id="${targetId}"] .post-reactions`
        : `.comment[data-comment-id="${targetId}"] .comment-reactions`;

    const container = document.querySelector(selector);
    if (!container) return;

    const likeBtn = container.querySelector('[data-reaction="like"]');
    const dislikeBtn = container.querySelector('[data-reaction="dislike"]');
    if (likeBtn) likeBtn.textContent = "+" + likeCount;
    if (dislikeBtn) dislikeBtn.textContent = "-" + dislikeCount;
}

function updateUserOnlineStatus(userId, online) {
    const idx = users.findIndex(u => u.id === userId);
    if (idx > -1) {
        users[idx].online = online;
        renderUserList();
    } else {
        loadUsers();
    }
}

export async function renderFeed(app, navigateTo) {
    try {
        currentUser = await api.getMe();
    } catch {
        navigateTo("login");
        return;
    }

    try {
        allCategories = await api.getCategories();
    } catch {
        allCategories = [];
    }

    app.innerHTML = `
        <div class="app-layout">
            <header class="app-header">
                <h1 class="app-title">SULU-TIME-FORUM</h1>
                <div class="user-info">
                    <span class="user-nickname">${escapeHtml(currentUser.nickname)}</span>
                    <button id="logout-btn" class="btn-logout">LOGOUT</button>
                </div>
            </header>
            <div class="app-body">
                <aside class="users-panel" id="users-panel">
                    <div class="users-panel-header">
                        <h3 class="users-panel-title">USERS</h3>
                    </div>
                    <div class="users-list" id="users-list"></div>
                </aside>
                <div class="main-content">
                    <div class="create-post-section" id="create-post-section">
                        <div class="create-post-toggle" id="create-post-toggle">
                            <span class="create-post-icon">+</span>
                            <span>NEW TRANSMISSION</span>
                        </div>
                        <div class="create-post-body">
                            <textarea id="post-content" placeholder="Type your message..." rows="4"></textarea>
                            <div class="category-checkboxes" id="create-category-checkboxes"></div>
                            <button id="submit-post">SEND</button>
                            <p class="error-msg" id="create-post-error"></p>
                        </div>
                    </div>
                    <div class="category-filter-bar">
                        <div class="category-filter" id="category-filter"></div>
                    </div>
                    <section class="feed">
                        <h2 class="feed-title">LIVE FEED</h2>
                        <div id="posts-container"></div>
                    </section>
                </div>
            </div>
        </div>
    `;

    document.getElementById("logout-btn").addEventListener("click", async () => {
        try { await api.logout(); } catch {}
        window.location.reload();
    });

    document.getElementById("create-post-toggle").addEventListener("click", () => {
        document.getElementById("create-post-section").classList.toggle("create-post-open");
    });

    const catContainer = document.getElementById("create-category-checkboxes");
    allCategories.forEach(cat => {
        const label = document.createElement("label");
        label.className = "category-label";
        label.innerHTML = '<input type="checkbox" value="' + cat.id + '"> ' + escapeHtml(cat.name);
        catContainer.appendChild(label);
    });

    document.getElementById("submit-post").addEventListener("click", submitPost);
    document.getElementById("post-content").addEventListener("keydown", (e) => {
        if (e.key === "Enter" && e.ctrlKey) submitPost();
    });

    connectSocket();

    renderCategoryFilter();
    loadPosts();
    loadUsers();

    document.getElementById("posts-container").addEventListener("click", (e) => {
        if (e.target.closest(".reaction-btn")) return;
        const postCard = e.target.closest(".post-card");
        if (!postCard) return;
        if (e.target.closest(".post-comments") || e.target.closest(".btn-comment")) return;
        const postId = parseInt(postCard.dataset.postId);
        togglePost(postId);
    });

    if (!globalListenersBound) {
        document.addEventListener("click", (e) => {
            const btn = e.target.closest(".btn-comment");
            if (!btn) return;
            const postId = parseInt(btn.dataset.postId);
            submitComment(postId);
        });

        document.addEventListener("click", handleReaction);
        globalListenersBound = true;
    }

    if (!socketHandlersRegistered) {
        onSocketMessage("new_post", addNewPostFromSocket);
        onSocketMessage("new_comment", addNewCommentFromSocket);
        onSocketMessage("reaction_update", updateReactionCountsFromSocket);
        onSocketMessage("user_online", (data) => updateUserOnlineStatus(data.userId, true));
        onSocketMessage("user_offline", (data) => updateUserOnlineStatus(data.userId, false));
        socketHandlersRegistered = true;
    }
}
const paths = {
    plus: `<path d="M12 5v14M5 12h14"/>`,
    refresh: `<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>`,
    logout: `<path d="M10 17l5-5-5-5M15 12H3M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/>`,
    send: `<path d="m22 2-7 20-4-9-9-4 20-7ZM11 13 22 2"/>`,
    close: `<path d="m6 6 12 12M18 6 6 18"/>`,
    message: `<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/>`,
    check: `<path d="m5 12 4 4L19 6"/>`,
    alert: `<path d="M12 9v4m0 4h.01M10.3 3.8 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/>`,
    info: `<path d="M12 16v-4m0-4h.01M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0Z"/>`,
    arrowLeft: `<path d="m15 18-6-6 6-6"/>`,
    user: `<path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"/>`,
};

export function icon(name, className = "") {
    return `<svg class="ui-icon ${className}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.info}</svg>`;
}

function toastRoot() {
    let root = document.getElementById("toast-root");
    if (!root) {
        root = document.createElement("div");
        root.id = "toast-root";
        root.className = "toast-root";
        root.setAttribute("aria-live", "polite");
        document.body.appendChild(root);
    }
    return root;
}

export function notify(message, type = "info", title = "") {
    if (!message) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    const iconName = type === "success" ? "check" : type === "error" ? "alert" : "info";
    toast.innerHTML = `<span class="toast-icon">${icon(iconName)}</span><div><strong>${title || (type === "success" ? "Done" : type === "error" ? "Something went wrong" : "Notice")}</strong><p></p></div><button type="button" aria-label="Dismiss">${icon("close")}</button>`;
    toast.querySelector("p").textContent = String(message);
    const close = () => {
        toast.classList.add("toast-leaving");
        setTimeout(() => toast.remove(), 180);
    };
    toast.querySelector("button").addEventListener("click", close);
    toastRoot().appendChild(toast);
    setTimeout(close, type === "error" ? 6500 : 4200);
}

export function setButtonLoading(button, loading, label = "Working…") {
    if (!button) return;
    if (loading) {
        button.dataset.originalHtml = button.innerHTML;
        button.disabled = true;
        button.innerHTML = `<span class="button-spinner"></span><span>${label}</span>`;
    } else {
        button.disabled = false;
        if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
        delete button.dataset.originalHtml;
    }
}

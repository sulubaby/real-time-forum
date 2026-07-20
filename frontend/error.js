import { icon } from "./ui.js";
import { api } from "./api.js";

export function renderError(app, navigateTo, details = {}) {
    const status = Number(details.status) || 500;
    const isNotFound = status === 404;
    const title = details.title || (isNotFound ? "Page not found" : "We hit a problem");
    const message = details.message || (isNotFound
        ? "The page you requested does not exist or may have moved."
        : "The forum could not complete that request. Please try again.");

    app.innerHTML = `<main class="error-page">
        <section class="error-card">
            <div class="error-orbit"><span>${isNotFound ? "404" : "!"}</span></div>
            <p class="eyebrow">${isNotFound ? "Lost in the forum" : `Error ${status}`}</p>
            <h1>${title}</h1>
            <p class="error-description" id="error-description"></p>
            <div class="error-actions">
                <button id="error-home" class="primary-btn">${icon("arrowLeft")} Back to forum</button>
                <button id="error-retry" class="secondary-btn">${icon("refresh")} Try again</button>
                <button id="error-logout" class="secondary-btn">${icon("logout")} Log out</button>
            </div>
        </section>
    </main>`;
    document.getElementById("error-description").textContent = message;
    document.getElementById("error-home").addEventListener("click", () => navigateTo(details.authenticated ? "feed" : "login"));
    document.getElementById("error-retry").addEventListener("click", () => window.location.reload());
    document.getElementById("error-logout").addEventListener("click", async () => {
        try {
            await api.logout();
        } finally {
            navigateTo("login");
        }
    });
}

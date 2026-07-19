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
                <button id="error-home" class="primary-btn">Back to forum</button>
                <button id="error-retry" class="secondary-btn">Try again</button>
            </div>
        </section>
    </main>`;
    document.getElementById("error-description").textContent = message;
    document.getElementById("error-home").addEventListener("click", () => navigateTo(details.authenticated ? "feed" : "login"));
    document.getElementById("error-retry").addEventListener("click", () => window.location.reload());
}

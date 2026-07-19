import { api } from "./api.js";
import { navigateTo } from "./router.js";

window.addEventListener("error", event => {
    if (event.message) console.error(event.message);
});

window.addEventListener("unhandledrejection", event => {
    console.error(event.reason);
});

document.addEventListener("DOMContentLoaded", async () => {
    if (window.location.pathname !== "/" && window.location.pathname !== "/index.html") {
        navigateTo("error", { status: 404 });
        return;
    }
    try {
        await api.getMe();
        navigateTo("feed");
    } catch (error) {
        if (error.status >= 500 || error.status === 0) {
            navigateTo("error", { status: error.status || 503, message: error.message });
            return;
        }
        navigateTo("login");
    }
});

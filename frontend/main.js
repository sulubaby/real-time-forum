import { api } from "./api.js";
import { navigateTo } from "./router.js";
import { notify } from "./ui.js";

window.addEventListener("error", event => {
    if (event.message) notify("An unexpected interface error occurred. Please retry the action.", "error", "Interface error");
});

window.addEventListener("unhandledrejection", () => {
    notify("A request could not be completed. Please try again.", "error", "Unexpected error");
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

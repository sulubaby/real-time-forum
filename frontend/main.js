import { api } from "./api.js";
import { navigateTo } from "./router.js";

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await api.getMe();
        navigateTo("feed");
    } catch {
        navigateTo("login");
    }
});

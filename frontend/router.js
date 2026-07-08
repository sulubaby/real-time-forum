import { renderLogin, renderRegister } from "./auth.js";

const app = document.getElementById("app");

export function navigateTo(viewName) {
    if (viewName === "login") {
        renderLogin(app, navigateTo);
    } else if (viewName === "register") {
        renderRegister(app, navigateTo);
    }
    // more views (feed, chat, etc.) get added here as you build them
}
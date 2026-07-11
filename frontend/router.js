import { renderLogin, renderRegister } from "./auth.js";
import { renderFeed } from "./feed.js";

const app = document.getElementById("app");

export function navigateTo(viewName) {
    if (viewName === "login") {
        renderLogin(app, navigateTo);
    } else if (viewName === "register") {
        renderRegister(app, navigateTo);
    } else if (viewName === "feed") {
        renderFeed(app, navigateTo);
    }
}

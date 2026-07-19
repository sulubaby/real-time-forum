import { renderLogin, renderRegister } from "./auth.js";
import { renderFeed } from "./feed.js";
import { renderError } from "./error.js";

const app = document.getElementById("app");

export function navigateTo(viewName, details = {}) {
    if (viewName === "login") {
        renderLogin(app, navigateTo);
    } else if (viewName === "register") {
        renderRegister(app, navigateTo);
    } else if (viewName === "feed") {
        renderFeed(app, navigateTo);
    } else if (viewName === "error") {
        renderError(app, navigateTo, details);
    } else {
        renderError(app, navigateTo, { status: 404 });
    }
}

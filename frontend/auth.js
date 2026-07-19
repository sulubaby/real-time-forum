import { api } from "./api.js";
import { setButtonLoading } from "./ui.js";

function authShell(title, subtitle, form, footer) {
    return `<main class="auth-page">
        <section class="auth-brand-panel">
            <div class="auth-brand"><span class="brand-mark">F</span><strong>Forum</strong></div>
            <div><p class="eyebrow">A place to belong</p><h1>Ideas become better through conversation.</h1><p>Meet the community, share what you know, and keep every discussion moving.</p></div>
            <div class="auth-feature-list"><span>Real-time private chat</span><span>Community discussions</span><span>Simple and focused</span></div>
        </section>
        <section class="auth-form-panel">
            <div class="auth-form-card"><div class="mobile-auth-brand"><span class="brand-mark">F</span><strong>Forum</strong></div><p class="eyebrow">Welcome</p><h2>${title}</h2><p class="auth-subtitle">${subtitle}</p>${form}<p class="auth-switch">${footer}</p></div>
        </section>
    </main>`;
}

export function renderLogin(app, navigateTo) {
    app.innerHTML = authShell(
        "Welcome back",
        "Sign in with your nickname or email.",
        `<form id="login-form" novalidate>
            <label for="login-identifier">Nickname or email</label>
            <input type="text" id="login-identifier" maxlength="100" autocomplete="username" placeholder="you@example.com" required>
            <label for="login-password">Password</label>
            <input type="password" id="login-password" maxlength="30" autocomplete="current-password" placeholder="Enter your password" required>
            <button type="submit" class="primary-btn auth-submit">Sign in</button>
        </form>`,
        `New to the community? <a href="#" id="go-register">Create an account</a>`
    );

    document.getElementById("go-register").addEventListener("click", event => {
        event.preventDefault();
        navigateTo("register");
    });
    document.getElementById("login-form").addEventListener("submit", async event => {
        event.preventDefault();
        const button = event.currentTarget.querySelector("button[type=submit]");
        const identifier = document.getElementById("login-identifier").value.trim();
        const password = document.getElementById("login-password").value;
        if (!identifier || !password) {
            event.currentTarget.reportValidity();
            return;
        }
        setButtonLoading(button, true, "Signing in…");
        try {
            await api.login({ identifier, password });
            navigateTo("feed");
        } catch (error) {
            if (error.status >= 500 || error.status === 0) {
                navigateTo("error", { status: error.status || 503, message: error.message });
            }
        } finally {
            setButtonLoading(button, false);
        }
    });
}

export function renderRegister(app, navigateTo) {
    app.innerHTML = authShell(
        "Create your account",
        "A few details and you’re ready to join.",
        `<form id="register-form" class="register-grid" novalidate>
            <div class="field-wide"><label for="reg-nickname">Nickname</label><input type="text" id="reg-nickname" maxlength="20" autocomplete="username" placeholder="Choose a nickname" required></div>
            <div><label for="reg-firstname">First name</label><input type="text" id="reg-firstname" maxlength="50" autocomplete="given-name" placeholder="First name" required></div>
            <div><label for="reg-lastname">Last name</label><input type="text" id="reg-lastname" maxlength="50" autocomplete="family-name" placeholder="Last name" required></div>
            <div><label for="reg-age">Age</label><input type="number" id="reg-age" min="13" max="80" placeholder="Age" required></div>
            <div><label for="reg-gender">Gender</label><select id="reg-gender" required><option value="" disabled selected>Select</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></div>
            <div class="field-wide"><label for="reg-email">Email</label><input type="email" id="reg-email" maxlength="100" autocomplete="email" placeholder="you@example.com" required></div>
            <div class="field-wide"><label for="reg-password">Password</label><input type="password" id="reg-password" minlength="8" maxlength="30" autocomplete="new-password" placeholder="8–30 characters" required></div>
            <button type="submit" class="primary-btn auth-submit field-wide">Create account</button>
        </form>`,
        `Already have an account? <a href="#" id="go-login">Sign in</a>`
    );

    document.getElementById("go-login").addEventListener("click", event => {
        event.preventDefault();
        navigateTo("login");
    });
    document.getElementById("register-form").addEventListener("submit", async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const button = form.querySelector("button[type=submit]");
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        const userData = {
            nickname: document.getElementById("reg-nickname").value.trim(),
            firstName: document.getElementById("reg-firstname").value.trim(),
            lastName: document.getElementById("reg-lastname").value.trim(),
            age: Number(document.getElementById("reg-age").value),
            gender: document.getElementById("reg-gender").value,
            email: document.getElementById("reg-email").value.trim(),
            password: document.getElementById("reg-password").value,
        };
        setButtonLoading(button, true, "Creating account…");
        try {
            await api.register(userData);
            navigateTo("login");
        } catch (error) {
            if (error.status >= 500 || error.status === 0) {
                navigateTo("error", { status: error.status || 503, message: error.message });
            }
        } finally {
            setButtonLoading(button, false);
        }
    });
}

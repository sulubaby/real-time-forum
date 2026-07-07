document.addEventListener("DOMContentLoaded", () => {
    const app = document.getElementById("app");

    const loginView = `
        <div class="auth-container">
            <h2>Login to Forum</h2>
            <form id="login-form">
                <input type="text" id="login-identifier" placeholder="Nickname or Email" required><br>
                <input type="password" id="login-password" placeholder="Password" required><br>
                <button type="submit">Login</button>
            </form>
            <p id="login-error" style="color: red;"></p>
            <p>Don't have an account? <a href="#" id="go-register">Register here</a></p>
        </div>
    `;

    const registerView = `
        <div class="auth-container">
            <h2>Create an Account</h2>
            <form id="register-form">
                <input type="text" id="reg-nickname" placeholder="Nickname" required><br>
                <input type="text" id="reg-firstname" placeholder="First Name" required><br>
                <input type="text" id="reg-lastname" placeholder="Last Name" required><br>
                <input type="number" id="reg-age" placeholder="Age" min="1" required><br>
                
                <select id="reg-gender" required>
                    <option value="" disabled selected>Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                </select><br>

                <input type="email" id="reg-email" placeholder="Email" required><br>
                <input type="password" id="reg-password" placeholder="Password" required><br>
                <button type="submit">Register</button>
            </form>
            <p id="reg-error" style="color: red;"></p>
            <p>Already have an account? <a href="#" id="go-login">Login here</a></p>
        </div>
    `;

    function navigateTo(viewName) {
        if (viewName === "login") {
            app.innerHTML = loginView;
            
            document.getElementById("go-register").addEventListener("click", (e) => {
                e.preventDefault();
                navigateTo("register");
            });

            const form = document.getElementById("login-form");
            form.addEventListener("submit", async (e) => {
                e.preventDefault(); 

                const errorField = document.getElementById("login-error");
                errorField.textContent = ""; 

                const loginData = {
                    identifier: document.getElementById("login-identifier").value,
                    password: document.getElementById("login-password").value
                };

                try {
                    const response = await fetch("/api/login", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(loginData)
                    });

                    if (response.ok) {
                        alert("Login successful! Welcome to the forum.");
                    } else {
                        const errText = await response.text();
                        errorField.textContent = errText;
                    }
                } catch (err) {
                    errorField.textContent = "Server is unreachable right now.";
                }
            });

        } else if (viewName === "register") {
            app.innerHTML = registerView;

            document.getElementById("go-login").addEventListener("click", (e) => {
                e.preventDefault();
                navigateTo("login");
            });

            const form = document.getElementById("register-form");
            form.addEventListener("submit", async (e) => {
                e.preventDefault(); 

                const errorField = document.getElementById("reg-error");
                errorField.textContent = ""; 

                const userData = {
                    nickname: document.getElementById("reg-nickname").value,
                    firstName: document.getElementById("reg-firstname").value,
                    lastName: document.getElementById("reg-lastname").value,
                    age: parseInt(document.getElementById("reg-age").value),
                    gender: document.getElementById("reg-gender").value,
                    email: document.getElementById("reg-email").value,
                    password: document.getElementById("reg-password").value
                };

                try {
                    const response = await fetch("/api/register", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(userData)
                    });

                    if (response.ok) {
                        alert("Registration successful! Please login.");
                        navigateTo("login");
                    } else {
                        const errText = await response.text();
                        errorField.textContent = errText;
                    }
                } catch (err) {
                    errorField.textContent = "Server is unreachable right now.";
                }
            });
        }
    }

    navigateTo("login");
});
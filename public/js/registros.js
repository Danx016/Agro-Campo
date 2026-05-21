document.addEventListener('DOMContentLoaded', () => {
    const passwordInput = document.getElementById("password");
    const confirmInput = document.getElementById("confirmPassword");
    const toggleIcon = document.getElementById("toggle-password-btn");
    
    // Toggle password visibility
    if (toggleIcon && passwordInput && confirmInput) {
        toggleIcon.addEventListener("click", () => {
            if (passwordInput.type === "password") {
                passwordInput.type = "text";
                confirmInput.type = "text";
                toggleIcon.classList.remove("fa-eye");
                toggleIcon.classList.add("fa-eye-slash");
            } else {
                passwordInput.type = "password";
                confirmInput.type = "password";
                toggleIcon.classList.remove("fa-eye-slash");
                toggleIcon.classList.add("fa-eye");
            }
        });
    }

    const strengthContainer = document.getElementById("password-strength-container");
    const strengthFill = document.getElementById("strength-bar-fill");
    const strengthText = document.getElementById("strength-text");
    
    const reqLength = document.getElementById("req-length");
    const reqUpper = document.getElementById("req-upper");
    const reqNumber = document.getElementById("req-number");
    const reqSpecial = document.getElementById("req-special");

    if (passwordInput) {
        passwordInput.addEventListener("input", function() {
            const password = passwordInput.value;
            
            if (password === "") {
                strengthContainer.style.display = "none";
                return;
            }
            
            strengthContainer.style.display = "block";
            
            // Rules
            const hasLength = password.length >= 8;
            const hasUpper = /[A-Z]/.test(password);
            const hasNumber = /[0-9]/.test(password);
            const hasSpecial = /[^A-Za-z0-9]/.test(password);
            
            // Update requirements icons and classes
            updateRequirement(reqLength, hasLength);
            updateRequirement(reqUpper, hasUpper);
            updateRequirement(reqNumber, hasNumber);
            updateRequirement(reqSpecial, hasSpecial);
            
            // Calculate Score (0 - 4)
            let score = 0;
            if (hasLength) score++;
            if (hasUpper) score++;
            if (hasNumber) score++;
            if (hasSpecial) score++;
            
            // Determine level
            strengthFill.className = "strength-bar-fill";
            strengthText.className = "strength-text";
            
            if (!hasLength) {
                // If it is shorter than 8 characters, it must be Weak (Rojo)
                strengthFill.classList.add("weak");
                strengthText.classList.add("weak");
                strengthText.textContent = "Insegura (Muy corta)";
            } else if (score === 4) {
                // If it meets all 4 requirements, it's Strong (Verde)
                strengthFill.classList.add("strong");
                strengthText.classList.add("strong");
                strengthText.textContent = "Segura (Fuerte)";
            } else if (score >= 2) {
                // If it has length and at least 2 other categories, it's Medium (Amarillo)
                strengthFill.classList.add("medium");
                strengthText.classList.add("medium");
                strengthText.textContent = "Moderada (Media)";
            } else {
                strengthFill.classList.add("weak");
                strengthText.classList.add("weak");
                strengthText.textContent = "Insegura (Débil)";
            }
        });
    }

    function updateRequirement(element, isValid) {
        if (!element) return;
        const icon = element.querySelector("i");
        if (isValid) {
            element.classList.add("valid");
            if (icon) {
                icon.className = "fa-solid fa-circle-check text-success";
            }
        } else {
            element.classList.remove("valid");
            if (icon) {
                icon.className = "fa-regular fa-circle-xmark text-danger";
            }
        }
    }

    // --- Real-time Username Check ---
    const apodoInput = document.getElementById("apodo");
    const usernameFeedback = document.getElementById("username-feedback");
    let usernameTimeout = null;

    if (apodoInput && usernameFeedback) {
        // Initialize availability flag
        apodoInput.dataset.available = "false";

        apodoInput.addEventListener("input", () => {
            const username = apodoInput.value.trim();
            
            // Clear previous timeout
            clearTimeout(usernameTimeout);

            if (username === "") {
                usernameFeedback.style.display = "none";
                usernameFeedback.className = "feedback-msg";
                usernameFeedback.textContent = "";
                apodoInput.dataset.available = "false";
                return;
            }

            // Quick pattern regex check (alphanumeric, underscore, dots, and hyphens, no spaces, no accents)
            const usernameRegex = /^[a-zA-Z0-9_.-]+$/;
            if (!usernameRegex.test(username)) {
                usernameFeedback.style.display = "block";
                usernameFeedback.className = "feedback-msg error";
                usernameFeedback.textContent = "El nombre de usuario solo puede contener letras, números, puntos o guiones bajos (sin espacios ni acentos).";
                apodoInput.dataset.available = "false";
                return;
            }

            // Validar que incluya al menos un número, guión bajo o punto para estructuración
            if (!/[0-9_.-]/.test(username)) {
                usernameFeedback.style.display = "block";
                usernameFeedback.className = "feedback-msg error";
                usernameFeedback.textContent = "El usuario debe incluir al menos un número, guión bajo (_) o punto.";
                apodoInput.dataset.available = "false";
                return;
            }

            if (username.length < 3) {
                usernameFeedback.style.display = "block";
                usernameFeedback.className = "feedback-msg error";
                usernameFeedback.textContent = "El usuario debe tener al menos 3 caracteres.";
                apodoInput.dataset.available = "false";
                return;
            }

            usernameFeedback.style.display = "block";
            usernameFeedback.className = "feedback-msg";
            usernameFeedback.style.color = "#64748b";
            usernameFeedback.textContent = "Verificando disponibilidad...";

            // Debounce the server fetch for 300ms
            usernameTimeout = setTimeout(async () => {
                try {
                    const response = await fetch(`/register/check-username?username=${encodeURIComponent(username)}`);
                    const result = await response.json();
                    
                    if (result.available) {
                        usernameFeedback.className = "feedback-msg success";
                        usernameFeedback.style.color = ""; // Use CSS rules
                        usernameFeedback.textContent = "✓ Nombre de usuario disponible";
                        apodoInput.dataset.available = "true";
                    } else {
                        usernameFeedback.className = "feedback-msg error";
                        usernameFeedback.style.color = ""; // Use CSS rules
                        usernameFeedback.textContent = result.message || "Nombre de usuario ya utilizado, selecciona otro";
                        apodoInput.dataset.available = "false";
                    }
                } catch (err) {
                    console.error("Error checking username availability:", err);
                    usernameFeedback.style.display = "none";
                }
            }, 300);
        });
    }
});

// Función para mostrar alerta visual
function showAlert(icon, title, message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'alert-overlay';
    overlay.innerHTML = `
        <div class="alert-box">
            <div class="alert-icon">${icon}</div>
            <div class="alert-title">${title}</div>
            <div class="alert-message">${message}</div>
            <button class="alert-button">Continuar</button>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    const button = overlay.querySelector('.alert-button');
    button.addEventListener('click', () => {
        overlay.remove();
        if (onConfirm) onConfirm();
    });
}

document.getElementById("registerForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const apodoInput = document.getElementById("apodo");
    const apodo = apodoInput.value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const terms = document.getElementById("terms").checked;
    
    // Username validation check
    if (apodoInput.dataset.available !== "true") {
        showAlert("❌", "Nombre de Usuario Inválido", "El nombre de usuario ya está en uso o no cumple con los requisitos. Por favor, intenta con otro.");
        apodoInput.focus();
        return;
    }

    if (password !== confirmPassword) {
        showAlert("❌", "Contraseñas No Coinciden", "Las contraseñas que ingresaste no son iguales. Intenta de nuevo.");
        return;
    }
    if (!terms) {
        showAlert("⚠️", "Términos y Condiciones", "Debes aceptar los términos y condiciones para continuar.");
        return;
    }

    // Client-side strength enforcement
    const hasLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    
    let score = 0;
    if (hasLength) score++;
    if (hasUpper) score++;
    if (hasNumber) score++;
    if (hasSpecial) score++;

    if (!hasLength) {
        showAlert("🔒", "Contraseña Débil", "La contraseña debe tener al menos 8 caracteres.");
        return;
    }

    if (score < 2) {
        showAlert("🔒", "Contraseña Insegura", "La contraseña es demasiado débil. Asegúrate de incluir mayúsculas, números y caracteres especiales.");
        return;
    }

    try {
        // Obtener CSRF token (primero por input oculto, si no por cookie XSRF-TOKEN)
        const csrfInput = document.getElementById('csrfToken');
        let csrfToken = csrfInput && csrfInput.value ? csrfInput.value : null;
        if (!csrfToken) {
            const csrfCookie = document.cookie.split('; ').find(row => row.trim().startsWith('XSRF-TOKEN='));
            csrfToken = csrfCookie ? decodeURIComponent(csrfCookie.split('=')[1]) : null;
        }

        const headers = { "Content-Type": "application/json" };
        if (csrfToken) headers['x-csrf-token'] = csrfToken;

        const response = await fetch("/register", {
            method: "POST",
            headers,
            // terms must be sent as string 'true' to match express-validator .equals('true') rule
            body: JSON.stringify({ name, apodo, email, password, confirmPassword, terms: terms ? 'true' : 'false' }),
        });

        const result = await response.json();
        
        if (response.ok) {
            showAlert("✅", "¡Registro Exitoso!", "Tu cuenta ha sido creada correctamente. Te redirigiremos al inicio de sesión.", () => {
                window.location.href = "/login";
            });
        } else {
            // If validation errors exist, show them specifically
            if (result.errors && result.errors.length > 0) {
                const errorMessages = result.errors.map(err => err.message).join('\n');
                showAlert("❌", "Error en el Registro", errorMessages);
            } else {
                showAlert("❌", "Error", result.message || "Ocurrió un error al registrar. Intenta nuevamente.");
            }
        }
    } catch (error) {
        console.error("Error al registrar:", error);
        showAlert("❌", "Error de Conexión", "Ocurrió un error al registrar. Por favor, intenta nuevamente.");
    }
});

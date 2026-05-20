document.addEventListener('DOMContentLoaded', function() {
    const passwordForm = document.getElementById('passwordForm');
    const emailInput = document.getElementById('email');
    const successModal = document.getElementById('successModal');
    const closeModal = document.getElementById('closeModal');
    
    // Elementos de Pasos
    const step1 = document.getElementById('step-1');
    const step2 = document.getElementById('step-2');
    const btnSendCode = document.getElementById('btn-send-code');
    const btnBackToStep1 = document.getElementById('btn-back-to-step-1');
    
    // Elementos del Paso 2
    const codeInput = document.getElementById('recovery-code');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');

    // Control de Loader Global
    function showLoader() {
        const loader = document.getElementById('global-loader');
        if (loader) loader.style.display = 'flex';
    }

    function hideLoader() {
        const loader = document.getElementById('global-loader');
        if (loader) loader.style.display = 'none';
    }
    
    // Mostrar contenedor con animación
    const passwordContainer = document.querySelector('.password-container');
    setTimeout(() => {
        if (passwordContainer) passwordContainer.classList.add('show');
    }, 100);
    
    // Paso 1: Enviar Código de Recuperación al Correo
    btnSendCode.addEventListener('click', async function(e) {
        e.preventDefault();
        const email = emailInput.value.trim();
        
        if (!email || !isValidEmail(email)) {
            alert('Por favor ingresa un correo electrónico válido');
            return;
        }

        const loader = document.getElementById("global-loader");
        const loaderIcon = document.getElementById("loader-icon");
        const loaderText = document.getElementById("loader-text");

        if (loader) {
            loader.style.display = "flex";
            if (loaderIcon) {
                loaderIcon.className = "fa fa-spinner fa-spin fa-3x";
                loaderIcon.style.color = "#4f46e5";
            }
            if (loaderText) {
                loaderText.textContent = "Buscando cuenta y enviando código...";
                loaderText.style.color = "";
            }
        }

        try {
            const response = await fetch('/api/recover/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok) {
                // Éxito: código enviado
                if (loaderIcon) {
                    loaderIcon.className = "fa-solid fa-circle-check fa-3x";
                    loaderIcon.style.color = "#10b981";
                }
                if (loaderText) {
                    loaderText.textContent = data.message || "¡Código enviado con éxito! Revisa tu correo.";
                    loaderText.style.color = "#10b981";
                }

                // Esperar 1.8 segundos y pasar al paso 2
                setTimeout(() => {
                    if (loader) loader.style.display = "none";
                    step1.style.display = 'none';
                    step2.style.display = 'block';
                    if (codeInput) codeInput.focus();
                }, 1800);
            } else {
                // Error: correo no registrado, etc.
                if (loaderIcon) {
                    loaderIcon.className = "fa-solid fa-circle-xmark fa-3x";
                    loaderIcon.style.color = "#ef4444";
                }
                if (loaderText) {
                    loaderText.textContent = data.message || "Error al enviar el código.";
                    loaderText.style.color = "#ef4444";
                }

                setTimeout(() => {
                    if (loader) loader.style.display = "none";
                }, 2500);
            }
        } catch (error) {
            console.error('Error al solicitar código:', error);
            if (loaderIcon) {
                loaderIcon.className = "fa-solid fa-triangle-exclamation fa-3x";
                loaderIcon.style.color = "#ef4444";
            }
            if (loaderText) {
                loaderText.textContent = "Error de red al procesar tu solicitud.";
                loaderText.style.color = "#ef4444";
            }

            setTimeout(() => {
                if (loader) loader.style.display = "none";
            }, 2500);
        }
    });

    // Paso 2: Restablecer Contraseña (Enviar código + nueva contraseña)
    passwordForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = emailInput.value.trim();
        const code = codeInput.value.trim();
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        // Validaciones en cliente
        if (!code || code.length !== 6 || isNaN(code)) {
            alert('Por favor ingresa el código de 6 dígitos enviado a tu correo.');
            return;
        }
        
        if (!newPassword || newPassword.length < 8) {
            alert('La nueva contraseña debe tener al menos 8 caracteres.');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            alert('Las contraseñas no coinciden.');
            return;
        }

        const loader = document.getElementById("global-loader");
        const loaderIcon = document.getElementById("loader-icon");
        const loaderText = document.getElementById("loader-text");

        if (loader) {
            loader.style.display = "flex";
            if (loaderIcon) {
                loaderIcon.className = "fa fa-spinner fa-spin fa-3x";
                loaderIcon.style.color = "#4f46e5";
            }
            if (loaderText) {
                loaderText.textContent = "Restableciendo contraseña...";
                loaderText.style.color = "";
            }
        }

        try {
            const response = await fetch('/api/recover/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code, newPassword })
            });

            const data = await response.json();

            if (response.ok) {
                // Éxito: contraseña restablecida
                if (loaderIcon) {
                    loaderIcon.className = "fa-solid fa-circle-check fa-3x";
                    loaderIcon.style.color = "#10b981";
                }
                if (loaderText) {
                    loaderText.textContent = "¡Contraseña restablecida con éxito!";
                    loaderText.style.color = "#10b981";
                }

                // Ocultar loader y mostrar modal de éxito
                setTimeout(() => {
                    if (loader) loader.style.display = "none";
                    if (successModal) successModal.classList.add('show');
                }, 1800);
            } else {
                // Error: código incorrecto o expirado
                if (loaderIcon) {
                    loaderIcon.className = "fa-solid fa-circle-xmark fa-3x";
                    loaderIcon.style.color = "#ef4444";
                }
                if (loaderText) {
                    loaderText.textContent = data.message || "Error al restablecer la contraseña.";
                    loaderText.style.color = "#ef4444";
                }

                setTimeout(() => {
                    if (loader) loader.style.display = "none";
                }, 2500);
            }
        } catch (error) {
            console.error('Error al restablecer contraseña:', error);
            if (loaderIcon) {
                loaderIcon.className = "fa-solid fa-triangle-exclamation fa-3x";
                loaderIcon.style.color = "#ef4444";
            }
            if (loaderText) {
                loaderText.textContent = "Error de red al procesar tu solicitud.";
                loaderText.style.color = "#ef4444";
            }

            setTimeout(() => {
                if (loader) loader.style.display = "none";
            }, 2500);
        }
    });

    // Volver al Paso 1 desde el Paso 2
    btnBackToStep1.addEventListener('click', function(e) {
        e.preventDefault();
        step2.style.display = 'none';
        step1.style.display = 'block';
        codeInput.value = '';
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';
    });
    
    // Cerrar modal e ir al login
    closeModal.addEventListener('click', function() {
        successModal.classList.remove('show');
        window.location.href = '/login';
    });
    
    // Función helper para validar formato de email
    function isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
});
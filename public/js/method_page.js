let cart = JSON.parse(localStorage.getItem("cart")) || [];

// Basic HTML Escaper for XSS compliance
const escapeHTML = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// Mostrar saludo y contar productos
document.querySelectorAll("#user-name").forEach((element) => {
  const userData = JSON.parse(localStorage.getItem("user"));
  const userName = userData ? userData.nombreUser : null;
  element.textContent = `${userName || "Usuario"} (${cart.length} productos en tu pedido)`;
});

// Actualizar contador del header
document.querySelectorAll(".cart-count").forEach((element) => {
  element.textContent = cart.reduce((total, item) => total + item.quantity, 0);
});

// Renderizar Resumen del Pedido en la Columna Derecha
function renderOrderSummary() {
  const summaryList = document.getElementById("summary-items-list");
  if (!summaryList) return;

  if (cart.length === 0) {
    summaryList.innerHTML = '<p style="text-align:center; color:#64748b; padding:20px 0;">Tu carrito está vacío.</p>';
    return;
  }

  summaryList.innerHTML = '';
  let subtotal = 0;

  cart.forEach(item => {
    subtotal += item.price * item.quantity;
    const itemCard = document.createElement("div");
    itemCard.className = "summary-item-card";
    itemCard.innerHTML = `
      <img src="${escapeHTML(item.img)}" alt="${escapeHTML(item.name)}" />
      <div class="summary-item-info">
        <div class="summary-item-name">${escapeHTML(item.name)}</div>
        <div class="summary-item-qty">Cant: ${escapeHTML(item.quantity)}</div>
      </div>
      <div class="summary-item-price">$${parseFloat(item.price * item.quantity).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
    `;
    summaryList.appendChild(itemCard);
  });

  const shipping = subtotal > 50 ? 0.00 : 2.00;
  const total = subtotal + shipping;

  document.getElementById("summary-subtotal").textContent = `$${subtotal.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  document.getElementById("summary-shipping").textContent = shipping === 0 ? "Gratis" : `$${shipping.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  document.getElementById("summary-total").textContent = `$${total.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// Plantillas de formularios para cada método
const forms = {
  "credit-card": `
    <form id="form-credit-card">
      <label for="card-number">Número de Tarjeta:</label>
      <input type="text" id="card-number" maxlength="19" placeholder="4000 1234 5678 9010" required />

      <label for="card-holder-name">Titular de la Tarjeta:</label>
      <input type="text" id="card-holder-name" placeholder="Ej: JUAN PEREZ" required />

      <div class="buttons-row" style="display:flex; gap:15px;">
        <div style="flex:1;">
          <label for="expiry-date">Fecha de Vencimiento:</label>
          <input type="text" id="expiry-date" maxlength="5" placeholder="MM/AA" required />
        </div>
        <div style="flex:1;">
          <label for="cvv">CVV:</label>
          <input type="password" id="cvv" maxlength="3" placeholder="123" required />
        </div>
      </div>
    </form>
  `,
  Nequi: `
    <form id="form-nequi">
      <label for="nequi-phone">Número de Celular Nequi:</label>
      <input type="text" maxlength="10" id="nequi-phone" placeholder="3001234567" required />
      <p style="font-size: 0.85em; color: #64748b; margin-top: 5px; margin-bottom: 0;">Recibirás un mensaje de débito directo en tu celular para autorizar la transacción.</p>
    </form>
  `,
  "bank-transfer": `
    <form id="form-bank">
      <label for="bank-name">Seleccione su Banco (PSE):</label>
      <select id="bank-name" required style="width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 15px; background: white; margin-top:5px; margin-bottom: 10px;">
        <option value="">-- Elegir Banco --</option>
        <option value="Bancolombia">Bancolombia</option>
        <option value="Davivienda">Davivienda</option>
        <option value="Banco de Bogotá">Banco de Bogotá</option>
        <option value="BBVA">BBVA</option>
        <option value="Banco Popular">Banco Popular</option>
      </select>

      <label for="account-holder">Nombre del Titular:</label>
      <input type="text" id="account-holder" placeholder="Ej: Juan Pérez" required />
    </form>
  `,
  "Agro-Créditos": `
    <div id="form-agro-creditos" style="padding: 20px 10px;">
      <!-- Tarjeta de Saldo Disponible -->
      <div style="background: linear-gradient(135deg, #064e3b, #10b981); border-radius: 16px; padding: 22px 24px; color: white; margin-bottom: 20px; position: relative; overflow: hidden; box-shadow: 0 8px 20px rgba(16,185,129,0.25);">
        <div style="position: absolute; top: -20px; right: -20px; width: 120px; height: 120px; background: rgba(255,255,255,0.07); border-radius: 50%;"></div>
        <div style="position: absolute; bottom: -30px; right: 40px; width: 80px; height: 80px; background: rgba(255,255,255,0.05); border-radius: 50%;"></div>
        <div style="font-size: 0.8em; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.8; margin-bottom: 6px;">
          <i class="fa-solid fa-coins"></i> Saldo Agro-Créditos
        </div>
        <div id="cred-balance-display" style="font-size: 2.6em; font-weight: 900; letter-spacing: -1px; line-height: 1;">$0</div>
        <div style="font-size: 0.82em; opacity: 0.7; margin-top: 6px;">Créditos disponibles en tu cuenta</div>
      </div>

      <!-- Desglose del Pedido vs Saldo -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 0.92em; color: #475569;">
          <span>Total del Pedido</span>
          <span id="cred-order-total" style="font-weight: 700; color: #1e293b;">$0</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.92em; color: #475569;">
          <span>Tu saldo disponible</span>
          <span id="cred-available" style="font-weight: 700; color: #10b981;">$0</span>
        </div>
        <hr style="border: none; border-top: 1px dashed #e2e8f0; margin: 12px 0;"/>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.9em; font-weight: 700; color: #334155;">Saldo restante tras pagar</span>
          <span id="cred-after-pay" style="font-weight: 800; font-size: 1.1em;">$0</span>
        </div>
      </div>

      <!-- Estado: Suficiente / Insuficiente -->
      <div id="cred-status-box" style="text-align: center; padding: 14px; border-radius: 12px; font-weight: 700; font-size: 0.95em;"></div>
    </div>
  `,
};

// Mostrar formulario e inicializar la tarjeta interactiva
function showPaymentForm(method) {
  document.getElementById("payment-details").innerHTML = forms[method];
  const cardWrapper = document.getElementById("card-preview-wrapper");

  if (method === "credit-card") {
    if (cardWrapper) cardWrapper.style.display = "block";

    // Enlaces de la tarjeta virtual
    const cardInput = document.getElementById("card-number");
    const holderInput = document.getElementById("card-holder-name");
    const expiryInput = document.getElementById("expiry-date");
    const cvvInput = document.getElementById("cvv");

    const displayNum = document.getElementById("card-number-display");
    const displayHolder = document.getElementById("card-holder-name-display");
    const displayExpiry = document.getElementById("card-expiry-display");
    const displayCvv = document.getElementById("card-cvv-display");
    const flipContainer = document.getElementById("card-flip-container");
    const brandLogo = document.getElementById("card-brand-logo");

    const cardFront = document.querySelector(".card-front");
    const cardBack = document.querySelector(".card-back");

    // Inicializar tarjeta en gris (sin reconocer) al cargar
    if (cardFront && cardBack) {
      cardFront.classList.remove("card-visa", "card-mastercard");
      cardBack.classList.remove("card-visa", "card-mastercard");
      cardFront.classList.add("card-unrecognized");
      cardBack.classList.add("card-unrecognized");
    }
    if (brandLogo) {
      brandLogo.innerHTML = "";
    }

    // Formatear número de tarjeta y actualizar logo y colores dinámicamente
    cardInput.addEventListener("input", (e) => {
      let value = e.target.value.replace(/\D/g, "").substring(0, 16);
      
      // Limpiar clases de marcas previas
      if (cardFront && cardBack) {
        cardFront.classList.remove("card-visa", "card-mastercard", "card-unrecognized");
        cardBack.classList.remove("card-visa", "card-mastercard", "card-unrecognized");
      }

      if (value === "") {
        if (brandLogo) brandLogo.innerHTML = "";
        if (cardFront && cardBack) {
          cardFront.classList.add("card-unrecognized");
          cardBack.classList.add("card-unrecognized");
        }
      } else if (value.startsWith("4")) {
        // VISA -> Azul
        if (brandLogo) brandLogo.innerHTML = '<i class="fa-brands fa-cc-visa"></i> VISA';
        if (cardFront && cardBack) {
          cardFront.classList.add("card-visa");
          cardBack.classList.add("card-visa");
        }
      } else if (value.startsWith("5")) {
        // MasterCard -> Roja
        if (brandLogo) brandLogo.innerHTML = '<i class="fa-brands fa-cc-mastercard"></i> MC';
        if (cardFront && cardBack) {
          cardFront.classList.add("card-mastercard");
          cardBack.classList.add("card-mastercard");
        }
      } else {
        // Otra tarjeta genérica -> Gris
        if (brandLogo) brandLogo.innerHTML = '<i class="fa-regular fa-credit-card"></i> CARD';
        if (cardFront && cardBack) {
          cardFront.classList.add("card-unrecognized");
          cardBack.classList.add("card-unrecognized");
        }
      }

      let formatted = value.replace(/(.{4})/g, "$1 ").trim();
      e.target.value = formatted;
      displayNum.textContent = formatted || "•••• •••• •••• ••••";
    });

    // Titular de la tarjeta
    holderInput.addEventListener("input", (e) => {
      let value = e.target.value.toUpperCase();
      displayHolder.textContent = value || "TU NOMBRE AQUÍ";
    });

    // Fecha de expiración MM/AA
    expiryInput.addEventListener("input", (e) => {
      let value = e.target.value.replace(/\D/g, "").substring(0, 4);
      if (value.length > 2) {
        value = value.substring(0, 2) + "/" + value.substring(2, 4);
      }
      e.target.value = value;
      displayExpiry.textContent = value || "MM/AA";
    });

    // Código CVV y rotación de tarjeta (Giro 3D)
    cvvInput.addEventListener("focus", () => {
      if (flipContainer) flipContainer.classList.add("flipped");
    });
    cvvInput.addEventListener("blur", () => {
      if (flipContainer) flipContainer.classList.remove("flipped");
    });
    cvvInput.addEventListener("input", (e) => {
      let value = e.target.value.replace(/\D/g, "").substring(0, 3);
      e.target.value = value;
      displayCvv.textContent = value || "•••";
    });

  } else {
    if (cardWrapper) cardWrapper.style.display = "none";
  }

  // Si se selecciona Agro-Créditos, actualizar los datos del panel dinámicamente
  if (method === "Agro-Créditos") {
    const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const shipping = subtotal > 50 ? 0.00 : 2.00;
    const orderTotal = subtotal + shipping;

    const fmtCOP = (n) => "$" + n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    const elBalance  = document.getElementById("cred-balance-display");
    const elTotal    = document.getElementById("cred-order-total");
    const elAvail    = document.getElementById("cred-available");
    const elAfter    = document.getElementById("cred-after-pay");
    const elStatus   = document.getElementById("cred-status-box");

    if (elBalance) elBalance.textContent = fmtCOP(userCredits);
    if (elTotal)   elTotal.textContent   = fmtCOP(orderTotal);
    if (elAvail)   elAvail.textContent   = fmtCOP(userCredits);

    if (elAfter && elStatus) {
      const remaining = userCredits - orderTotal;
      if (userCredits >= orderTotal) {
        elAfter.textContent = fmtCOP(remaining);
        elAfter.style.color = "#10b981";
        elStatus.innerHTML = '<i class="fa-solid fa-circle-check"></i> ¡Tienes saldo suficiente! Se descontarán <strong>' + fmtCOP(orderTotal) + '</strong> de tu cuenta.';
        elStatus.style.background = "#f0fdf4";
        elStatus.style.border = "1px solid #bbf7d0";
        elStatus.style.color = "#166534";
      } else {
        elAfter.textContent = fmtCOP(remaining);
        elAfter.style.color = "#ef4444";
        elStatus.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Créditos insuficientes. Te faltan <strong>' + fmtCOP(orderTotal - userCredits) + '</strong> para cubrir este pedido.';
        elStatus.style.background = "#fef2f2";
        elStatus.style.border = "1px solid #fecaca";
        elStatus.style.color = "#991b1b";
      }
    }
  }
}

let userCredits = 0;

async function fetchUserCredits() {
  try {
    const userData = JSON.parse(localStorage.getItem("user"));
    if (!userData) return;

    const headers = { 'Content-Type': 'application/json' };
    if (userData.token) {
      headers['Authorization'] = `Bearer ${userData.token}`;
    }

    const response = await fetch('/api/compra/creditos', { headers });
    
    if (response.ok) {
      const data = await response.json();
      userCredits = parseFloat(data.creditos) || 0;
      
      const creditsDisplay = document.getElementById("user-credits-display");
      if (creditsDisplay) {
        creditsDisplay.textContent = `Saldo: $${userCredits.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      }

      // Si el método de pago actualmente seleccionado es Agro-Créditos, refrescar la vista
      const selectedMethodEl = document.querySelector('input[name="payment-method"]:checked');
      if (selectedMethodEl && selectedMethodEl.value === "Agro-Créditos") {
        showPaymentForm("Agro-Créditos");
      }
    }
  } catch (e) {
    console.error("Error al obtener créditos:", e);
  }
}

// Inicializar método por defecto y resumen
renderOrderSummary();
showPaymentForm("credit-card");
fetchUserCredits();

// Cambiar formulario al cambiar método de radio
document.querySelectorAll('input[name="payment-method"]').forEach((input) => {
  input.addEventListener("change", (e) => {
    showPaymentForm(e.target.value);
  });
});

// Botón de Volver al Carrito
document.getElementById("back-btn").addEventListener("click", (e) => {
  e.preventDefault();
  window.location.href = "/carrito";
});

// Procesamiento del Pago Seguro
document.getElementById("pay-btn").addEventListener("click", async (e) => {
  e.preventDefault();
  
  if (cart.length === 0) {
    alert("Tu carrito está vacío. Añade algunos productos para realizar el pago.");
    return;
  }

  const selectedMethod = document.querySelector('input[name="payment-method"]:checked').value;
  
  // Obtener dirección guardada desde el paso de envío
  const shippingAddress = localStorage.getItem("selectedShippingAddress");
  if (!shippingAddress) {
    alert("No se encontró una dirección de envío. Por favor vuelve al paso anterior.");
    window.location.href = '/envio';
    return;
  }

  let valid = false;

  if (selectedMethod === "credit-card") {
    valid = document.getElementById("form-credit-card").checkValidity();
  } else if (selectedMethod === "Nequi") {
    valid = document.getElementById("form-nequi").checkValidity();
  } else if (selectedMethod === "bank-transfer") {
    valid = document.getElementById("form-bank").checkValidity();
  } else if (selectedMethod === "Agro-Créditos") {
    const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const shipping = subtotal > 50 ? 0.00 : 2.00;
    const total = subtotal + shipping;
    
    if (userCredits < total) {
      alert("Créditos insuficientes para pagar esta orden. Por favor selecciona otro método de pago o recarga tu cuenta.");
      return;
    }
    valid = true;
  }

// Mostrar Modal de OTP de Seguridad (envía código real al correo del usuario)
function showSecurityModal(method) {
  return new Promise(async (resolve) => {
    const user = JSON.parse(localStorage.getItem("user"));
    const email = user ? user.emailUser : null;
    const nombre = user ? user.nombreUser : 'Usuario';

    if (!email) {
      alert("No se encontró tu correo electrónico. Inicia sesión nuevamente.");
      return resolve(false);
    }

    // Mostrar loader mientras se envía el OTP
    const loaderTemp = document.getElementById("global-loader");
    const loaderIconTemp = document.getElementById("loader-icon");
    const loaderTextTemp = document.getElementById("loader-text");
    if (loaderTemp) {
      loaderTemp.style.display = "flex";
      if (loaderIconTemp) { loaderIconTemp.className = "fa fa-spinner fa-spin fa-3x"; loaderIconTemp.style.color = "#3b82f6"; }
      if (loaderTextTemp) { loaderTextTemp.textContent = "Enviando código de seguridad a tu correo..."; loaderTextTemp.style.color = ""; }
    }

    // Enviar OTP al correo del usuario
    try {
      const otpRes = await fetch("/api/compra/enviar-otp", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.token}`
        },
        body: JSON.stringify({ email, nombre })
      });
      const otpData = await otpRes.json();
      if (!otpRes.ok) {
        if (loaderTemp) loaderTemp.style.display = "none";
        alert(otpData.error || "Error al enviar el código de seguridad.");
        return resolve(false);
      }
    } catch (err) {
      if (loaderTemp) loaderTemp.style.display = "none";
      alert("Error de conexión al enviar el código de seguridad.");
      return resolve(false);
    }

    if (loaderTemp) loaderTemp.style.display = "none";

    // Crear el modal de verificación
    const overlay = document.createElement('div');
    overlay.className = 'agro-modal-overlay';

    // Censurar correo para mostrar parcialmente
    const emailParts = email.split('@');
    const maskedEmail = email.length > 5
      ? emailParts[0].substring(0, 3) + '****@' + emailParts[1]
      : email;

    overlay.innerHTML = `
      <div class="agro-modal-card" style="text-align: center;">
        <div class="agro-modal-icon" style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); box-shadow: 0 8px 25px rgba(59, 130, 246, 0.35);">
          <i class="fa-solid fa-shield-halved"></i>
        </div>
        <h3 class="agro-modal-title" style="color: #1e3a8a;">Verificación de Seguridad</h3>
        <p class="agro-modal-message">Hemos enviado un código de 4 dígitos a tu correo electrónico:<br><strong style="color: #1e3a8a;">${maskedEmail}</strong></p>
        
        <div style="display: flex; justify-content: center; gap: 12px; margin-bottom: 20px;">
          <input type="text" class="otp-input" maxlength="1" inputmode="numeric" style="width: 50px; height: 55px; font-size: 26px; text-align: center; border: 2px solid #cbd5e1; border-radius: 12px; font-weight: 800; color: #1e293b; background: #f8fafc; outline: none; transition: border 0.2s;" />
          <input type="text" class="otp-input" maxlength="1" inputmode="numeric" style="width: 50px; height: 55px; font-size: 26px; text-align: center; border: 2px solid #cbd5e1; border-radius: 12px; font-weight: 800; color: #1e293b; background: #f8fafc; outline: none; transition: border 0.2s;" />
          <input type="text" class="otp-input" maxlength="1" inputmode="numeric" style="width: 50px; height: 55px; font-size: 26px; text-align: center; border: 2px solid #cbd5e1; border-radius: 12px; font-weight: 800; color: #1e293b; background: #f8fafc; outline: none; transition: border 0.2s;" />
          <input type="text" class="otp-input" maxlength="1" inputmode="numeric" style="width: 50px; height: 55px; font-size: 26px; text-align: center; border: 2px solid #cbd5e1; border-radius: 12px; font-weight: 800; color: #1e293b; background: #f8fafc; outline: none; transition: border 0.2s;" />
        </div>
        
        <p id="otp-error" style="color: #ef4444; font-size: 0.9em; font-weight: bold; margin-top: -10px; margin-bottom: 15px; display: none;"></p>
        
        <p id="otp-timer" style="color: #64748b; font-size: 0.85em; margin-bottom: 18px;">El código expira en <strong id="otp-countdown">5:00</strong></p>
        
        <div class="agro-modal-buttons" style="flex-wrap: wrap; gap: 10px;">
          <button class="agro-modal-btn agro-modal-btn-secondary" id="otp-cancel-btn">Cancelar</button>
          <button class="agro-modal-btn" id="otp-resend-btn" style="background: transparent; color: #3b82f6; border: 1px solid #3b82f6; font-size: 0.85em;">Reenviar Código</button>
          <button class="agro-modal-btn agro-modal-btn-primary" id="otp-verify-btn" style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); box-shadow: 0 5px 15px rgba(59, 130, 246, 0.25); flex: 1;">Verificar y Pagar</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add('active'), 10);
    
    const inputs = overlay.querySelectorAll('.otp-input');
    setTimeout(() => inputs[0].focus(), 150);
    
    // Temporizador de expiración
    let timeLeft = 300; // 5 minutos en segundos
    const countdownEl = document.getElementById('otp-countdown');
    const timerInterval = setInterval(() => {
      timeLeft--;
      const mins = Math.floor(timeLeft / 60);
      const secs = timeLeft % 60;
      countdownEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        countdownEl.textContent = 'Expirado';
        countdownEl.style.color = '#ef4444';
      }
    }, 1000);

    inputs.forEach((input, index) => {
      input.addEventListener('focus', () => {
        input.style.borderColor = '#3b82f6';
        input.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.2)';
      });
      input.addEventListener('blur', () => {
        input.style.borderColor = '#cbd5e1';
        input.style.boxShadow = 'none';
      });
      input.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, ''); 
        if (e.target.value !== '' && index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
          inputs[index - 1].focus();
        } else if (e.key === 'Enter') {
          verifyCode();
        }
      });
    });
    
    // Verificar código contra el backend
    const verifyCode = async () => {
      const code = Array.from(inputs).map(i => i.value).join('');
      const errorEl = document.getElementById('otp-error');
      const verifyBtn = document.getElementById('otp-verify-btn');
      
      if (code.length !== 4) {
        errorEl.textContent = 'Ingresa los 4 dígitos del código.';
        errorEl.style.display = 'block';
        shakeCard();
        return;
      }

      verifyBtn.disabled = true;
      verifyBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Verificando...';

      try {
        const verifyRes = await fetch("/api/compra/verificar-otp", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${user.token}`
          },
          body: JSON.stringify({ email, code })
        });
        const verifyData = await verifyRes.json();

        if (verifyRes.ok && verifyData.success) {
          clearInterval(timerInterval);
          // Éxito visual
          const icon = overlay.querySelector('.agro-modal-icon');
          const title = overlay.querySelector('.agro-modal-title');
          if (icon) { icon.style.background = 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)'; icon.innerHTML = '<i class="fa-solid fa-circle-check"></i>'; }
          if (title) { title.textContent = '¡Identidad Verificada!'; title.style.color = '#064e3b'; }
          
          inputs.forEach(inp => { inp.style.borderColor = '#10b981'; inp.style.background = '#f0fdf4'; inp.disabled = true; });
          errorEl.style.display = 'none';

          setTimeout(() => {
            overlay.classList.remove('active');
            setTimeout(() => { document.body.removeChild(overlay); resolve(true); }, 200);
          }, 1200);
        } else {
          verifyBtn.disabled = false;
          verifyBtn.innerHTML = 'Verificar y Pagar';
          errorEl.textContent = verifyData.error || 'Código incorrecto. Intenta de nuevo.';
          errorEl.style.display = 'block';
          inputs.forEach(inp => { inp.value = ''; inp.style.borderColor = '#ef4444'; });
          inputs[0].focus();
          shakeCard();
        }
      } catch (err) {
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = 'Verificar y Pagar';
        errorEl.textContent = 'Error de conexión. Intenta de nuevo.';
        errorEl.style.display = 'block';
        shakeCard();
      }
    };

    function shakeCard() {
      const card = overlay.querySelector('.agro-modal-card');
      card.style.transform = 'translate(-10px, 0)';
      setTimeout(() => card.style.transform = 'translate(10px, 0)', 100);
      setTimeout(() => card.style.transform = 'translate(-10px, 0)', 200);
      setTimeout(() => card.style.transform = 'translate(10px, 0)', 300);
      setTimeout(() => card.style.transform = 'translate(0, 0)', 400);
    }

    // Reenviar código
    document.getElementById('otp-resend-btn').addEventListener('click', async () => {
      const resendBtn = document.getElementById('otp-resend-btn');
      resendBtn.disabled = true;
      resendBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';
      try {
        await fetch("/api/compra/enviar-otp", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${user.token}`
          },
          body: JSON.stringify({ email, nombre })
        });
        timeLeft = 300;
        countdownEl.style.color = '';
        resendBtn.innerHTML = '¡Reenviado!';
        const errorEl = document.getElementById('otp-error');
        errorEl.textContent = 'Nuevo código enviado a tu correo.';
        errorEl.style.color = '#10b981';
        errorEl.style.display = 'block';
        setTimeout(() => { errorEl.style.color = '#ef4444'; errorEl.style.display = 'none'; }, 3000);
      } catch (err) {
        resendBtn.innerHTML = 'Error';
      }
      setTimeout(() => { resendBtn.disabled = false; resendBtn.innerHTML = 'Reenviar Código'; }, 4000);
    });
    
    document.getElementById('otp-verify-btn').addEventListener('click', verifyCode);
    document.getElementById('otp-cancel-btn').addEventListener('click', () => {
      clearInterval(timerInterval);
      overlay.classList.remove('active');
      setTimeout(() => { document.body.removeChild(overlay); resolve(false); }, 200);
    });
  });
}

  if (valid) {
    // Iniciar flujo de seguridad antes de pagar
    const isVerified = await showSecurityModal(selectedMethod);
    
    if (!isVerified) {
      return; // El usuario canceló la verificación
    }

    // Mostrar loader de procesamiento
    const loader = document.getElementById("global-loader");
    const loaderIcon = document.getElementById("loader-icon");
    const loaderText = document.getElementById("loader-text");

    if (loader) {
      loader.style.display = "flex";
      // Restablecer estados iniciales del loader
      if (loaderIcon) {
        loaderIcon.className = "fa fa-spinner fa-spin fa-3x";
        loaderIcon.style.color = "#4f46e5";
      }
      if (loaderText) {
        loaderText.textContent = "Procesando Pago Seguro...";
        loaderText.style.color = "";
      }
    }

    const methodNameSpanish = selectedMethod === "credit-card" ? "Tarjeta de Crédito" : (selectedMethod === "Nequi" ? "Nequi" : (selectedMethod === "Agro-Créditos" ? "Agro-Créditos" : "PSE / Banco"));
    let subtotal = 0;
    cart.forEach((item) => {
      subtotal += item.price * item.quantity;
    });
    const shipping = subtotal > 50 ? 0.00 : 2.00;
    const total = subtotal + shipping;

    let orderId = Math.floor(Math.random() * 90000 + 10000);
    const user = JSON.parse(localStorage.getItem("user"));
    
    // Iniciar el reporte de la transacción en background al servidor de forma instantánea
    if (user && user.idUser && cart.length > 0) {
      const productos = cart.map((item) => ({
        idProducto: item.id,
        cantidad: item.quantity,
        precio: item.price,
      }));

      try {
        // Guardar compra en la base de datos de forma paralela, pero forzando al navegador a ESPERAR (await)
        const response = await fetch("/api/compra", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${user.token}`
          },
          body: JSON.stringify({
            idUser: user.idUser,
            productos,
            total,
            metodoPago: methodNameSpanish,
            direccion: shippingAddress
          }),
        });

        if (response.ok) {
          const resData = await response.json();
          if (resData.idCompra) {
            orderId = resData.idCompra;
          }
        } else {
          console.error("El servidor rechazó el registro de la compra.");
        }
      } catch (err) {
        console.error("Error al reportar compra a la base de datos:", err);
      }
    }

    // Retraso de 1.8 segundos (o Inmediato si la red tardó más) para dar un tiempo de procesamiento realista de pasarela
    setTimeout(() => {
      // 1. Cambiar visual del spinner a éxito rotundo
      if (loaderIcon) {
        loaderIcon.className = "fa-solid fa-circle-check fa-3x";
        loaderIcon.style.color = "#10b981"; // Verde agro-campo premium
      }
      if (loaderText) {
        loaderText.textContent = "¡Pago realizado con éxito!";
        loaderText.style.color = "#10b981";
      }

      // Guardar bandera de factura y datos
      localStorage.setItem("showInvoice", "true");
      localStorage.setItem(
        "invoiceData",
        JSON.stringify({
          cart,
          subtotal,
          shipping,
          total,
          idCompra: orderId,
          metodoPago: methodNameSpanish,
          direccion: shippingAddress
        })
      );

      // Vaciar carrito
      localStorage.removeItem("cart");

      // Redirigir al carrito para ver el recibo
      setTimeout(() => {
        if (loader) loader.style.display = "none";
        window.location.href = "/carrito";
      }, 900);
    }, 1800);

  } else {
    alert("Por favor rellene todos los datos solicitados de forma correcta.");
  }
});

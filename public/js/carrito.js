document.addEventListener("DOMContentLoaded", function () {
  // Variables
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  const cartItemsContainer = document.querySelector(".cart-items");
  const cartSummary = document.querySelector(".cart-summary");
  const emptyCartHTML = `
        <div class="empty-cart">
            <i class="fas fa-shopping-cart" style="font-size: 4rem; color: #cbd5e1; margin-bottom: 15px; display: block;"></i>
            <h3>Tu carrito está vacío</h3>
            <p style="color: #64748b; margin-bottom: 20px;">Agrega productos desde nuestra tienda de alta calidad</p>
            <a href="/" class="btn-checkout" style="max-width: 250px; margin: 0 auto; padding: 12px 24px; text-decoration: none;">Ir a la tienda</a>
        </div>
    `;

  // Mostrar productos en el carrito
  function renderCart() {
    if (cart.length === 0) {
      cartItemsContainer.innerHTML = emptyCartHTML;
      cartItemsContainer.classList.add("full-width");
      cartSummary.style.display = "none";
      return;
    }

    cartItemsContainer.classList.remove("full-width");
    cartSummary.style.display = "block";
    cartItemsContainer.innerHTML = "";

    let subtotal = 0;

    cart.forEach((item, index) => {
      const itemTotal = item.price * item.quantity;
      subtotal += itemTotal;

      const itemHTML = `
                <div class="cart-item" data-id="${item.id}">
                    <img src="${item.img}" alt="${item.name}">
                    <div class="item-info">
                        <h3>${item.name}</h3>
                        <p class="item-price">$${item.price.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/kg</p>
                        <div class="item-quantity">
                            <button class="quantity-btn minus">-</button>
                            <input type="number" value="${
                              item.quantity
                            }" min="1" class="quantity-input">
                            <button class="quantity-btn plus">+</button>
                        </div>
                    </div>
                    <div class="item-actions">
                        <button class="btn-remove"><i class="fas fa-trash"></i> Eliminar</button>
                        <p class="item-total">$${itemTotal.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                    </div>
                </div>
            `;

      cartItemsContainer.insertAdjacentHTML("beforeend", itemHTML);
    });

    // Actualizar resumen
    const shipping = subtotal > 50 ? 0 : 2.0; // Envío gratis para compras mayores a $50
    const total = subtotal + shipping;

    // Actualizar indicador dinámico de envío gratis
    const freeShippingText = document.getElementById("free-shipping-tracker-text");
    const freeShippingBar = document.getElementById("free-shipping-progress-bar");
    if (freeShippingText && freeShippingBar) {
      if (subtotal >= 50) {
        freeShippingText.innerHTML = `<i class="fa fa-check-circle" style="color: #059669;"></i> ¡Felicidades! Tienes <strong>Envío Gratis</strong>`;
        freeShippingText.className = "free-shipping-text success";
        freeShippingBar.style.width = "100%";
      } else {
        const missing = 50 - subtotal;
        freeShippingText.innerHTML = `<i class="fa fa-truck"></i> Agrega <strong>$${missing.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong> más para <strong>Envío Gratis</strong>`;
        freeShippingText.className = "free-shipping-text";
        freeShippingBar.style.width = `${Math.min((subtotal / 50) * 100, 100)}%`;
      }
    }

    document.querySelector(".summary-details").innerHTML = `
            <div class="summary-row">
                <span>Subtotal:</span>
                <span>$${subtotal.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
            </div>
            <div class="summary-row">
                <span>Envío:</span>
                <span>${shipping === 0 ? "<strong style='color: #10b981;'>Gratis</strong>" : `$${shipping.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}</span>
            </div>
            <div class="summary-row total">
                <span>Total:</span>
                <span>$${total.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
            </div>
        `;

    // Asignar eventos a los botones
    assignCartEvents();
  }

  // Asignar eventos a los elementos del carrito
  function assignCartEvents() {
    // Botones de cantidad
    document.querySelectorAll(".quantity-btn").forEach((button) => {
      button.addEventListener("click", function () {
        const itemElement = this.closest(".cart-item");
        const itemId = itemElement.getAttribute("data-id");
        const input = itemElement.querySelector(".quantity-input");
        let quantity = parseInt(input.value);

        if (this.classList.contains("minus")) {
          if (quantity > 1) {
            quantity--;
          }
        } else if (this.classList.contains("plus")) {
          quantity++;
        }

        input.value = quantity;
        updateCartItem(itemId, quantity);
      });
    });

    // Input de cantidad manual
    document.querySelectorAll(".quantity-input").forEach((input) => {
      input.addEventListener("change", function () {
        const itemElement = this.closest(".cart-item");
        const itemId = itemElement.getAttribute("data-id");
        let quantity = parseInt(this.value);

        if (quantity < 1) {
          quantity = 1;
          this.value = 0;
        }

        updateCartItem(itemId, quantity);
      });
    });

    // Botones de eliminar
    document.querySelectorAll(".btn-remove").forEach((button) => {
      button.addEventListener("click", function () {
        const itemElement = this.closest(".cart-item");
        const itemId = itemElement.getAttribute("data-id");
        removeCartItem(itemId);
      });
    });
  }

  // Actualizar cantidad de un producto en el carrito
  function updateCartItem(productId, quantity) {
    const itemIndex = cart.findIndex((item) => item.id === productId);

    if (itemIndex !== -1) {
      cart[itemIndex].quantity = quantity;
      localStorage.setItem("cart", JSON.stringify(cart));
      renderCart();
    }
  }

  // Eliminar producto del carrito
  function removeCartItem(productId) {
    cart = cart.filter((item) => item.id !== productId);
    localStorage.setItem("cart", JSON.stringify(cart));
    renderCart();
    updateCartCount();
  }

  // Actualizar contador del carrito en el header
  function updateCartCount() {
    const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll(".cart-count").forEach((element) => {
      element.textContent = totalItems;
    });
  }

  // Procesar pago
  const checkoutBtn = document.querySelector(".btn-checkout");
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", function () {
      if (cart.length === 0) {
        alert("Tu carrito está vacío");
        return;
      }
      window.location.href = "/envio";
    });
  }

  // Manejar compra directa (si viene de un botón "Comprar ahora")
  const urlParams = new URLSearchParams(window.location.search);
  const buyNowId = urlParams.get("buyNow");

  if (buyNowId) {
    // Limpiar carrito y añadir solo el producto de compra directa
    const productToBuy = cart.find((item) => item.id === buyNowId);

    if (productToBuy) {
      cart = [
        {
          id: productToBuy.id,
          name: productToBuy.name,
          price: productToBuy.price,
          img: productToBuy.img,
          quantity: 1,
        },
      ];

      localStorage.setItem("cart", JSON.stringify(cart));
    }
  }

  // Inicializar carrito
  renderCart();
});

window.addEventListener('DOMContentLoaded', function () {
  const invoiceModal = document.getElementById('invoice-modal');
  if (localStorage.getItem('showInvoice') === 'true') {
    if (invoiceModal) invoiceModal.style.display = 'flex';

    // Datos de la factura
    const invoiceData = JSON.parse(localStorage.getItem('invoiceData'));
    if (invoiceData && invoiceData.cart && invoiceData.cart.length > 0) {
      // Fecha y número de orden
      document.getElementById('invoice-date').textContent = new Date().toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      document.getElementById('invoice-order-number').textContent = `#${invoiceData.idCompra}`;

      // Cliente (puedes personalizar si tienes usuario)
      const userData = JSON.parse(localStorage.getItem('user'));
      const clientName = userData ? userData.nombreUser : null;
      document.getElementById('invoice-client').textContent = clientName ? clientName : "Consumidor Final";

      // Dirección de Envío
      document.getElementById('invoice-shipping-address').textContent = invoiceData.direccion || "No especificada";

      // Método de Pago
      document.getElementById('invoice-payment-method').textContent = invoiceData.metodoPago || "Tarjeta de Crédito";

      // Rellenar input de enviar correo
      const sendEmailInput = document.getElementById('send-email-invoice-input');
      if (sendEmailInput) {
        sendEmailInput.value = userData ? (userData.emailUser || '') : '';
      }

      // Guardar el idCompra activo globalmente
      window.currentCheckoutInvoiceId = invoiceData.idCompra;

      // Productos
      let rows = '';
      invoiceData.cart.forEach(item => {
        const itemPrice = parseFloat(item.price);
        const itemTotal = item.quantity * itemPrice;
        rows += `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px; border: 1px solid #ddd;">
              ${item.name}
              ${item.presentacion ? `<br><span style="font-size: 0.85em; color: #64748b;">Presentación: ${item.presentacion}</span>` : ''}
            </td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${itemPrice.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">$${itemTotal.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
          </tr>
        `;
      });
      document.getElementById('invoice-products').innerHTML = rows;

      // Totales
      document.getElementById('invoice-subtotal').textContent = `$${invoiceData.subtotal.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      document.getElementById('invoice-shipping').textContent = invoiceData.shipping === 0 ? "Gratis" : `$${invoiceData.shipping.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      document.getElementById('invoice-total').textContent = `$${invoiceData.total.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }

    // Limpia la bandera para que no se muestre siempre
    localStorage.removeItem('showInvoice');
  } else {
    if (invoiceModal) invoiceModal.style.display = 'none';
  }

  // Manejar el cierre de la alerta modal de la factura
  const closeTriggers = ['close-invoice-modal', 'close-invoice-modal-btn'];
  closeTriggers.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', () => {
        if (invoiceModal) invoiceModal.style.display = 'none';
      });
    }
  });

  // Cerrar al hacer clic fuera del recuadro de la factura
  if (invoiceModal) {
    invoiceModal.addEventListener('click', (e) => {
      if (e.target === invoiceModal) {
        invoiceModal.style.display = 'none';
      }
    });
  }

  // Enviar factura electrónica por correo
  const btnSendEmailInvoice = document.getElementById("btn-send-email-invoice");
  const sendEmailInvoiceInput = document.getElementById("send-email-invoice-input");

  if (btnSendEmailInvoice && sendEmailInvoiceInput) {
    btnSendEmailInvoice.addEventListener("click", async () => {
      const email = sendEmailInvoiceInput.value.trim();
      if (!email) {
        alert("Por favor ingresa un correo electrónico.");
        return;
      }
      
      const idCompra = window.currentCheckoutInvoiceId;
      if (!idCompra) {
        alert("No se encontró el ID de la compra activa.");
        return;
      }

      // Obtener JWT si existe para autenticar
      const user = JSON.parse(localStorage.getItem('user'));
      const authHeaders = { 'Content-Type': 'application/json' };
      if (user && user.token) {
        authHeaders['Authorization'] = `Bearer ${user.token}`;
      }

      // Mostrar loader global
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
          loaderText.textContent = "Despachando factura al correo...";
          loaderText.style.color = "";
        }
      }

      try {
        const response = await fetch("/api/compra/enviar-correo", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ idCompra, email })
        });

        const data = await response.json();

        if (response.ok) {
          // Cambiar visual del loader a éxito rotundo
          if (loaderIcon) {
            loaderIcon.className = "fa-solid fa-circle-check fa-3x";
            loaderIcon.style.color = "#10b981"; // Verde Agro-Campo
          }
          if (loaderText) {
            loaderText.textContent = "¡Factura enviada al correo con éxito!";
            loaderText.style.color = "#10b981";
          }

          // Esperar 2 segundos para lectura de éxito y luego ocultar el loader y el modal de la factura
          setTimeout(() => {
            if (loader) loader.style.display = "none";
            const invoiceModal = document.getElementById('invoice-modal');
            if (invoiceModal) invoiceModal.style.display = 'none';
          }, 2000);
        } else {
          // Mostrar mensaje de error del servidor en el loader
          if (loaderIcon) {
            loaderIcon.className = "fa-solid fa-circle-xmark fa-3x";
            loaderIcon.style.color = "#ef4444"; // Rojo error
          }
          if (loaderText) {
            loaderText.textContent = data.error || "Error al despachar el correo.";
            loaderText.style.color = "#ef4444";
          }

          setTimeout(() => {
            if (loader) loader.style.display = "none";
          }, 2500);
        }
      } catch (err) {
        console.error("Error de red al despachar email de factura:", err);
        // Error de red / conexión
        if (loaderIcon) {
          loaderIcon.className = "fa-solid fa-triangle-exclamation fa-3x";
          loaderIcon.style.color = "#ef4444";
        }
        if (loaderText) {
          loaderText.textContent = "Error de conexión al enviar la factura.";
          loaderText.style.color = "#ef4444";
        }

        setTimeout(() => {
          if (loader) loader.style.display = "none";
        }, 2500);
      }
    });
  }
});

document.addEventListener('DOMContentLoaded', function () {
  const printBtn = document.getElementById('print-invoice');
  if (printBtn) {
    printBtn.addEventListener('click', function () {
      const invoice = document.getElementById('receipt-invoice-print-area');
      const orderNumber = document.getElementById('invoice-order-number').textContent.replace('#', '');
      if (invoice) {
        const opt = {
          margin:       0.3,
          filename:     `Recibo_Compra_AgroCampo_${orderNumber}.pdf`,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true },
          jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(invoice).save();
      }
    });
  }
});


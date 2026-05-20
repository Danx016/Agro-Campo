document.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user || !user.idUser) {
    window.location.href = "/login";
    return;
  }

  // Header de autorización para todas las peticiones (la cookie segura HttpOnly se envía automáticamente)
  const authHeaders = {
    "Content-Type": "application/json"
  };
  if (user.token) {
    authHeaders["Authorization"] = `Bearer ${user.token}`;
  }

  // Rellenar formulario, barra lateral y avatar inicial
  document.getElementById("profile-name").value = user.nombreUser || "";
  document.getElementById("profile-email").value = user.emailUser || "";
  document.getElementById("profile-username").value = user.username || "";

  const displayName = document.getElementById("sidebar-display-name");
  const displayEmail = document.getElementById("sidebar-display-email");
  if (displayName) displayName.textContent = user.nombreUser || user.username || "Usuario";
  if (displayEmail) displayEmail.textContent = user.emailUser || "";

  const displayCredits = document.getElementById("sidebar-display-credits");
  if (displayCredits) {
    // Obtener créditos actualizados desde el servidor
    fetch("/api/compra/creditos", { headers: authHeaders })
      .then(res => res.json())
      .then(data => {
        const credits = parseFloat(data.creditos) || 0;
        displayCredits.textContent = "$" + credits.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      })
      .catch(err => console.error("Error al obtener créditos:", err));
  }

  const avatarPreview = document.getElementById("profile-avatar-preview");
  const avatarUrlInput = document.getElementById("profile-avatar-url");
  const presets = document.querySelectorAll(".avatar-preset");

  // Obtener avatar actual
  const currentAvatar = user.avatar || "../img/logo vaca.png";
  avatarPreview.src = currentAvatar;
  
  // Rellenar el input de URL si es una imagen externa
  if (user.avatar && !user.avatar.includes("logo vaca.png") && !user.avatar.includes("flaticon.com") && !user.avatar.includes("unsplash.com")) {
    avatarUrlInput.value = user.avatar;
  }

  // Resaltar preset activo al inicio
  presets.forEach(p => {
    const isVaca = currentAvatar.includes("logo vaca.png") && p.src.includes("logo vaca.png");
    const isMatch = currentAvatar === p.src || isVaca;
    if (isMatch) {
      p.classList.add("active");
    }
  });

  // Manejar clic en presets de avatares
  presets.forEach(p => {
    p.addEventListener("click", () => {
      presets.forEach(pr => pr.classList.remove("active"));
      p.classList.add("active");
      avatarPreview.src = p.src;
      avatarUrlInput.value = ""; // Limpiar URL si elige preset
    });
  });

  // Manejar entrada de URL de avatar personalizada
  avatarUrlInput.addEventListener("input", (e) => {
    presets.forEach(pr => pr.classList.remove("active"));
    const url = e.target.value.trim();
    if (url) {
      avatarPreview.src = url;
    } else {
      avatarPreview.src = "../img/logo vaca.png";
      presets[0].classList.add("active"); // default to cow
    }
  });

  // Manejar subida local de foto desde el ordenador (Base64 + Auto-Compresión/Redimensionamiento)
  const fileInput = document.getElementById("profile-avatar-file");
  const btnUpload = document.querySelector(".btn-upload");

  // Activar el selector de archivos al hacer clic en el botón personalizado
  if (btnUpload && fileInput) {
    btnUpload.addEventListener("click", (e) => {
      e.preventDefault();
      fileInput.click();
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function (event) {
        const img = new Image();
        img.onload = function () {
          // Crear un canvas offline para redimensionar y recortar la imagen a un cuadrado de 180x180
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          
          canvas.width = 180;
          canvas.height = 180;
          
          // Calcular el recorte centrado de la imagen original (crop center)
          const size = Math.min(img.width, img.height);
          const sx = (img.width - size) / 2;
          const sy = (img.height - size) / 2;
          
          ctx.drawImage(img, sx, sy, size, size, 0, 0, 180, 180);
          
          // Convertir a base64 de formato JPEG comprimido (calidad 0.7 para que sea sumamente ligera: ~5-10 KB)
          const base64Data = canvas.toDataURL("image/jpeg", 0.7);
          
          // Actualizar vista previa del avatar y resetear otras selecciones
          avatarPreview.src = base64Data;
          avatarUrlInput.value = "";
          presets.forEach(pr => pr.classList.remove("active"));
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // --- NUEVA LÓGICA DE CONFIRMACIÓN DE CONTRASEÑA ---
  const passwordInput = document.getElementById("profile-password");
  const verificationContainer = document.getElementById("password-verification-container");
  const codeInput = document.getElementById("profile-reset-code");
  const btnRequestProfileCode = document.getElementById("btn-request-profile-code");

  // Mostrar el contenedor de verificación solo si el usuario empieza a escribir una contraseña
  if (passwordInput && verificationContainer && codeInput) {
    passwordInput.addEventListener("input", () => {
      if (passwordInput.value.trim() !== "") {
        verificationContainer.style.display = "block";
        codeInput.required = true;
      } else {
        verificationContainer.style.display = "none";
        codeInput.required = false;
        codeInput.value = "";
      }
    });
  }

  // Manejar solicitud del código de confirmación por correo desde el perfil
  if (btnRequestProfileCode) {
    btnRequestProfileCode.addEventListener("click", async (e) => {
      e.preventDefault();
      const email = document.getElementById("profile-email").value.trim() || user.emailUser;

      if (!email) {
        alert("Por favor ingresa un correo electrónico válido.");
        return;
      }

      // Mostrar loader global
      const loader = document.getElementById("global-loader");
      if (loader) loader.style.display = "flex";

      try {
        const response = await fetch("/api/recover/request", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ email })
        });

        const data = await response.json();
        if (loader) loader.style.display = "none";

        if (response.ok) {
          alert(`Se ha enviado un código de confirmación de 6 dígitos a tu correo: ${email}`);
          codeInput.focus();
        } else {
          alert(data.message || "Error al solicitar el código de confirmación.");
        }
      } catch (error) {
        if (loader) loader.style.display = "none";
        console.error("Error al solicitar código desde perfil:", error);
        alert("Hubo un error de red al solicitar tu código. Inténtalo de nuevo.");
      }
    });
  }

  // Manejar el submit del formulario de perfil
  document.getElementById("profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nombre = document.getElementById("profile-name").value;
    const email = document.getElementById("profile-email").value;
    const username = document.getElementById("profile-username").value;
    const password = passwordInput.value;
    const code = codeInput ? codeInput.value.trim() : "";
    const avatar = avatarPreview.src;

    // Validación extra en cliente si cambian contraseña
    if (password.trim() !== "" && (!code || code.length !== 6 || isNaN(code))) {
      alert("Por favor ingresa el código de 6 dígitos enviado a tu correo para confirmar tu nueva contraseña.");
      return;
    }

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
        loaderText.textContent = "Actualizando perfil...";
        loaderText.style.color = "";
      }
    }

    const res = await fetch(`/api/user/${user.idUser}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ nombre, email, username, password, avatar, code }),
    });

    const data = await res.json();

    if (res.ok) {
      // Cambiar visual del loader a éxito rotundo
      if (loaderIcon) {
        loaderIcon.className = "fa-solid fa-circle-check fa-3x";
        loaderIcon.style.color = "#10b981"; // Verde Agro-Campo
      }
      if (loaderText) {
        loaderText.textContent = "¡Perfil actualizado con éxito!";
        loaderText.style.color = "#10b981";
      }

      // Actualizar sesión del navegador
      user.nombreUser = nombre;
      user.emailUser = email;
      user.username = username;
      user.avatar = avatar;
      localStorage.setItem("user", JSON.stringify(user));

      // Actualizar barra lateral
      if (displayName) displayName.textContent = nombre;
      if (displayEmail) displayEmail.textContent = email;

      // Sincronizar foto de perfil en el header
      const headerAvatar = document.getElementById("header-user-avatar");
      if (headerAvatar) {
        headerAvatar.src = avatar;
      }

      // Limpiar campos de contraseña y código
      passwordInput.value = "";
      if (codeInput) codeInput.value = "";
      if (verificationContainer) verificationContainer.style.display = "none";

      document.getElementById("profile-message").textContent = "Perfil actualizado con éxito.";
      document.getElementById("profile-message").style.color = "green";

      // Ocultar loader tras 1.8 segundos
      setTimeout(() => {
        if (loader) loader.style.display = "none";
      }, 1800);
    } else {
      // Mostrar mensaje de error del servidor en el loader
      if (loaderIcon) {
        loaderIcon.className = "fa-solid fa-circle-xmark fa-3x";
        loaderIcon.style.color = "#ef4444"; // Rojo error
      }
      if (loaderText) {
        loaderText.textContent = data.message || data.error || "Error al actualizar";
        loaderText.style.color = "#ef4444";
      }

      document.getElementById("profile-message").textContent =
        data.message || data.error || "Error al actualizar";
      document.getElementById("profile-message").style.color = "red";

      setTimeout(() => {
        if (loader) loader.style.display = "none";
      }, 2500);
    }
  });

  // --- LÓGICA SEGURA DE ELIMINACIÓN DE CUENTA POR CORREO ---
  const deleteBtn = document.getElementById("delete-account");
  const deleteVerificationContainer = document.getElementById("delete-verification-container");
  const btnRequestDeleteCode = document.getElementById("btn-request-delete-code");
  const deleteVerificationCode = document.getElementById("delete-verification-code");
  const btnConfirmDeleteAccount = document.getElementById("btn-confirm-delete-account");

  // Mostrar el contenedor de verificación al hacer clic en el botón principal
  if (deleteBtn && deleteVerificationContainer) {
    deleteBtn.addEventListener("click", () => {
      const isHidden = deleteVerificationContainer.style.display === "none";
      deleteVerificationContainer.style.display = isHidden ? "block" : "none";
      if (isHidden) {
        deleteVerificationContainer.scrollIntoView({ behavior: "smooth" });
      }
    });
  }

  // Solicitar código de confirmación de eliminación por correo
  if (btnRequestDeleteCode) {
    btnRequestDeleteCode.addEventListener("click", async (e) => {
      e.preventDefault();
      const email = document.getElementById("profile-email").value.trim() || user.emailUser;

      if (!email) {
        alert("Por favor ingresa un correo electrónico válido.");
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
          loaderText.textContent = "Solicitando código de seguridad...";
          loaderText.style.color = "";
        }
      }

      try {
        const response = await fetch("/api/recover/request", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (response.ok) {
          // Cambiar visual del loader a éxito
          if (loaderIcon) {
            loaderIcon.className = "fa-solid fa-circle-check fa-3x";
            loaderIcon.style.color = "#10b981";
          }
          if (loaderText) {
            loaderText.textContent = "¡Código de seguridad enviado con éxito!";
            loaderText.style.color = "#10b981";
          }

          setTimeout(() => {
            if (loader) loader.style.display = "none";
            if (deleteVerificationCode) deleteVerificationCode.focus();
          }, 1800);
        } else {
          if (loaderIcon) {
            loaderIcon.className = "fa-solid fa-circle-xmark fa-3x";
            loaderIcon.style.color = "#ef4444";
          }
          if (loaderText) {
            loaderText.textContent = data.message || "Error al solicitar el código.";
            loaderText.style.color = "#ef4444";
          }

          setTimeout(() => {
            if (loader) loader.style.display = "none";
          }, 2500);
        }
      } catch (error) {
        console.error("Error al solicitar código para eliminar cuenta:", error);
        if (loaderIcon) {
          loaderIcon.className = "fa-solid fa-triangle-exclamation fa-3x";
          loaderIcon.style.color = "#ef4444";
        }
        if (loaderText) {
          loaderText.textContent = "Error de red al solicitar el código.";
          loaderText.style.color = "#ef4444";
        }

        setTimeout(() => {
          if (loader) loader.style.display = "none";
        }, 2500);
      }
    });
  }

  // Confirmar y eliminar definitivamente la cuenta
  if (btnConfirmDeleteAccount) {
    btnConfirmDeleteAccount.addEventListener("click", async (e) => {
      e.preventDefault();
      const code = deleteVerificationCode ? deleteVerificationCode.value.trim() : "";

      if (!code || code.length !== 6 || isNaN(code)) {
        alert("Por favor ingresa el código de 6 dígitos enviado a tu correo.");
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
          loaderText.textContent = "Eliminando cuenta de Agro-Campo...";
          loaderText.style.color = "";
        }
      }

      try {
        const response = await fetch(`/api/user/${user.idUser}`, {
          method: "DELETE",
          headers: authHeaders,
          body: JSON.stringify({ code })
        });

        const data = await response.json();

        if (response.ok) {
          // Cambiar visual del loader a éxito
          if (loaderIcon) {
            loaderIcon.className = "fa-solid fa-circle-check fa-3x";
            loaderIcon.style.color = "#10b981";
          }
          if (loaderText) {
            loaderText.textContent = "¡Usuario eliminado con éxito!";
            loaderText.style.color = "#10b981";
          }

          // Esperar 2.2 segundos para mostrar el éxito y luego redirigir
          setTimeout(async () => {
            if (loader) loader.style.display = "none";
            try {
              // Llamar de manera transparente a /logout para borrar la cookie jwt del servidor
              await fetch('/logout');
            } catch (err) {
              console.error("Error al limpiar cookie de sesión en la eliminación:", err);
            }
            localStorage.clear();
            window.location.href = "/login";
          }, 2200);
        } else {
          if (loaderIcon) {
            loaderIcon.className = "fa-solid fa-circle-xmark fa-3x";
            loaderIcon.style.color = "#ef4444";
          }
          if (loaderText) {
            loaderText.textContent = data.error || data.message || "Error al eliminar la cuenta.";
            loaderText.style.color = "#ef4444";
          }

          setTimeout(() => {
            if (loader) loader.style.display = "none";
          }, 2500);
        }
      } catch (error) {
        console.error("Error al eliminar la cuenta:", error);
        if (loaderIcon) {
          loaderIcon.className = "fa-solid fa-triangle-exclamation fa-3x";
          loaderIcon.style.color = "#ef4444";
        }
        if (loaderText) {
loaderText.textContent = "Error de conexión al eliminar la cuenta.";
          loaderText.style.color = "#ef4444";
        }

        setTimeout(() => {
          if (loader) loader.style.display = "none";
        }, 2500);
      }
    });
  }

  // --- CONFIGURACIÓN DE LOS 14 ESTADOS DE PEDIDO ---
  const ORDER_STATUS_MAP = {
    "Pedido recibido": { title: "Pedido recibido", desc: "Tu pedido fue recibido correctamente.", icon: "fa-receipt", bg: "#eff6ff", color: "#3b82f6" },
    "Pago confirmado": { title: "Pago confirmado", desc: "Hemos confirmado tu pago.", icon: "fa-circle-check", bg: "#ecfdf5", color: "#10b981" },
    "Pedido en preparación": { title: "Pedido en preparación", desc: "Tu producto está siendo preparado.", icon: "fa-box-open", bg: "#fef3c7", color: "#f59e0b" },
    "Pedido empacado": { title: "Pedido empacado", desc: "Tu pedido ya fue empacado y listo para despacho.", icon: "fa-box", bg: "#f5f3ff", color: "#6366f1" },
    "Pedido enviado": { title: "Pedido enviado", desc: "Tu pedido fue entregado a la transportadora.", icon: "fa-truck-ramp-box", bg: "#ecfeff", color: "#06b6d4" },
    "Producto en tránsito": { title: "Producto en tránsito", desc: "Tu pedido va en camino.", icon: "fa-truck", bg: "#e0f2fe", color: "#0284c7" },
    "Producto llegó a centro logístico": { title: "Producto llegó a centro logístico", desc: "Tu paquete llegó al centro de distribución de Barranquilla.", icon: "fa-warehouse", bg: "#fce7f3", color: "#db2777" },
    "Pedido en ruta de entrega": { title: "Pedido en ruta de entrega", desc: "El repartidor está entregando tu pedido hoy.", icon: "fa-motorcycle", bg: "#fef9c3", color: "#ca8a04" },
    "Entrega exitosa": { title: "Entrega exitosa", desc: "Tu pedido fue entregado exitosamente.", icon: "fa-house-circle-check", bg: "#d1fae5", color: "#10b981" },
    "Entrega fallida": { title: "Entrega fallida", desc: "No fue posible entregar el pedido. Reprogramaremos la entrega.", icon: "fa-triangle-exclamation", bg: "#fee2e2", color: "#ef4444" },
    "Retraso en envío": { title: "Retraso en envío", desc: "Tu pedido presenta un retraso por condiciones logísticas.", icon: "fa-clock", bg: "#ffedd5", color: "#f97316" },
    "Producto cancelado": { title: "Producto cancelado", desc: "Tu pedido fue cancelado.", icon: "fa-circle-xmark", bg: "#f1f5f9", color: "#64748b" },
    "Devolución iniciada": { title: "Devolución iniciada", desc: "Hemos iniciado el proceso de devolución.", icon: "fa-rotate-left", bg: "#fae8ff", color: "#a855f7" },
    "Reembolso procesado": { title: "Reembolso procesado", desc: "Tu reembolso fue realizado correctamente.", icon: "fa-hand-holding-dollar", bg: "#e2fbf9", color: "#14b8a6" }
  };

  const ORDER_STEPS_FLOW = [
    "Pedido recibido",
    "Pago confirmado",
    "Pedido en preparación",
    "Pedido empacado",
    "Pedido enviado",
    "Producto en tránsito",
    "Producto llegó a centro logístico",
    "Pedido en ruta de entrega",
    "Entrega exitosa"
  ];

  function normalizeStatus(status) {
    if (!status || status === 'Pendiente') return "Pedido recibido";
    if (status === 'Despachado') return "Pedido enviado";
    
    const match = Object.keys(ORDER_STATUS_MAP).find(
      key => key.toLowerCase() === status.toLowerCase()
    );
    return match || "Pedido recibido";
  }

  // --- CARGAR HISTORIAL DE COMPRAS ---
  const historyLoading = document.getElementById("history-loading");
  const historyEmpty = document.getElementById("history-empty");
  const historyTable = document.getElementById("history-table");
  const historyList = document.getElementById("history-list");

  async function loadPurchaseHistory() {
    if (!user || !user.idUser) return;
    
    if (historyLoading) historyLoading.style.display = "block";
    if (historyEmpty) historyEmpty.style.display = "none";
    if (historyTable) historyTable.style.display = "none";

    try {
      const response = await fetch(`/api/compra/usuario/${user.idUser}`, {
        method: "GET",
        headers: authHeaders
      });

      if (historyLoading) historyLoading.style.display = "none";

      if (response.ok) {
        const compras = await response.json();
        
        if (!compras || compras.length === 0) {
          if (historyEmpty) historyEmpty.style.display = "block";
          return;
        }

        if (historyTable) historyTable.style.display = "table";
        if (historyList) {
          historyList.innerHTML = "";
          compras.forEach((compra) => {
            const fechaStr = new Date(compra.fecha).toLocaleDateString('es-ES', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            const statusNormalized = normalizeStatus(compra.estado);
            const statusConfig = ORDER_STATUS_MAP[statusNormalized] || ORDER_STATUS_MAP["Pedido recibido"];

            const statusBadge = `
              <span style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 20px; background-color: ${statusConfig.bg}; color: ${statusConfig.color}; font-size: 0.8em; font-weight: 700; border: 1px solid ${statusConfig.color}25;">
                <i class="fa ${statusConfig.icon}"></i> ${statusConfig.title}
              </span>
            `;

            const row = `
              <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold; color: #1b4332;">#${compra.id_compra}</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${fechaStr}</td>
                <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold; color: #2e7d32;">$${parseFloat(compra.total).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">${statusBadge}</td>
                <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">
                  <div style="display: inline-flex; gap: 8px;">
                    <button class="btn-view-receipt btn-primary" data-id="${compra.id_compra}" style="padding: 6px 12px; font-size: 0.85em; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; background: linear-gradient(90deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 4px; box-shadow: 0 2px 5px rgba(16,185,129,0.2);">
                      <i class="fa fa-eye"></i> Ver Recibo
                    </button>
                    <button class="btn-track-order" data-id="${compra.id_compra}" data-status="${statusNormalized}" style="padding: 6px 12px; font-size: 0.85em; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 4px; box-shadow: 0 2px 5px rgba(59,130,246,0.2); font-weight: bold;">
                      <i class="fa fa-map-marker-alt"></i> Rastrear
                    </button>
                  </div>
                </td>
              </tr>
            `;
            historyList.insertAdjacentHTML("beforeend", row);
          });

          document.querySelectorAll(".btn-view-receipt").forEach((btn) => {
            btn.addEventListener("click", function() {
              const idCompra = this.getAttribute("data-id");
              openReceiptModal(idCompra);
            });
          });

          document.querySelectorAll(".btn-track-order").forEach((btn) => {
            btn.addEventListener("click", function() {
              const idCompra = this.getAttribute("data-id");
              const currentStatus = this.getAttribute("data-status");
              openTrackingModal(idCompra, currentStatus);
            });
          });
        }
      } else {
        if (historyEmpty) historyEmpty.style.display = "block";
      }
    } catch (error) {
      if (historyLoading) historyLoading.style.display = "none";
      console.error("Error al cargar historial:", error);
      if (historyEmpty) historyEmpty.style.display = "block";
    }
  }

  // --- MODAL DE RASTREO (TIMELINE) ---
  const trackingModal = document.getElementById("tracking-modal");
  const closeTrackingModal = document.getElementById("close-tracking-modal");
  const btnCloseTrackingModal = document.getElementById("btn-close-tracking-modal");

  function openTrackingModal(idCompra, rawStatus) {
    if (!trackingModal) return;
    trackingModal.style.display = "flex";

    const activeStatus = normalizeStatus(rawStatus);
    const activeConfig = ORDER_STATUS_MAP[activeStatus] || ORDER_STATUS_MAP["Pedido recibido"];

    document.getElementById("track-order-id").textContent = `#${idCompra}`;

    const banner = document.getElementById("track-active-banner");
    const iconWrapper = document.getElementById("track-active-icon-wrapper");
    const activeTitle = document.getElementById("track-active-title");
    const activeDesc = document.getElementById("track-active-desc");

    if (banner) {
      banner.style.backgroundColor = activeConfig.bg;
      banner.style.borderColor = activeConfig.color + "40";
    }
    if (iconWrapper) {
      iconWrapper.style.backgroundColor = activeConfig.color;
      iconWrapper.innerHTML = `<i class="fa ${activeConfig.icon}"></i>`;
    }
    if (activeTitle) activeTitle.textContent = activeConfig.title;
    if (activeDesc) activeDesc.textContent = activeConfig.desc;

    const timelineContainer = document.getElementById("timeline-items-container");
    if (!timelineContainer) return;
    timelineContainer.innerHTML = "";

    let stepsToRender = [];
    const isException = !ORDER_STEPS_FLOW.includes(activeStatus);

    if (!isException) {
      const activeIndex = ORDER_STEPS_FLOW.indexOf(activeStatus);
      ORDER_STEPS_FLOW.forEach((step, index) => {
        const stepConfig = ORDER_STATUS_MAP[step];
        const isDone = index < activeIndex;
        const isActive = index === activeIndex;
        
        stepsToRender.push({
          title: stepConfig.title,
          desc: stepConfig.desc,
          icon: stepConfig.icon,
          color: stepConfig.color,
          isDone,
          isActive
        });
      });
    } else {
      let regularLimit = 0;
      if (activeStatus === "Retraso en envío" || activeStatus === "Entrega fallida") {
        regularLimit = 5;
      } else if (activeStatus === "Devolución iniciada" || activeStatus === "Reembolso procesado") {
        regularLimit = 8;
      } else if (activeStatus === "Producto cancelado") {
        regularLimit = 0;
      }

      ORDER_STEPS_FLOW.forEach((step, index) => {
        if (index <= regularLimit) {
          const stepConfig = ORDER_STATUS_MAP[step];
          stepsToRender.push({
            title: stepConfig.title,
            desc: stepConfig.desc,
            icon: stepConfig.icon,
            color: stepConfig.color,
            isDone: true,
            isActive: false
          });
        }
      });

      stepsToRender.push({
        title: activeConfig.title,
        desc: activeConfig.desc,
        icon: activeConfig.icon,
        color: activeConfig.color,
        isDone: false,
        isActive: true
      });
    }

    stepsToRender.forEach((step) => {
      let iconColor = "#94a3b8";
      let bgCircle = "#f1f5f9";
      let borderStyle = "1px solid #cbd5e1";
      let titleStyle = "color: #64748b; font-weight: 500;";
      let descStyle = "color: #94a3b8; font-size: 0.85em;";
      let pulseHtml = "";

      if (step.isDone) {
        iconColor = "#ffffff";
        bgCircle = "#10b981";
        borderStyle = "none";
        titleStyle = "color: #1e293b; font-weight: 700;";
        descStyle = "color: #475569; font-size: 0.85em;";
      } else if (step.isActive) {
        iconColor = "#ffffff";
        bgCircle = step.color;
        borderStyle = `2px solid ${step.color}`;
        titleStyle = `color: ${step.color}; font-weight: 800; font-size: 1.05em;`;
        descStyle = "color: #1e293b; font-size: 0.88em; font-weight: 500;";
        
        pulseHtml = `
          <span style="position: absolute; width: 34px; height: 34px; border-radius: 50%; background-color: ${step.color}30; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; z-index: -1;"></span>
        `;
      }

      const itemHtml = `
        <div style="position: relative; display: flex; gap: 18px; align-items: flex-start; box-sizing: border-box;">
          <div style="position: relative; display: flex; align-items: center; justify-content: center; z-index: 10;">
            ${pulseHtml}
            <div style="width: 32px; height: 32px; border-radius: 50%; background-color: ${bgCircle}; border: ${borderStyle}; color: ${iconColor}; display: flex; align-items: center; justify-content: center; font-size: 0.9em; box-shadow: 0 2px 6px rgba(0,0,0,0.06); box-sizing: border-box;">
              <i class="fa ${step.isDone ? 'fa-check' : step.icon}"></i>
            </div>
          </div>
          <div style="flex: 1; padding-top: 3px;">
            <h4 style="margin: 0; ${titleStyle}">${step.title}</h4>
            <p style="margin: 3px 0 0 0; ${descStyle}">${step.desc}</p>
          </div>
        </div>
      `;
      timelineContainer.insertAdjacentHTML("beforeend", itemHtml);
    });

    if (!document.getElementById("timeline-ping-styles")) {
      const styles = document.createElement("style");
      styles.id = "timeline-ping-styles";
      styles.innerHTML = `
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(styles);
    }
  }

  function closeTrackingModalFunc() {
    if (trackingModal) trackingModal.style.display = "none";
  }

  if (closeTrackingModal) closeTrackingModal.addEventListener("click", closeTrackingModalFunc);
  if (btnCloseTrackingModal) btnCloseTrackingModal.addEventListener("click", closeTrackingModalFunc);
  window.addEventListener("click", (e) => {
    if (e.target === trackingModal) closeTrackingModalFunc();
  });

  // --- MODAL DEL RECIBO ELECTRÓNICO ---
  const receiptModal = document.getElementById("receipt-modal");
  const closeReceiptModal = document.getElementById("close-receipt-modal");
  const btnCloseModalReceipt = document.getElementById("btn-close-modal-receipt");

  async function openReceiptModal(idCompra) {
    currentActiveReceiptId = idCompra;
    if (receiptModal) receiptModal.style.display = "flex";
    
    // Resetear campos
    document.getElementById("receipt-client-name").textContent = "Cargando...";
    document.getElementById("receipt-shipping-address").textContent = "Cargando...";
    document.getElementById("receipt-date").textContent = "Cargando...";
    document.getElementById("receipt-payment-method").textContent = "Cargando...";
    document.getElementById("receipt-order-id").textContent = "Cargando...";
    document.getElementById("receipt-items-list").innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 15px;"><i class="fa fa-spinner fa-spin"></i> Cargando detalles...</td></tr>';
    document.getElementById("receipt-subtotal").textContent = "$0.00";
    document.getElementById("receipt-shipping").textContent = "$0.00";
    document.getElementById("receipt-total").textContent = "$0.00";

    const sendEmailInput = document.getElementById("send-email-invoice-input");
    if (sendEmailInput) {
      sendEmailInput.value = user.emailUser || "";
    }

    try {
      const response = await fetch(`/api/compra/recibo/${idCompra}`, {
        headers: authHeaders
      });

      if (response.ok) {
        const recibo = await response.json();
        
        document.getElementById("receipt-client-name").textContent = recibo.nombre_cliente;
        document.getElementById("receipt-shipping-address").textContent = recibo.direccion_envio || "No especificada";
        document.getElementById("receipt-date").textContent = new Date(recibo.fecha).toLocaleDateString('es-ES', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        document.getElementById("receipt-order-id").textContent = `#${recibo.id_compra}`;
        document.getElementById("receipt-payment-method").textContent = recibo.metodo_pago || "Tarjeta de Crédito";

        let subtotal = 0;
        let rowsHtml = "";

        recibo.detalles.forEach((item) => {
          const precio = parseFloat(item.precio_unitario);
          const itemTotal = item.cantidad * precio;
          subtotal += itemTotal;
          rowsHtml += `
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 8px; border: 1px solid #ddd;">
                ${item.nombre_producto}
                ${item.presentacion ? `<br><span style="font-size: 0.85em; color: #64748b;">Presentación: ${item.presentacion}</span>` : ''}
              </td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.cantidad}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${precio.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">$${itemTotal.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
            </tr>
          `;
        });

        document.getElementById("receipt-items-list").innerHTML = rowsHtml;

        const totalVal = parseFloat(recibo.total);
        const shipping = Math.max(0, totalVal - subtotal);

        document.getElementById("receipt-subtotal").textContent = `$${subtotal.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        document.getElementById("receipt-shipping").textContent = shipping === 0 ? "Gratis" : `$${shipping.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        document.getElementById("receipt-total").textContent = `$${totalVal.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      } else {
        alert("Error al cargar los detalles del recibo.");
        closeModal();
      }
    } catch (error) {
      console.error("Error al cargar detalles de recibo:", error);
      alert("Error de red al cargar el recibo.");
      closeModal();
    }
  }

  function closeModal() {
    if (receiptModal) receiptModal.style.display = "none";
    currentActiveReceiptId = null;
  }

  if (closeReceiptModal) closeReceiptModal.addEventListener("click", closeModal);
  if (btnCloseModalReceipt) btnCloseModalReceipt.addEventListener("click", closeModal);
  
  // Cerrar al hacer clic fuera del modal
  window.addEventListener("click", (e) => {
    if (e.target === receiptModal) {
      closeModal();
    }
  });

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
      if (!currentActiveReceiptId) {
        alert("No hay ningún recibo seleccionado.");
        return;
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
          body: JSON.stringify({ idCompra: currentActiveReceiptId, email })
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
            closeModal();
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

  // Imprimir/Descargar como PDF profesional
  const btnPrintModalReceipt = document.getElementById("btn-print-modal-receipt");
  if (btnPrintModalReceipt) {
    btnPrintModalReceipt.addEventListener("click", function() {
      const element = document.getElementById("receipt-invoice-print-area");
      const orderId = document.getElementById("receipt-order-id").textContent.replace("#", "");
      if (element) {
        const opt = {
          margin:       0.3,
          filename:     `Recibo_Compra_AgroCampo_${orderId}.pdf`,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true },
          jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
      }
    });
  }

  // --- MANEJO DE PESTAÑAS (TABS) ---
  const tabAccount = document.getElementById("tab-account");
  const tabPurchases = document.getElementById("tab-purchases");
  const tabAddresses = document.getElementById("tab-addresses");
  const sectionAccount = document.getElementById("section-account");
  const sectionPurchases = document.getElementById("section-purchases");
  const sectionAddresses = document.getElementById("section-addresses");
  const container = document.querySelector(".profile-container");

  function switchTab(tabToActive) {
    [tabAccount, tabPurchases, tabAddresses].forEach(t => t && t.classList.remove("active"));
    [sectionAccount, sectionPurchases, sectionAddresses].forEach(s => s && (s.style.display = "none"));

    if (tabToActive === 'account') {
      if (tabAccount) tabAccount.classList.add("active");
      if (sectionAccount) sectionAccount.style.display = "block";
      if (container) container.classList.remove("wide-mode");
    } else if (tabToActive === 'purchases') {
      if (tabPurchases) tabPurchases.classList.add("active");
      if (sectionPurchases) sectionPurchases.style.display = "block";
      if (container) container.classList.add("wide-mode");
      loadPurchaseHistory();
    } else if (tabToActive === 'addresses') {
      if (tabAddresses) tabAddresses.classList.add("active");
      if (sectionAddresses) sectionAddresses.style.display = "block";
      if (container) container.classList.remove("wide-mode");
      loadAddresses();
    }
  }

  if (tabAccount) tabAccount.addEventListener("click", () => switchTab('account'));
  if (tabPurchases) tabPurchases.addEventListener("click", () => switchTab('purchases'));
  if (tabAddresses) tabAddresses.addEventListener("click", () => switchTab('addresses'));

  // --- MANEJO DE DIRECCIONES ---
  let editingAddressId = null;
  let loadedAddresses = [];

  async function loadAddresses() {
    const listContainer = document.getElementById("addresses-list-container");
    if (!listContainer) return;

    try {
      const res = await fetch(`/api/user/${user.idUser}/direcciones`, { headers: authHeaders });
      if (res.ok) {
        loadedAddresses = await res.json();
        if (loadedAddresses.length === 0) {
          listContainer.innerHTML = '<p style="color:#64748b; margin-bottom: 15px;">No tienes direcciones guardadas.</p>';
        } else {
          listContainer.innerHTML = "";
          loadedAddresses.forEach(dir => {
            let fullAddr = `${dir.direccion_principal}, ${dir.ciudad}, ${dir.departamento}.`;
            if (dir.codigo_postal) fullAddr += ` CP: ${dir.codigo_postal}.`;
            fullAddr += ` Tel: ${dir.telefono}.`;
            if (dir.notas) fullAddr += ` Notas: ${dir.notas}`;

            listContainer.innerHTML += `
              <div style="border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; background: white; transition: all 0.2s ease;">
                <div style="flex: 1; padding-right: 15px;">
                  <h4 style="margin: 0 0 5px 0; color: #1b4332; font-weight: 700;"><i class="fa fa-map-marker-alt" style="color:#10b981; margin-right:5px;"></i> ${dir.titulo}</h4>
                  <p style="margin: 0; font-size: 0.9em; color: #475569; line-height: 1.4;">${fullAddr}</p>
                </div>
                <div style="display: flex; gap: 10px; align-items: center; flex-shrink: 0;">
                  <button class="btn-edit-address" data-id="${dir.id_direccion}" style="background: #f0fdf4; border: 1px solid #dcfce7; color: #10b981; cursor: pointer; font-size: 1.1em; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 8px; transition: all 0.2s;" title="Editar Dirección"><i class="fa fa-edit"></i></button>
                  <button class="btn-delete-address" data-id="${dir.id_direccion}" style="background: #fef2f2; border: 1px solid #fee2e2; color: #ef4444; cursor: pointer; font-size: 1.1em; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 8px; transition: all 0.2s;" title="Eliminar Dirección"><i class="fa fa-trash"></i></button>
                </div>
              </div>
            `;
          });

          // Bind edit events
          document.querySelectorAll('.btn-edit-address').forEach(btn => {
            btn.addEventListener('click', (e) => {
              const idDir = e.currentTarget.getAttribute('data-id');
              const address = loadedAddresses.find(d => d.id_direccion == idDir);
              if (address) {
                editingAddressId = idDir;
                
                // Rellenar formulario
                document.getElementById('prof-ship-title').value = address.titulo;
                document.getElementById('prof-ship-address').value = address.direccion_principal;
                document.getElementById('prof-ship-state').value = address.departamento;
                document.getElementById('prof-ship-city').value = address.ciudad;
                document.getElementById('prof-ship-phone').value = address.telefono;
                document.getElementById('prof-ship-zip').value = address.codigo_postal || '';
                document.getElementById('prof-ship-notes').value = address.notas || '';

                // Modificar título del formulario
                const heading = document.getElementById('address-form-heading');
                if (heading) heading.innerHTML = '<i class="fa fa-map-marked-alt"></i> Editar Dirección de Envío';

                // Mostrar formulario y ocultar botón principal
                profileNewAddressForm.style.display = "block";
                btnShowAddAddress.style.display = "none";

                // Scroll suave al formulario
                profileNewAddressForm.scrollIntoView({ behavior: 'smooth' });
              }
            });
          });

          // Bind delete events
          document.querySelectorAll('.btn-delete-address').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              const idDir = e.currentTarget.getAttribute('data-id');
              if (await confirm("¿Seguro que deseas eliminar esta dirección?")) {
                try {
                  const delRes = await fetch(`/api/user/${user.idUser}/direcciones/${idDir}`, { method: 'DELETE', headers: authHeaders });
                  if (delRes.ok) {
                    if (editingAddressId == idDir) {
                      // Si eliminan la que se está editando, cancelar edición
                      editingAddressId = null;
                      formProfileAddAddress.reset();
                      profileNewAddressForm.style.display = "none";
                      btnShowAddAddress.style.display = "block";
                    }
                    loadAddresses();
                  }
                } catch (err) { console.error(err); }
              }
            });
          });
        }
      }
    } catch (e) {
      console.error(e);
      listContainer.innerHTML = "<p>Error al cargar direcciones.</p>";
    }
  }

  const btnShowAddAddress = document.getElementById("btn-show-add-address");
  const profileNewAddressForm = document.getElementById("profile-new-address-form");
  const btnCancelProfNew = document.getElementById("btn-cancel-prof-new");
  const formProfileAddAddress = document.getElementById("form-profile-add-address");

  if (btnShowAddAddress) {
    btnShowAddAddress.addEventListener("click", () => {
      editingAddressId = null;
      formProfileAddAddress.reset();
      
      const heading = document.getElementById('address-form-heading');
      if (heading) heading.innerHTML = '<i class="fa fa-map-marked-alt"></i> Registrar Dirección de Envío';

      profileNewAddressForm.style.display = "block";
      btnShowAddAddress.style.display = "none";
    });
  }

  if (btnCancelProfNew) {
    btnCancelProfNew.addEventListener("click", () => {
      editingAddressId = null;
      formProfileAddAddress.reset();
      profileNewAddressForm.style.display = "none";
      btnShowAddAddress.style.display = "block";
    });
  }

  if (formProfileAddAddress) {
    formProfileAddAddress.addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = {
        titulo: document.getElementById('prof-ship-title').value,
        direccion_principal: document.getElementById('prof-ship-address').value,
        departamento: document.getElementById('prof-ship-state').value,
        ciudad: document.getElementById('prof-ship-city').value,
        telefono: document.getElementById('prof-ship-phone').value,
        codigo_postal: document.getElementById('prof-ship-zip').value,
        notas: document.getElementById('prof-ship-notes').value
      };

      try {
        const url = editingAddressId 
          ? `/api/user/${user.idUser}/direcciones/${editingAddressId}` 
          : `/api/user/${user.idUser}/direcciones`;
        const method = editingAddressId ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method: method,
          headers: authHeaders,
          body: JSON.stringify(body)
        });
        if (res.ok) {
          editingAddressId = null;
          formProfileAddAddress.reset();
          profileNewAddressForm.style.display = "none";
          btnShowAddAddress.style.display = "block";
          loadAddresses();
        } else {
          alert('Error al guardar la dirección');
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Cargar historial al iniciar
  loadPurchaseHistory();
});
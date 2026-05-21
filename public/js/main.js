// PWA Registration & Manifest Injection
(function() {
  // Inyectar el manifest dinámicamente si no existe
  if (!document.querySelector('link[rel="manifest"]')) {
    const manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    manifestLink.href = '/manifest.json';
    document.head.appendChild(manifestLink);
    
    const themeMeta = document.createElement('meta');
    themeMeta.name = 'theme-color';
    themeMeta.content = '#10b981';
    document.head.appendChild(themeMeta);
  }

  // Registrar Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('SW registrado con éxito:', registration.scope);
        })
        .catch(err => {
          console.log('Fallo al registrar el SW:', err);
        });
    });
  }
})();

// Interceptor global de fetch para añadir Token CSRF automáticamente a todas las llamadas AJAX (POST, PUT, DELETE)
(function() {
  const originalFetch = window.fetch;
  window.fetch = async function(url, options = {}) {
    const csrfCookie = document.cookie.split('; ').find(row => row.trim().startsWith('XSRF-TOKEN='));
    const csrfToken = csrfCookie ? csrfCookie.split('=')[1] : null;
    if (csrfToken && options.method && ['POST', 'PUT', 'DELETE'].includes(options.method.toUpperCase())) {
      options.headers = options.headers || {};
      options.headers['x-csrf-token'] = decodeURIComponent(csrfToken);
    }
    return originalFetch(url, options);
  };
})();

document.addEventListener("DOMContentLoaded", function () {
  // Variables globales
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  const cartCount = document.querySelectorAll(".cart-count");

  // Actualizar contador del carrito
  function updateCartCount() {
    const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
    cartCount.forEach((element) => {
      element.textContent = totalItems;
    });
  }

  function linkOpen() {
    const links = document.querySelectorAll(".nav-link");

    links.forEach((link) => {
      link.addEventListener("click", function () {
        links.forEach((l) => l.classList.remove("active"));
        this.classList.add("active");
      });
    });
  }

  // Manejar clic en botones de la tienda usando Delegación de Eventos (evita registros duplicados)
  document.addEventListener("click", function (e) {
    // 1. Añadir al carrito
    const addToCartBtn = e.target.closest(".btn-add-to-cart");
    if (addToCartBtn) {
      const productId = addToCartBtn.getAttribute("data-id");
      const productCard = addToCartBtn.closest(".product-card");
      const productName = productCard.querySelector("h3").textContent;
      const productPrice = parseFloat(
        productCard
          .querySelector(".product-price")
          .textContent.replace(/[^\d]/g, "")
      );
      const productImg = productCard.querySelector("img").src;
      const productPresentacion = addToCartBtn.getAttribute("data-presentacion") || "Unidad";
      const productDisponibilidad = addToCartBtn.getAttribute("data-disponibilidad");
      const maxQty = parseInt(productDisponibilidad, 10);

      // Verificar si el producto ya está en el carrito
      const existingItem = cart.find((item) => item.id === productId);

      if (!isNaN(maxQty)) {
        const currentQtyInCart = existingItem ? existingItem.quantity : 0;
        if (currentQtyInCart + 1 > maxQty) {
          alert(`Lo sentimos, no hay suficientes unidades disponibles. Máximo disponible: ${maxQty}`);
          return;
        }
      }

      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        cart.push({
          id: productId,
          name: productName,
          price: productPrice,
          img: productImg,
          quantity: 1,
          presentacion: productPresentacion
        });
      }

      // Guardar en localStorage y actualizar contador
      localStorage.setItem("cart", JSON.stringify(cart));
      updateCartCount();

      // Mostrar notificación
      showNotification(`${productName} añadido al carrito`);
      return;
    }

    // 2. Comprar ahora
    const buyNowBtn = e.target.closest(".btn-buy-now");
    if (buyNowBtn) {
      const productId = buyNowBtn.getAttribute("data-id");
      window.location.href = `/carrito?buyNow=${productId}`;
      return;
    }
  });

  // Función para mostrar notificaciones
  function showNotification(message) {
    const notification = document.createElement("div");
    notification.className = "notification";
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add("show");
    }, 10);

    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300); // Esto es el tiempo de la animación CSS de desaparición
    }, 3000); // 3 segundos antes de empezar a desaparecer
  }

  // Función para buscar productos
  function searchProducts() {
    const searchTerm = document
      .getElementById("search-input")
      .value.toLowerCase()
      .trim();
    const productCards = document.querySelectorAll(".product-card");
    const categorySections = document.querySelectorAll(".category-section");

    let hasResults = false;

    productCards.forEach((card) => {
      const productName = card.querySelector("h3").textContent.toLowerCase();
      const productDescription = card
        .querySelector(".product-description")
        .textContent.toLowerCase();

      if (
        searchTerm === "" ||
        productName.includes(searchTerm) ||
        productDescription.includes(searchTerm)
      ) {
        card.style.display = "block";
        hasResults = true;
      } else {
        card.style.display = "none";
      }
    });

    // Mostrar/ocultar secciones según si tienen resultados
    categorySections.forEach((section) => {
      const visibleProducts = section.querySelectorAll(
        '.product-card[style="display: block"]'
      );
      if (visibleProducts.length > 0 || searchTerm === "") {
        section.style.display = "block";
      } else {
        section.style.display = "none";
      }
    });

    // Mostrar mensaje si no hay resultados
    const noResultsMessage = document.getElementById("no-results-message");
    if (!hasResults && searchTerm) {
      if (!noResultsMessage) {
        const message = document.createElement("div");
        message.id = "no-results-message";
        message.className = "no-results";
        message.innerHTML = `<p>No se encontraron productos para "${searchTerm}"</p>`;
        document
          .querySelector("main")
          .insertBefore(message, document.querySelector(".product-section"));
      }
    } else if (noResultsMessage) {
      noResultsMessage.remove();
    }

    // Los botones ya se manejan automáticamente vía delegación de eventos.
  }

  // Configurar el buscador - con dropdown en vivo
  function setupSearch() {
    const searchInput = document.getElementById("search-input");
    const clearButton = document.getElementById("clear-search");
    const dropdown = document.getElementById("search-dropdown");
    const dropdownResults = document.getElementById("search-dropdown-results");
    const dropdownLoading = document.getElementById("search-dropdown-loading");
    const dropdownEmpty = document.getElementById("search-dropdown-empty");
    const dropdownMore = document.getElementById("search-dropdown-more");

    let debounceTimer;

    if (searchInput && dropdown) {
      // Autocompletar término si estamos en la página de buscar
      const urlParams = new URLSearchParams(window.location.search);
      const currentQuery = urlParams.get('q');
      if (currentQuery && window.location.pathname === '/buscar') {
        searchInput.value = currentQuery;
        if (clearButton) clearButton.style.display = 'inline-block';
      }

      // Ocultar dropdown si se hace click fuera
      document.addEventListener("click", function(e) {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.style.display = "none";
        }
      });

      // Mostrar dropdown al enfocar si hay texto
      searchInput.addEventListener("focus", function() {
        if (this.value.trim().length > 0) {
          dropdown.style.display = "block";
        }
      });

      searchInput.addEventListener("input", function () {
        const query = this.value.trim();
        
        if (clearButton) {
          clearButton.style.display = query ? "inline-block" : "none";
        }

        clearTimeout(debounceTimer);

        if (query.length === 0) {
          dropdown.style.display = "none";
          return;
        }

        dropdown.style.display = "block";
        dropdownResults.innerHTML = '';
        dropdownLoading.style.display = "block";
        dropdownEmpty.style.display = "none";
        dropdownMore.style.display = "none";

        // Debounce de 300ms para no saturar el servidor
        debounceTimer = setTimeout(async () => {
          try {
            const res = await fetch(`/api/buscar?q=${encodeURIComponent(query)}`);
            const productos = await res.json();
            
            dropdownLoading.style.display = "none";

            if (productos.length === 0) {
              dropdownEmpty.style.display = "block";
            } else {
              productos.forEach(prod => {
                const li = document.createElement('li');
                li.innerHTML = `
                  <a href="/buscar?q=${encodeURIComponent(prod.nombre_producto)}" style="display: flex; align-items: center; padding: 12px 15px; text-decoration: none; color: #1e293b; border-radius: 12px; transition: all 0.2s ease; margin-bottom: 2px;">
                    <div style="width: 50px; height: 50px; flex-shrink: 0; border-radius: 10px; overflow: hidden; border: 1px solid #f1f5f9; box-shadow: 0 2px 5px rgba(0,0,0,0.05); margin-right: 15px;">
                      <img src="${prod.imagen}" alt="${prod.nombre_producto}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <div style="flex: 1; min-width: 0;">
                      <div style="font-weight: 700; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${prod.nombre_producto}</div>
                      <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                        <span style="color: #10b981; font-weight: 800; font-size: 0.9rem;">$${prod.precio}</span>
                        ${prod.categoria ? `<span style="font-size: 0.7rem; background: #f1f5f9; color: #64748b; padding: 2px 8px; border-radius: 20px; font-weight: 600; text-transform: capitalize;">${prod.categoria}</span>` : ''}
                      </div>
                    </div>
                    <i class="fas fa-chevron-right" style="color: #cbd5e1; font-size: 0.8rem; margin-left: 10px; transition: transform 0.2s;"></i>
                  </a>
                `;
                // Hover effect
                const a = li.querySelector('a');
                const icon = li.querySelector('i');
                a.addEventListener('mouseenter', () => {
                  a.style.background = '#f8fafc';
                  a.style.transform = 'translateX(4px)';
                  icon.style.color = '#10b981';
                  icon.style.transform = 'translateX(2px)';
                });
                a.addEventListener('mouseleave', () => {
                  a.style.background = 'transparent';
                  a.style.transform = 'translateX(0)';
                  icon.style.color = '#cbd5e1';
                  icon.style.transform = 'translateX(0)';
                });
                
                dropdownResults.appendChild(li);
              });

              // Mostrar enlace "Ver todos los resultados" si hay texto
              dropdownMore.href = `/buscar?q=${encodeURIComponent(query)}`;
              dropdownMore.style.display = "block";
              
              dropdownMore.addEventListener('mouseenter', () => dropdownMore.style.opacity = '0.9');
              dropdownMore.addEventListener('mouseleave', () => dropdownMore.style.opacity = '1');
            }
          } catch (err) {
            console.error("Error cargando búsqueda en vivo:", err);
            dropdownLoading.style.display = "none";
          }
        }, 300);
      });

      if (clearButton) {
        clearButton.addEventListener("click", function () {
          searchInput.value = "";
          clearButton.style.display = "none";
          dropdown.style.display = "none";
          searchInput.focus();
          if (window.location.pathname === '/buscar') {
            window.location.href = '/';
          }
        });
      }

      searchInput.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
          this.value = "";
          dropdown.style.display = "none";
          if (clearButton) clearButton.style.display = "none";
        }
      });
    }
  }

  // Cargar productos ha sido eliminado porque ahora EJS los renderiza desde el servidor
  // Funciones de admin eliminadas de main.js para evitar conflictos con admin.js

  function mostrarLoader() {
    updateCartCount(); // Actualizar contador al cargar
    linkOpen(); // Configurar enlaces activos
    
    // Actualizar avatar del header con la foto personalizada del usuario
    const user = JSON.parse(localStorage.getItem("user"));
    if (user && user.avatar) {
      const headerAvatar = document.getElementById("header-user-avatar");
      if (headerAvatar) {
        headerAvatar.src = user.avatar;
      }
    }
    
    console.log("Página cargada y contador del carrito actualizado.");
  }

  function linkCatalogo() {
    const catalogoLink = document.getElementById('btn_catalogo');
    if (catalogoLink) {
      catalogoLink.addEventListener('click', () => {
        const categoriesSection = document.querySelector('.categories-section');
        if (categoriesSection) {
          categoriesSection.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }
  }
  // Mostrar el formulario de productos solo para el admin en el index
  function mostrarFormularioAdmin() {
    const user = JSON.parse(localStorage.getItem("user"));
    const form = document.getElementById("product-form");
    if (form) {
      form.style.display = user && user.rolUser === 1 ? "flex" : "none";
    }
  }
  mostrarFormularioAdmin();

  setupSearch(); // Configurar buscador
  updateCartCount(); // Actualizar contador del carrito al cargar la página

  // Las recargas dinámicas de foco se han removido porque EJS carga todo de una vez.
  linkOpen();
  mostrarLoader(); // Mostrar loader al cargar la páginal
  linkCatalogo();

  // Interceptar clics en enlaces de deslogueo para mostrar animación premium
  document.body.addEventListener('click', function (e) {
    const link = e.target.closest('a');
    if (link && link.getAttribute('href') === '/logout') {
      e.preventDefault();
      
      const loader = document.getElementById('global-loader');
      const loaderIcon = document.getElementById('loader-icon');
      const loaderText = document.getElementById('loader-text');
      
      if (loader) {
        loader.style.display = 'flex';
        if (loaderIcon) {
          loaderIcon.className = 'fa fa-spinner fa-spin fa-3x';
          loaderIcon.style.color = '#3ba75a';
        }
        if (loaderText) {
          loaderText.textContent = 'Cerrando sesión...';
          loaderText.style.color = '';
        }
        
        setTimeout(() => {
          if (loaderIcon) {
            loaderIcon.className = 'fa-solid fa-circle-check fa-3x';
            loaderIcon.style.color = '#10b981';
          }
          if (loaderText) {
            loaderText.textContent = '¡Sesión cerrada con éxito! Vuelve pronto.';
            loaderText.style.color = '#10b981';
          }
          
          setTimeout(() => {
            // Limpiar localStorage y redirigir a logout para limpiar cookies de sesión
            localStorage.clear();
            window.location.href = '/logout';
          }, 1500);
        }, 1200);
      } else {
        localStorage.clear();
        window.location.href = '/logout';
      }
    }
  });
});


document.addEventListener('DOMContentLoaded', function () {
  document.body.addEventListener('click', function (e) {
    const link = e.target.closest('a');
    if (
      link &&
      link.href &&
      !link.href.startsWith('javascript:') &&
      !link.target &&
      !link.hasAttribute('download') &&
      !link.classList.contains('no-loader') &&
      link.getAttribute('href') !== '#'
    ) {
      // Mostrar el loader, pero no retrasar la navegación artificialmente
      const loader = document.getElementById('global-loader');
      if (loader) {
        loader.style.display = 'flex';
      }
      // La navegación ocurrirá naturalmente, no necesitamos preventDefault() ni setTimeout()
    }
  });
});

// Ocultar el loader globalmente en eventos de ciclo de vida e historial (popstate, pageshow, pagehide)
// Esto se define fuera de DOMContentLoaded para garantizar que los eventos se registren inmediatamente 
// y capturen la navegación hacia atrás/adelante del navegador (incluyendo la caché bfcache)
(function() {
  function ocultarLoader() {
    const loader = document.getElementById('global-loader');
    if (loader) {
      loader.style.display = 'none';
    }
  }

  window.addEventListener('pageshow', ocultarLoader);
  window.addEventListener('pagehide', ocultarLoader);
  window.addEventListener('popstate', ocultarLoader);
})();

// --- SISTEMA DE MODALES PREMIUM PARA ALERT/CONFIRM ---
(function() {
  // Inyectar estilos para el modal
  const style = document.createElement('style');
  style.textContent = `
    .agro-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    .agro-modal-overlay.active {
      opacity: 1;
    }
    .agro-modal-card {
      background: #ffffff;
      border-radius: 20px;
      padding: 2.2rem 2rem;
      max-width: 440px;
      width: 90%;
      text-align: center;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.25);
      border-top: 6px solid #10b981;
      transform: scale(0.9) translateY(20px);
      transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-sizing: border-box;
      font-family: 'Outfit', sans-serif;
    }
    .agro-modal-overlay.active .agro-modal-card {
      transform: scale(1) translateY(0);
    }
    .agro-modal-icon {
      width: 70px;
      height: 70px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.2rem;
      font-size: 2.2rem;
      background: linear-gradient(135deg, #1b4332 0%, #10b981 100%);
      color: #ffffff;
      box-shadow: 0 8px 25px rgba(16, 185, 129, 0.35);
    }
    .agro-modal-icon.warning {
      background: linear-gradient(135deg, #b45309 0%, #f59e0b 100%);
      box-shadow: 0 8px 25px rgba(245, 158, 11, 0.35);
    }
    .agro-modal-icon.danger {
      background: linear-gradient(135deg, #991b1b 0%, #ef4444 100%);
      box-shadow: 0 8px 25px rgba(239, 68, 68, 0.35);
    }
    .agro-modal-title {
      color: #1b4332;
      margin: 0 0 10px 0;
      font-size: 1.4rem;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .agro-modal-title.warning {
      color: #b45309;
    }
    .agro-modal-title.danger {
      color: #991b1b;
    }
    .agro-modal-message {
      color: #475569;
      font-size: 0.98rem;
      line-height: 1.55;
      margin: 0 0 1.8rem 0;
      font-weight: 500;
    }
    .agro-modal-buttons {
      display: flex;
      gap: 12px;
      justify-content: center;
    }
    .agro-modal-btn {
      padding: 12px 26px;
      border: none;
      border-radius: 12px;
      font-size: 0.95rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: 'Outfit', sans-serif;
    }
    .agro-modal-btn-primary {
      background: linear-gradient(135deg, #1b4332 0%, #10b981 100%);
      color: #ffffff;
      box-shadow: 0 5px 15px rgba(16, 185, 129, 0.25);
      flex: 1;
    }
    .agro-modal-btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 7px 20px rgba(16, 185, 129, 0.35);
    }
    .agro-modal-btn-primary:active {
      transform: translateY(0);
    }
    .agro-modal-btn-danger {
      background: linear-gradient(135deg, #991b1b 0%, #ef4444 100%);
      color: #ffffff;
      box-shadow: 0 5px 15px rgba(239, 68, 68, 0.25);
      flex: 1;
    }
    .agro-modal-btn-danger:hover {
      transform: translateY(-2px);
      box-shadow: 0 7px 20px rgba(239, 68, 68, 0.35);
    }
    .agro-modal-btn-secondary {
      background: #f1f5f9;
      color: #475569;
      flex: 1;
    }
    .agro-modal-btn-secondary:hover {
      background: #e2e8f0;
      color: #1e293b;
      transform: translateY(-2px);
    }
    .agro-modal-btn-secondary:active {
      transform: translateY(0);
    }
  `;
  document.head.appendChild(style);

  // Sobrescribir alert
  window.alert = function(message) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'agro-modal-overlay';
      
      const isError = message.toLowerCase().includes('error') || message.toLowerCase().includes('denegado') || message.toLowerCase().includes('fallo') || message.toLowerCase().includes('incorrecta');
      const iconClass = isError ? 'fa-solid fa-triangle-exclamation danger' : 'fa-solid fa-circle-check';
      const iconType = isError ? 'danger' : 'success';
      const titleText = isError ? '¡Atención!' : 'Información';
      const titleClass = isError ? 'danger' : '';

      overlay.innerHTML = `
        <div class="agro-modal-card">
          <div class="agro-modal-icon ${iconType}">
            <i class="${iconClass}"></i>
          </div>
          <h3 class="agro-modal-title ${titleClass}">${titleText}</h3>
          <p class="agro-modal-message">${message}</p>
          <div class="agro-modal-buttons">
            <button class="agro-modal-btn agro-modal-btn-primary" id="agro-alert-ok-btn">Aceptar</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      // Activar animación
      setTimeout(() => overlay.classList.add('active'), 10);

      const closeAlert = () => {
        overlay.classList.remove('active');
        setTimeout(() => {
          document.body.removeChild(overlay);
          resolve();
        }, 200);
      };

      document.getElementById('agro-alert-ok-btn').addEventListener('click', closeAlert);
    });
  };

  // Sobrescribir confirm
  window.confirm = function(message) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'agro-modal-overlay';
      
      const isDelete = message.toLowerCase().includes('eliminar') || message.toLowerCase().includes('cancelar');
      const iconClass = isDelete ? 'fa-solid fa-trash-can danger' : 'fa-solid fa-circle-question warning';
      const iconType = isDelete ? 'danger' : 'warning';
      const titleText = 'Confirmar Acción';
      const titleClass = isDelete ? 'danger' : 'warning';
      const acceptBtnClass = isDelete ? 'agro-modal-btn-danger' : 'agro-modal-btn-primary';

      overlay.innerHTML = `
        <div class="agro-modal-card">
          <div class="agro-modal-icon ${iconType}">
            <i class="${iconClass}"></i>
          </div>
          <h3 class="agro-modal-title ${titleClass}">${titleText}</h3>
          <p class="agro-modal-message">${message}</p>
          <div class="agro-modal-buttons">
            <button class="agro-modal-btn agro-modal-btn-secondary" id="agro-confirm-cancel-btn">Cancelar</button>
            <button class="agro-modal-btn ${acceptBtnClass}" id="agro-confirm-ok-btn">Aceptar</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      // Activar animación
      setTimeout(() => overlay.classList.add('active'), 10);

      const handleAction = (val) => {
        overlay.classList.remove('active');
        setTimeout(() => {
          document.body.removeChild(overlay);
          resolve(val);
        }, 200);
      };

      document.getElementById('agro-confirm-ok-btn').addEventListener('click', () => handleAction(true));
      document.getElementById('agro-confirm-cancel-btn').addEventListener('click', () => handleAction(false));
    });
  };
})();

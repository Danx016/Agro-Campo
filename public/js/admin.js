// Obtener token JWT del usuario logueado
function getAuthHeaders() {
  const user = JSON.parse(localStorage.getItem('user'));
  const headers = { 'Content-Type': 'application/json' };
  if (user && user.token) {
    headers['Authorization'] = `Bearer ${user.token}`;
  }
  return headers;
}

// Helper para mostrar feedback premium en el loader global
function showLoaderState(state, message, duration = 2200, callback = null) {
  const loader = document.getElementById('global-loader');
  const loaderIcon = document.getElementById('loader-icon');
  const loaderText = document.getElementById('loader-text');
  
  if (!loader) return;
  
  loader.style.display = 'flex';
  
  if (state === 'loading') {
    if (loaderIcon) {
      loaderIcon.className = 'fa fa-spinner fa-spin fa-3x';
      loaderIcon.style.color = '#2d5c88';
    }
    if (loaderText) {
      loaderText.textContent = message;
      loaderText.style.color = '';
    }
  } else if (state === 'success') {
    if (loaderIcon) {
      loaderIcon.className = 'fa-solid fa-circle-check fa-3x';
      loaderIcon.style.color = '#10b981';
    }
    if (loaderText) {
      loaderText.textContent = message;
      loaderText.style.color = '#10b981';
    }
    setTimeout(() => {
      loader.style.display = 'none';
      if (callback) callback();
    }, duration);
  } else if (state === 'error') {
    if (loaderIcon) {
      loaderIcon.className = 'fa-solid fa-circle-xmark fa-3x';
      loaderIcon.style.color = '#ef4444';
    }
    if (loaderText) {
      loaderText.textContent = message;
      loaderText.style.color = '#ef4444';
    }
    setTimeout(() => {
      loader.style.display = 'none';
      if (callback) callback();
    }, duration);
  }
}

// Basic HTML escaper to prevent XSS (OWASP A03/A05)
const escapeHTML = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// Etiquetas de categorías
const CAT_LABELS = {
  semillas: '&#127807; Semillas del Valle',
  lacteos: '&#128004; Lácteos La Finca',
  abonos: '&#127810; Abonos Natura',
  ferre: '&#128296; Ferre Campo',
  cosechas: '&#127807; Cosechas del Sol',
  agro: '&#128663; AgroEquipos'
};

// Cargar productos y mostrarlos en la tabla
async function cargarProductos() {
  const res = await fetch('/api/admin/productos', { cache: 'no-store' });
  const productos = await res.json();
  const tbody = document.getElementById('products-table-body');
  tbody.innerHTML = '';
  productos.forEach(producto => {
    const catLabel = CAT_LABELS[producto.categoria] || '<span style="color:#94a3b8;">Sin sección</span>';
    
    // Lógica para Disponibilidad y Estado visual de la fila
    let dispBadge = '';
    let dispText = producto.disponibilidad || 'No especificada';
    let rowOpacity = '1';
    let rowBg = '';
    const numDisp = parseInt(dispText, 10);
    
    if (dispText.toLowerCase().includes("sin") || dispText.toLowerCase().includes("agotado")) {
      dispBadge = '<span style="background:#ef4444;color:white;padding:3px 8px;border-radius:6px;font-size:0.85em;font-weight:bold;"><i class="fa fa-ban"></i> Agotado</span>';
      rowOpacity = '0.6';
      rowBg = 'background-color: #fef2f2;';
    } else if (!isNaN(numDisp)) {
      if (numDisp <= 0) {
        dispBadge = '<span style="background:#ef4444;color:white;padding:3px 8px;border-radius:6px;font-size:0.85em;font-weight:bold;"><i class="fa fa-ban"></i> Agotado</span>';
        rowOpacity = '0.6';
        rowBg = 'background-color: #fef2f2;';
      } else if (numDisp <= 5) {
        dispBadge = `<span style="background:#f59e0b;color:white;padding:3px 8px;border-radius:6px;font-size:0.85em;font-weight:bold;"><i class="fa fa-exclamation-triangle"></i> Quedan ${numDisp}</span>`;
      } else {
        dispBadge = `<span style="background:#10b981;color:white;padding:3px 8px;border-radius:6px;font-size:0.85em;font-weight:bold;">${numDisp} uds.</span>`;
      }
    } else {
      dispBadge = `<span style="color:#64748b;font-size:0.9em;font-weight:600;">${escapeHTML(dispText)}</span>`;
    }

    const tr = document.createElement('tr');
    tr.style.cssText = `${rowBg} opacity: ${rowOpacity}; transition: all 0.3s;`;
    tr.innerHTML = `
      <td>${escapeHTML(producto.id_producto)}</td>
      <td><strong>${escapeHTML(producto.nombre_producto)}</strong></td>
      <td style="font-weight: bold; color: #10b981;">$${parseFloat(producto.precio).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
      <td><span style="background:#d1fae5;color:#065f46;padding:3px 10px;border-radius:20px;font-size:0.82em;font-weight:600;">${catLabel}</span></td>
      <td style="text-align: center;">${dispBadge}</td>
      <td><img src="${escapeHTML(producto.imagen)}" alt="img" style="max-width:55px; border-radius:6px;" /></td>
      <td>
        <button class="edit-btn" data-id="${escapeHTML(producto.id_producto)}">Editar</button>
        <button class="delete-btn" data-id="${escapeHTML(producto.id_producto)}">Eliminar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Al hacer click en editar, carga los datos en el formulario
document.getElementById('products-table-body').addEventListener('click', async function(e) {
  if (e.target.classList.contains('edit-btn')) {
    const id = e.target.dataset.id;
    const res = await fetch(`/api/admin/productos/${id}`, { cache: 'no-store' });
    const producto = await res.json();
    document.getElementById('product-id').value = producto.id_producto;
    document.getElementById('product-name').value = producto.nombre_producto;
    document.getElementById('product-price').value = Math.round(parseFloat(producto.precio)).toLocaleString('es-CO');
    document.getElementById('product-img').value = producto.imagen;
    document.getElementById('product-desc').value = producto.descripcion || '';
    document.getElementById('product-categoria').value = producto.categoria || '';
    document.getElementById('product-origen').value = producto.origen || '';
    document.getElementById('product-presentacion').value = producto.presentacion || '';
    document.getElementById('product-cuidado').value = producto.cuidado || '';
    document.getElementById('product-disponibilidad').value = producto.disponibilidad || '';
    document.getElementById('preview-img').src = producto.imagen;
    document.getElementById('preview-img').style.display = 'block';
    document.getElementById('product-form').scrollIntoView({ behavior: 'smooth' });
  }
  // Eliminar producto (con autenticación)
  if (e.target.classList.contains('delete-btn')) {
    const id = e.target.dataset.id;
    if (await confirm('¿Seguro que deseas eliminar este producto?')) {
      showLoaderState('loading', 'Eliminando producto...');
      try {
        const res = await fetch(`/api/admin/productos/${id}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        if (res.ok) {
          await cargarProductos();
          showLoaderState('success', '¡Producto eliminado con éxito!');
        } else {
          const data = await res.json();
          showLoaderState('error', data.message || 'Error al eliminar. Verifica tus permisos.');
        }
      } catch (err) {
        showLoaderState('error', 'Error de red al intentar eliminar el producto.');
      }
    }
  }
});

// Guardar (crear o actualizar) producto (con autenticación)
document.getElementById('product-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const id = document.getElementById('product-id').value;
  const nombre = document.getElementById('product-name').value;
  const rawPrecio = document.getElementById('product-price').value;
  const precio = rawPrecio.replace(/[^\d]/g, '');
  const imagen = document.getElementById('product-img').value;
  const descripcion = document.getElementById('product-desc').value;
  const categoria = document.getElementById('product-categoria').value;
  const origen = document.getElementById('product-origen').value;
  const presentacion = document.getElementById('product-presentacion').value;
  const cuidado = document.getElementById('product-cuidado').value;
  const disponibilidad = document.getElementById('product-disponibilidad').value;

  const producto = { nombre, precio, imagen, descripcion, categoria, origen, presentacion, cuidado, disponibilidad };

  showLoaderState('loading', id ? 'Actualizando producto...' : 'Creando producto...');
  try {
    if (id) {
      // Actualizar
      const res = await fetch(`/api/admin/productos/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(producto)
      });
      if (res.ok) {
        await cargarProductos();
        document.getElementById('product-form').reset();
        document.getElementById('preview-img').style.display = 'none';
        showLoaderState('success', '¡Producto actualizado con éxito!');
      } else {
        const data = await res.json();
        showLoaderState('error', data.message || 'Error al actualizar. Verifica tus permisos.');
      }
    } else {
      // Crear
      const res = await fetch('/api/admin/productos', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(producto)
      });
      if (res.ok) {
        await cargarProductos();
        document.getElementById('product-form').reset();
        document.getElementById('preview-img').style.display = 'none';
        showLoaderState('success', '¡Producto creado con éxito!');
      } else {
        const data = await res.json();
        showLoaderState('error', data.message || 'Error al crear. Verifica tus permisos.');
      }
    }
  } catch (err) {
    showLoaderState('error', 'Error de red al procesar el producto.');
  }
});

// Mostrar preview de la imagen
document.getElementById('product-img').addEventListener('input', function() {
  const url = this.value;
  const preview = document.getElementById('preview-img');
  if (url) {
    preview.src = url;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }
});

// Llamado inicial para cargar productos en la tabla al cargar la página
cargarProductos();

// ========== SECCIÓN DE GESTIÓN DE USUARIOS ==========

// Cargar usuarios y mostrarlos en la tabla
async function cargarUsuarios() {
  try {
    const res = await fetch('/api/admin/usuarios', {
      headers: getAuthHeaders(),
      cache: 'no-store'
    });
    if (!res.ok) throw new Error("Error al obtener usuarios");
    
    const usuarios = await res.json();
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    usuarios.forEach(usuario => {
      const tr = document.createElement('tr');
      let rolStr = 'Usuario Común';
      if (usuario.id_rol === 1) rolStr = '<span style="background-color: #2d5c88; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.85em; font-weight: bold;">Admin</span>';
      else if (usuario.id_rol === 2) rolStr = '<span style="background-color: #10b981; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.85em; font-weight: bold;">Vendedor</span>';
      
      tr.innerHTML = `
        <td>${escapeHTML(usuario.id_usuario)}</td>
        <td>${escapeHTML(usuario.nombre)}</td>
        <td>${escapeHTML(usuario.apodo)}</td>
        <td>${escapeHTML(usuario.correo)}</td>
        <td>${rolStr}</td>
        <td>
          <button class="edit-user-btn" data-id="${escapeHTML(usuario.id_usuario)}" style="padding: 6px 12px; background-color: #2d5c88; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85em; font-weight: bold; margin-right: 5px;">Editar</button>
          <button class="delete-user-btn" data-id="${escapeHTML(usuario.id_usuario)}" style="padding: 6px 12px; background-color: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85em; font-weight: bold;">Eliminar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error("Error al cargar usuarios:", error);
    const tbody = document.getElementById('users-table-body');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">Error al cargar usuarios de la base de datos.</td></tr>';
    }
  }
}

// Cargar usuario para edición al hacer clic en Editar
const usersTableBody = document.getElementById('users-table-body');
if (usersTableBody) {
  usersTableBody.addEventListener('click', async function(e) {
    if (e.target.classList.contains('edit-user-btn')) {
      const id = e.target.dataset.id;
      try {
        const res = await fetch(`/api/admin/usuarios/${id}`, {
          headers: getAuthHeaders(),
          cache: 'no-store'
        });
        if (res.ok) {
          const usuario = await res.json();
          document.getElementById('user-id').value = usuario.id_usuario;
          document.getElementById('user-name').value = usuario.nombre;
          document.getElementById('user-apodo').value = usuario.apodo;
          document.getElementById('user-email').value = usuario.correo;
          document.getElementById('user-role').value = usuario.id_rol === 1 ? '1' : (usuario.id_rol === 2 ? '2' : 'null');
          document.getElementById('user-password').value = '';
          
          // Hacer scroll suave al formulario de edición
          document.getElementById('user-form').scrollIntoView({ behavior: 'smooth' });
        }
      } catch (error) {
        showLoaderState('error', 'Error al cargar detalles del usuario');
      }
    }
    
    // Eliminar usuario
    if (e.target.classList.contains('delete-user-btn')) {
      const id = e.target.dataset.id;
      if (await confirm('¿Seguro que deseas eliminar este usuario permanentemente?')) {
        showLoaderState('loading', 'Eliminando usuario...');
        try {
          const res = await fetch(`/api/admin/usuarios/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
          });
          if (res.ok) {
            await cargarUsuarios();
            showLoaderState('success', 'Usuario eliminado correctamente');
          } else {
            const data = await res.json();
            showLoaderState('error', data.error || 'Error al eliminar usuario. No puedes eliminar tu propia cuenta.');
          }
        } catch (error) {
          showLoaderState('error', 'Error de conexión al eliminar usuario');
        }
      }
    }
  });
}

// Guardar cambios del usuario
const userForm = document.getElementById('user-form');
if (userForm) {
  userForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const id = document.getElementById('user-id').value;
    const nombre = document.getElementById('user-name').value;
    const apodo = document.getElementById('user-apodo').value;
    const correo = document.getElementById('user-email').value;
    const id_role_value = document.getElementById('user-role').value;
    const contrasena = document.getElementById('user-password').value;

    if (!id) {
      showLoaderState('error', 'Por favor selecciona un usuario de la lista para editar.');
      return;
    }
 
    const payload = { 
      nombre, 
      apodo, 
      correo, 
      id_rol: id_role_value === '1' ? 1 : (id_role_value === '2' ? 2 : null), 
      contrasena 
    };
 
    showLoaderState('loading', 'Actualizando usuario...');
    try {
      const res = await fetch(`/api/admin/usuarios/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await cargarUsuarios();
        userForm.reset();
        document.getElementById('user-id').value = '';
        showLoaderState('success', 'Usuario actualizado correctamente');
      } else {
        const data = await res.json();
        showLoaderState('error', data.error || 'Error al actualizar el usuario');
      }
    } catch (error) {
      showLoaderState('error', 'Error de red al actualizar el usuario');
    }
  });
}

// Botón de Cancelar Edición de Usuario
const btnCancelUserEdit = document.getElementById('btn-cancel-user-edit');
if (btnCancelUserEdit) {
  btnCancelUserEdit.addEventListener('click', () => {
    if (userForm) userForm.reset();
    document.getElementById('user-id').value = '';
  });
}

// ========== SECCIÓN DE GESTIÓN DE COMPRAS ==========

// Lista máster de los 14 estados para el panel de administración
const ADMIN_ORDER_STATUSES = [
  "Pedido recibido",
  "Pago confirmado",
  "Pedido en preparación",
  "Pedido empacado",
  "Pedido enviado",
  "Producto en tránsito",
  "Producto llegó a centro logístico",
  "Pedido en ruta de entrega",
  "Entrega exitosa",
  "Entrega fallida",
  "Retraso en envío",
  "Producto cancelado",
  "Devolución iniciada",
  "Reembolso procesado"
];

// Cargar compras y mostrarlas en la tabla
async function cargarCompras() {
  try {
    const res = await fetch('/api/admin/compras', {
      headers: getAuthHeaders(),
      cache: 'no-store'
    });
    if (!res.ok) throw new Error("Error al obtener compras globales");

    const compras = await res.json();
    const tbody = document.getElementById('orders-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (compras.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #64748b;">No hay compras registradas en el sistema.</td></tr>';
      return;
    }

    compras.forEach(compra => {
      const tr = document.createElement('tr');
      const totalFloat = parseFloat(compra.total).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      const fechaStr = new Date(compra.fecha).toLocaleString();

      // Normalizar el estado actual para que coincida con la lista del admin
      let currentStatus = compra.estado || "Pedido recibido";
      if (currentStatus === "Pendiente") currentStatus = "Pedido recibido";
      if (currentStatus === "Despachado") currentStatus = "Pedido enviado";

      let optionsHtml = "";
      ADMIN_ORDER_STATUSES.forEach(statusOpt => {
        const isSelected = statusOpt.toLowerCase() === currentStatus.toLowerCase() ? "selected" : "";
        optionsHtml += `<option value="${statusOpt}" ${isSelected}>${statusOpt}</option>`;
      });

      tr.innerHTML = `
        <td>#${escapeHTML(compra.id_compra)}</td>
        <td><strong>${escapeHTML(compra.nombre_usuario)}</strong></td>
        <td>${escapeHTML(compra.correo)}</td>
        <td>${fechaStr}</td>
        <td><strong style="color: #2e7d32;">$${totalFloat}</strong></td>
        <td>
          <select class="change-order-status-select" data-id="${escapeHTML(compra.id_compra)}" style="padding: 6px 10px; border-radius: 6px; border: 1.5px solid #cbd5e1; background-color: white; font-weight: 700; cursor: pointer; color: #1e293b; font-size: 0.85em; outline: none; transition: border-color 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            ${optionsHtml}
          </select>
        </td>
        <td>
          <button class="delete-order-btn" data-id="${escapeHTML(compra.id_compra)}" style="padding: 6px 12px; background-color: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85em; font-weight: bold; display: inline-flex; align-items: center; gap: 4px;">
            <i class="fa fa-trash"></i> Eliminar
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Asignar listeners de cambio de estado a todos los selects
    document.querySelectorAll(".change-order-status-select").forEach(select => {
      select.addEventListener("change", async function() {
        const idCompra = this.dataset.id;
        const nuevoEstado = this.value;
        
        showLoaderState('loading', `Actualizando estado del pedido #${idCompra} a "${nuevoEstado}"...`);
        try {
          const res = await fetch(`/api/compra/${idCompra}/estado`, {
            method: 'PUT',
            headers: {
              ...getAuthHeaders(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ estado: nuevoEstado })
          });
          
          if (res.ok) {
            showLoaderState('success', `El estado del pedido #${idCompra} ahora es: "${nuevoEstado}"`);
          } else {
            const data = await res.json();
            showLoaderState('error', data.error || 'Error al actualizar el estado del pedido.');
            // Restaurar estado cargándolo de nuevo
            cargarCompras();
          }
        } catch (error) {
          console.error("Error al actualizar el estado del pedido:", error);
          showLoaderState('error', 'Error de red al intentar actualizar el estado.');
          cargarCompras();
        }
      });
    });

  } catch (error) {
    console.error("Error al cargar compras globales:", error);
    const tbody = document.getElementById('orders-table-body');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Error al cargar el historial global de compras.</td></tr>';
    }
  }
}

// Escuchar eliminación de compras en el cuerpo de la tabla
const ordersTableBody = document.getElementById('orders-table-body');
if (ordersTableBody) {
  ordersTableBody.addEventListener('click', async function (e) {
    const btn = e.target.closest('.delete-order-btn');
    if (btn) {
      const id = btn.dataset.id;
      if (await confirm(`¿Está seguro que desea eliminar de forma permanente el registro de la compra #${id}? Esta acción no se puede deshacer y eliminará también el desglose de productos asociados.`)) {
        showLoaderState('loading', 'Eliminando compra de la base de datos...');
        try {
          const res = await fetch(`/api/admin/compras/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
          });
          if (res.ok) {
            await cargarCompras();
            showLoaderState('success', 'Compra y sus detalles eliminados correctamente del sistema');
          } else {
            const data = await res.json();
            showLoaderState('error', data.error || 'Error al eliminar la compra.');
          }
        } catch (error) {
          showLoaderState('error', 'Error de red al intentar eliminar la compra.');
        }
      }
    }
  });
}

// ========== MANEJO DE PESTAÑAS (TABS) DEL ADMINISTRADOR ==========
const tabProducts = document.getElementById('tab-products');
const tabUsers = document.getElementById('tab-users');
const tabOrders = document.getElementById('tab-orders');
const tabStats = document.getElementById('tab-stats');

const sectionProducts = document.getElementById('section-products');
const sectionUsers = document.getElementById('section-users');
const sectionOrders = document.getElementById('section-orders');
const sectionStats = document.getElementById('section-stats');

function switchAdminTab(activeTab, activeSection) {
  const tabs = [tabProducts, tabUsers, tabOrders, tabStats];
  const sections = [sectionProducts, sectionUsers, sectionOrders, sectionStats];

  tabs.forEach(tab => {
    if (!tab) return;
    if (tab === activeTab) {
      tab.classList.add('active');
      tab.style.borderBottom = '3px solid #2d5c88';
      tab.style.color = '#2d5c88';
    } else {
      tab.classList.remove('active');
      tab.style.borderBottom = '3px solid transparent';
      tab.style.color = '#64748b';
    }
  });

  sections.forEach(sec => {
    if (!sec) return;
    sec.style.display = sec === activeSection ? 'block' : 'none';
  });
}

if (tabProducts) {
  tabProducts.addEventListener('click', () => {
    switchAdminTab(tabProducts, sectionProducts);
  });
}

if (tabUsers) {
  tabUsers.addEventListener('click', () => {
    switchAdminTab(tabUsers, sectionUsers);
    cargarUsuarios();
  });
}

if (tabOrders) {
  tabOrders.addEventListener('click', () => {
    switchAdminTab(tabOrders, sectionOrders);
    cargarCompras();
  });
}

// ========== ESTADÍSTICAS GLOBALES ==========
async function cargarEstadisticas() {
  const btnRefresh = document.getElementById('btn-refresh-stats');
  if (btnRefresh) {
    btnRefresh.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Cargando...';
    btnRefresh.disabled = true;
  }
  
  try {
    const res = await fetch('/api/admin/estadisticas', {
      headers: getAuthHeaders()
    });
    
    if (res.ok) {
      const data = await res.json();
      
      // Animar los números
      animarNumero(document.getElementById('stat-revenue'), data.ingresos, true);
      animarNumero(document.getElementById('stat-orders'), data.ventas, false);
      animarNumero(document.getElementById('stat-users'), data.usuarios, false);
      animarNumero(document.getElementById('stat-products'), data.productos, false);
    }
  } catch (error) {
    console.error("Error al cargar estadísticas:", error);
  } finally {
    if (btnRefresh) {
      btnRefresh.innerHTML = '<i class="fa fa-sync-alt"></i> Actualizar Estadísticas';
      btnRefresh.disabled = false;
    }
  }
}

function animarNumero(elemento, valorFinal, esMoneda = false) {
  if (!elemento) return;
  const duracion = 1000;
  const fps = 30;
  const pasos = duracion / (1000 / fps);
  const incremento = valorFinal / pasos;
  let actual = 0;
  let pasoActual = 0;
  
  const timer = setInterval(() => {
    actual += incremento;
    pasoActual++;
    
    if (pasoActual >= pasos) {
      actual = valorFinal;
      clearInterval(timer);
    }
    
    elemento.textContent = esMoneda 
      ? `$${actual.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` 
      : Math.floor(actual).toLocaleString('es-CO');
  }, 1000 / fps);
}

if (tabStats) {
  tabStats.addEventListener('click', () => {
    switchAdminTab(tabStats, sectionStats);
    cargarEstadisticas();
  });
}

const btnRefreshStats = document.getElementById('btn-refresh-stats');
if (btnRefreshStats) {
  btnRefreshStats.addEventListener('click', cargarEstadisticas);
}
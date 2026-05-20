const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { requestLogger } = require('./middleware/logger');
const csrfProtection = require('./middleware/csrf');

dotenv.config();

const app = express();

// Configuración de EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(cookieParser());

// ========== A02: Security Misconfiguration ==========
// Helmet: Headers de seguridad HTTP (CSP, X-Frame-Options, etc.)
// app.use(helmet({
//   contentSecurityPolicy: {
//     directives: {
//       defaultSrc: ["'self'", "*"],
//       scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "*"],
//       styleSrc: ["'self'", "'unsafe-inline'", "*"],
//       imgSrc: ["'self'", "data:", "https:", "http:", "*"],
//       fontSrc: ["'self'", "data:", "https:", "http:", "*"],
//       frameSrc: ["'self'", "*"],
//       connectSrc: ["'self'", "*"]
//     }
//   },
//   crossOriginEmbedderPolicy: false // Necesario para Google Maps iframe
// }));

// CORS: Solo permitir orígenes confiables
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// ========== A09: Security Logging ==========
app.use(requestLogger);

// Servir archivos estáticos PRIMERO para no ser bloqueados por seguridad / CSRF
app.use(express.static(path.join(__dirname, 'public')));

// ========== A05: Injection - Limitar tamaño del body ==========
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(csrfProtection);

// ========== A02: HPP - Prevenir HTTP Parameter Pollution ==========
app.use(hpp());

// ========== A07: Authentication Failures - Rate limiting ==========
// Limitar intentos globales
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200, // Máximo 200 peticiones por IP en 15 minutos
  message: { message: 'Demasiadas peticiones. Intenta de nuevo más tarde.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(globalLimiter);

// Limitar intentos de login (más estricto)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Máximo 10 intentos de login por IP en 15 minutos
  message: { message: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false
});



// Importar rutas
const registerRoute = require('./routes/register');
const loginRoute = require('./routes/login');
const adminRoute = require('./routes/admin');
const userRoutes = require('./routes/user');
const recoverRoute = require('./routes/recover');
const compraRoute = require('./routes/compra');

// ========== A10: Mishandling of Exceptional Conditions ==========
// Deshabilitar header que revela tecnología
app.disable('x-powered-by');

// Servir archivos estáticos se movió arriba para no contar en el rate limit

// Middleware Global para vistas EJS: Extraer usuario del token en Cookie
app.use((req, res, next) => {
  const token = req.cookies.jwt;
  if (token) {
    try {
      res.locals.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      res.locals.user = null;
    }
  } else {
    res.locals.user = null;
  }
  next();
});

const db = require('./models/db');

// Rutas de páginas SSR (EJS)
app.get('/', (req, res) => {
  db.query('SELECT * FROM productos', (err, results) => {
    if (err) {
      console.error("Error al cargar productos en inicio:", err);
      return res.render('index', { productos: [] });
    }
    res.render('index', { productos: results });
  });
});

// Rutas de categorías individuales
const CATEGORIAS = {
  semillas: {
    titulo: 'Semillas del Valle',
    descripcion: 'La mejor selección de semillas certificadas para garantizar una cosecha abundante y de alta calidad.',
    icon: 'fa-seedling',
    keywords: ['semilla', 'grano', 'maiz', 'arroz', 'trigo', 'frijol', 'soya']
  },
  lacteos: {
    titulo: 'Lácteos La Finca',
    descripcion: 'Quesos, sueros, yogures y leche fresca directamente de nuestras vacas a tu mesa.',
    icon: 'fa-cow',
    keywords: ['leche', 'queso', 'suero', 'yogur', 'mantequilla', 'lacteo', 'lácteo']
  },
  abonos: {
    titulo: 'Abonos Natura',
    descripcion: 'Fertilizantes y abonos 100% orgánicos para nutrir tu tierra y maximizar tus cosechas.',
    icon: 'fa-leaf',
    keywords: ['abono', 'fertilizante', 'tierra', 'compost', 'urea', 'humus', 'organico', 'orgánico']
  },
  ferre: {
    titulo: 'Ferre Campo',
    descripcion: 'Todo en herramientas manuales, equipos y materiales para el trabajo duro del campo.',
    icon: 'fa-hammer',
    keywords: ['herramienta', 'pala', 'machete', 'rastrillo', 'martillo', 'alambre', 'manguera', 'pico']
  },
  cosechas: {
    titulo: 'Cosechas del Sol',
    descripcion: 'Hortalizas frescas, frutas y legumbres seleccionadas de la más alta calidad, directas del campo.',
    icon: 'fa-wheat-awn',
    keywords: ['fruta', 'verdura', 'hortaliza', 'tomate', 'cebolla', 'papa', 'yuca', 'fresco', 'platano', 'plátano', 'zanahoria']
  },
  agro: {
    titulo: 'AgroEquipos',
    descripcion: 'Maquinaria agrícola, repuestos y tecnología de punta para modernizar y optimizar tu finca.',
    icon: 'fa-tractor',
    keywords: ['tractor', 'maquina', 'máquina', 'motor', 'bomba', 'fumigadora', 'cosechadora']
  }
};

app.get('/categoria/:slug', (req, res) => {
  const slug = req.params.slug;
  const catInfo = CATEGORIAS[slug];

  if (!catInfo) {
    return res.status(404).json({ message: 'Categoría no encontrada' });
  }

  db.query('SELECT * FROM productos WHERE categoria = ?', [slug], (err, results) => {
    if (err) {
      console.error("Error al cargar productos de categoría:", err);
      return res.render('categoria', { categoria: catInfo, productos: [] });
    }
    res.render('categoria', { categoria: catInfo, productos: results });
  });
});

// Ruta de búsqueda general
app.get('/buscar', (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) return res.redirect('/');

  const term = `%${query}%`;
  db.query(
    'SELECT * FROM productos WHERE nombre_producto LIKE ? OR descripcion LIKE ?',
    [term, term],
    (err, results) => {
      if (err) {
        console.error("Error en la búsqueda:", err);
        return res.render('buscar', { query, productos: [] });
      }
      res.render('buscar', { query, productos: results });
    }
  );
});

// API para búsqueda en vivo (dropdown)
app.get('/api/buscar', (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) return res.json([]);

  const term = `%${query}%`;
  db.query(
    'SELECT id_producto, nombre_producto, precio, imagen, categoria FROM productos WHERE nombre_producto LIKE ? OR descripcion LIKE ? LIMIT 5',
    [term, term],
    (err, results) => {
      if (err) {
        console.error("Error en la API de búsqueda en vivo:", err);
        return res.status(500).json([]);
      }
      res.json(results);
    }
  );
});


app.get('/registro', (req, res) => {
  res.render('register');
});

app.get('/login', (req, res) => {
  res.render('inicio_sesion');
});

app.get('/admin-login', (req, res) => {
  res.render('admin_login');
});

app.get('/admin-register', (req, res) => {
  // ========== A01: Broken Access Control ==========
  // Solo accesible si está logueado como admin
  const token = req.cookies.jwt;
  if (!token) return res.redirect('/login');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.rol !== 1 && decoded.username !== 'admin') {
      return res.redirect('/');
    }
  } catch (err) {
    return res.redirect('/login');
  }
  res.render('admin_register');
});

app.post('/admin-register', async (req, res) => {
  // ========== A01: Broken Access Control ==========
  const token = req.cookies.jwt;
  if (!token) return res.status(401).json({ message: 'Acceso denegado. Se requiere autenticación.' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.rol !== 1 && decoded.username !== 'admin') {
      return res.status(403).json({ message: 'Acceso denegado. Se requieren permisos de administrador.' });
    }
  } catch (err) {
    return res.status(403).json({ message: 'Sesión inválida o expirada.' });
  }

  const bcrypt = require('bcrypt');
  const { name, email, apodo, role, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Las contraseñas no coinciden.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    // Forzar rol 2 (Vendedor/Despachador) exclusivamente para este portal privado de personal
    const finalRol = 2;

    const sql = 'INSERT INTO usuarios (nombre, apodo, correo, contrasena, id_rol) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [name, apodo, email, hashedPassword, finalRol], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ message: 'El correo o nombre de usuario ya está registrado.' });
        }
        console.error('Error al registrar administrador:', err);
        return res.status(500).json({ message: 'Error interno en el servidor.' });
      }
      res.status(201).json({ message: 'Cuenta autorizada creada exitosamente.' });
    });
  } catch (error) {
    console.error('Error al registrar administrador:', error);
    res.status(500).json({ message: 'Error interno en el servidor.' });
  }
});

app.get('/vendedor', (req, res) => {
  // Solo accesible si es vendedor o administrador
  if (!res.locals.user || (res.locals.user.rol !== 2 && res.locals.user.rol !== 1 && res.locals.user.username !== 'admin')) {
    return res.redirect('/login');
  }
  res.render('vendedor');
});

app.get('/recuperar', (req, res) => {
  res.render('ovidaste_contrasena');
});

app.get('/admin', (req, res) => {
  // Solo accesible si es admin
  if (!res.locals.user || (res.locals.user.rol !== 1 && res.locals.user.username !== 'admin')) {
    return res.redirect('/');
  }
  db.query('SELECT * FROM productos', (err, results) => {
    if (err) {
      console.error("Error al cargar productos en panel admin:", err);
      return res.render('admin', { productos: [] });
    }
    res.render('admin', { productos: results });
  });
});

app.get('/perfil', (req, res) => {
  if (!res.locals.user) return res.redirect('/login');
  if (res.locals.user.rol === 2) {
    return res.redirect('/perfil-vendedor');
  }
  res.render('perfil');
});

app.get('/perfil-vendedor', (req, res) => {
  if (!res.locals.user || (res.locals.user.rol !== 2 && res.locals.user.rol !== 1 && res.locals.user.username !== 'admin')) {
    return res.redirect('/login');
  }
  res.render('perfil_vendedor');
});


app.get('/carrito', (req, res) => {
  res.render('carrito');
});

app.get('/envio', (req, res) => {
  if (!res.locals.user) return res.redirect('/login');
  res.render('checkout_envio');
});

app.get('/pago', (req, res) => {
  if (!res.locals.user) return res.redirect('/login');
  res.render('method_pago');
});

app.get('/logout', (req, res) => {
  res.clearCookie('jwt');
  res.redirect('/');
});

// Rutas API con rate limiting
app.use('/register', registerRoute);
app.use('/login', loginLimiter, loginRoute);
app.use('/api/admin', adminRoute);  // Renombrado a /api/admin para evitar conflicto con GET /admin (SSR)
app.use('/api/user', userRoutes);
app.use('/api/recover', recoverRoute);
app.use('/api/compra', compraRoute);

// ========== A10: Manejo global de errores ==========
// Ruta 404 - Página no encontrada
app.use((req, res) => {
  res.status(404).json({ message: 'Recurso no encontrado' });
});

// Manejador global de errores
app.use((err, req, res, next) => {
  const { logError } = require('./middleware/logger');
  logError('Error no manejado', err);

  // No revelar detalles del error en producción
  res.status(500).json({
    message: 'Error interno del servidor'
  });
});

// ========== CONFIGURACIÓN HTTPS (SSL) ==========
const fs = require('fs');
const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// Rutas a los certificados (ajusta estas rutas a donde pongas tus certificados en el servidor real)
const privateKeyPath = path.join(__dirname, 'cert', 'private.key');
const certificatePath = path.join(__dirname, 'cert', 'certificate.crt');

// Verificar si los certificados existen
if (fs.existsSync(privateKeyPath) && fs.existsSync(certificatePath)) {
  const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
  const certificate = fs.readFileSync(certificatePath, 'utf8');
  const credentials = { key: privateKey, cert: certificate };

  const httpsServer = https.createServer(credentials, app);
  
  httpsServer.listen(HTTPS_PORT, () => {
    console.log(`🔒 Servidor SEGURO (HTTPS) corriendo en https://localhost:${HTTPS_PORT}`);
  });

  // Opcional: Redirigir tráfico HTTP a HTTPS
  http.createServer((req, res) => {
    res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
    res.end();
  }).listen(PORT, () => {
    console.log(`➡️  Redirección HTTP a HTTPS activa en el puerto ${PORT}`);
  });

} else {
  // Fallback: Si no hay certificados, arrancar en HTTP normal (Modo Desarrollo)
  const httpServer = http.createServer(app);
  httpServer.listen(PORT, () => {
    console.log(`⚠️  Servidor local (HTTP) corriendo en http://localhost:${PORT}`);
    console.log(`ℹ️  Para habilitar HTTPS, coloca 'private.key' y 'certificate.crt' en la carpeta 'cert'.`);
  });
}

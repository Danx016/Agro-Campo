const jwt = require('jsonwebtoken');

// Middleware que verifica el token JWT
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  // Priorizar cookie 'jwt', fallback a header Authorization
  const token = req.cookies?.jwt || (authHeader && authHeader.split(' ')[1]);

  if (!token) {
    return res.status(401).json({ message: 'Acceso denegado. Token no proporcionado.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    decoded.role = decoded.rol ?? decoded.id_rol ?? null;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Token inválido o expirado.' });
  }
}

// Middleware que verifica si el usuario es administrador
function verifyAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Acceso denegado.' });
  }
  // Verificar rol de admin (rol = 1) o una cuenta privilegiada 'admin'
  const role = req.user.role;
  if (role !== 1 && req.user.username !== 'admin') {
    return res.status(403).json({ message: 'Acceso denegado. Se requieren permisos de administrador.' });
  }
  next();
}

// Middleware para verificar que el usuario solo modifica sus propios datos
function verifySelf(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Acceso denegado.' });
  }
  const requestedId = parseInt(req.params.id);
  if (req.user.id !== requestedId) {
    return res.status(403).json({ message: 'No tienes permiso para modificar este recurso.' });
  }
  next();
}

// Middleware que verifica si el usuario es vendedor o admin
function verifyVendedor(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Acceso denegado.' });
  }
  // Permitir rol de vendedor (2) o administrador (1 o username 'admin')
  const role = req.user.role;
  if (role !== 2 && role !== 1 && req.user.username !== 'admin') {
    return res.status(403).json({ message: 'Acceso denegado. Se requieren permisos de vendedor o administrador.' });
  }
  next();
}

module.exports = { verifyToken, verifyAdmin, verifySelf, verifyVendedor };

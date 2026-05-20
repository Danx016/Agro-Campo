const csrf = require('csurf');

// Configurar el middleware oficial 'csurf' usando almacenamiento en cookies
const csrfProtection = csrf({
  cookie: {
    key: 'csrfToken', // Nombre de la cookie para guardar el token
    httpOnly: false,  // Permitir que Javascript lo lea para adjuntarlo automáticamente a los headers de fetch
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  }
});

// Middleware de envoltura (wrapper) para csurf
function csrfMiddleware(req, res, next) {
  csrfProtection(req, res, (err) => {
    if (err) {
      console.warn('Bloqueo de seguridad CSRF:', err.message);
      return res.status(403).json({ 
        error: 'Acceso denegado: Token CSRF de csurf inválido o faltante en la petición.' 
      });
    }
    
    // Generar el token actual
    const token = req.csrfToken();
    
    // Hacerlo disponible para las vistas EJS
    res.locals.csrfToken = token;
    
    // Guardar el token real en una cookie no HTTPOnly para que el frontend pueda leerlo
    res.cookie('XSRF-TOKEN', token, {
      httpOnly: false,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production'
    });
    
    next();
  });
}

module.exports = csrfMiddleware;

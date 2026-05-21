const express = require('express');
const router = express.Router();
const db = require('../models/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { loginRules, handleValidation } = require('../middleware/validate');
const { logSecurityEvent, logInfo } = require('../middleware/logger');
// ========== A07: Authentication Failures ==========
router.post('/', loginRules, handleValidation, (req, res) => {
  const { username, password } = req.body;

    const sql = 'SELECT * FROM usuarios WHERE apodo = ?';
    db.query(sql, [username], async (err, results) => {
    if (err) {
      console.error('Error al buscar usuario:', err);
      return res.status(500).json({ message: 'Error en el servidor' });
    }
    if (results.length === 0) {
      // ========== A07: Mensaje genérico para no revelar si el usuario existe ==========
      logSecurityEvent('Intento de login fallido - usuario no existe', { username, ip: req.ip });
      return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
    }

    const user = results[0];

    try {
      const passwordMatch = await bcrypt.compare(password, user.contrasena);
      if (!passwordMatch) {
        logSecurityEvent('Intento de login fallido - contraseña incorrecta', { username, ip: req.ip });
        return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
      }
    } catch (error) {
      console.error('Error al comparar contraseña:', error);
      return res.status(500).json({ message: 'Error en el servidor' });
    }

    // ========== A04: JWT con secret fuerte y expiración ==========
    const token = jwt.sign(
      {
        id: user.id_usuario,
        correo: user.correo,
        rol: user.id_rol,
        username: user.apodo
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
        algorithm: "HS256"
      }
    );

    logInfo('Login exitoso', { userId: user.id_usuario, username: user.apodo });

    // Set secure HttpOnly cookie
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(200).json({
      idUser: user.id_usuario,
      nombreUser: user.nombre,
      emailUser: user.correo,
      username: user.apodo,
      rolUser: user.id_rol,
      avatar: user.avatar || '../img/logo vaca.png',
      token,
      message: 'Inicio de sesión exitoso'
    });
  }); // fin db.query
});

module.exports = router;
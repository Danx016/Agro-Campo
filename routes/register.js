const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../models/db');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const { registerRules, handleValidation } = require('../middleware/validate');
const { logSecurityEvent, logInfo } = require('../middleware/logger');

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 100, // Incrementado a 100 para evitar bloqueos durante pruebas de desarrollo
  message: { message: 'Demasiados registros. Intenta de nuevo más tarde.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Función para enviar correo de bienvenida
async function sendWelcomeEmail(name, email, apodo) {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 465,
        secure: process.env.SMTP_PORT !== '587',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      const emailHtml = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <div style="text-align: center; border-bottom: 3px solid #10b981; padding-bottom: 20px; margin-bottom: 20px;">
            <div style="font-size: 3.5em; margin-bottom: 5px;">🌱</div>
            <h2 style="color: #064e3b; margin: 0 0 5px 0; font-size: 1.8em; font-weight: 700;">¡Bienvenido a Agro-Campo!</h2>
            <p style="margin: 0; font-size: 0.95em; color: #10b981; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">DEL CAMPO A TU MESA</p>
          </div>

          <div style="color: #334155; line-height: 1.6; font-size: 1em;">
            <p>Hola <strong>${name}</strong>,</p>
            <p>¡Nos complace enormemente darte la bienvenida a nuestra gran familia de <strong>Agro-Campo</strong>! Tu cuenta ha sido registrada con total éxito.</p>
            
            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 18px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0; color: #166534; font-size: 1.1em;">👤 Datos de tu Cuenta:</h3>
              <ul style="margin: 0; padding-left: 20px; color: #334155;">
                <li style="margin-bottom: 5px;"><strong>Nombre:</strong> ${name}</li>
                <li style="margin-bottom: 5px;"><strong>Usuario / Apodo:</strong> ${apodo}</li>
                <li style="margin-bottom: 5px;"><strong>Correo de acceso:</strong> ${email}</li>
              </ul>
            </div>

            <p>Desde ahora, podrás acceder a los mejores productos de nuestros agricultores locales, apoyar su trabajo y recibir alimentos frescos directamente en tu hogar con total seguridad.</p>
          </div>

          <div style="text-align: center; margin: 25px 0;">
            <a href="http://localhost:3000/login" style="display: inline-block; padding: 12px 28px; background-color: #10b981; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 0.95em; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.25);">
              Iniciar Sesión en Agro-Campo
            </a>
          </div>

          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; font-size: 0.82em; color: #64748b;">
            <p style="margin: 0 0 5px 0; font-weight: bold; color: #10b981;">¡Gracias por preferir a Agro-Campo S.A.S!</p>
            <p style="margin: 0;">Nit: 1050277880 | Tel: 3008723989</p>
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: `"Agro-Campo" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `🌱 ¡Bienvenido a Agro-Campo, ${name}! Registro Exitoso`,
        html: emailHtml
      });
      console.log(`Correo de bienvenida enviado con éxito a ${email}`);
    } catch (mailErr) {
      console.error('Error al enviar correo de bienvenida:', mailErr.message);
    }
  } else {
    console.log("\n==================================================");
    console.log("🌱 [CORREO DE BIENVENIDA SIMULADO POR REGISTRO]");
    console.log("Para:", email);
    console.log("Nombre:", name);
    console.log("Apodo:", apodo);
    console.log("==================================================\n");
  }
}

// Endpoint para verificar disponibilidad de nombre de usuario (apodo)
router.get('/check-username', (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ available: false, message: 'Nombre de usuario requerido' });
  }

  // Expresión regular para caracteres seguros en el nombre de usuario (letras, números, puntos, guiones y guión bajo)
  const usernameRegex = /^[a-zA-Z0-9_.-]+$/;
  if (!usernameRegex.test(username)) {
    return res.status(200).json({ 
      available: false, 
      invalidFormat: true,
      message: 'El nombre de usuario solo puede contener letras, números, puntos o guiones bajos (sin espacios ni acentos).' 
    });
  }

  // Validar que incluya al menos un número, guión bajo o punto para que lleve varios caracteres especiales
  if (!/[0-9_.-]/.test(username)) {
    return res.status(200).json({
      available: false,
      invalidFormat: true,
      message: 'El usuario debe incluir al menos un número, guión bajo (_) o punto.'
    });
  }

  db.query('SELECT id_usuario FROM usuarios WHERE apodo = ?', [username.trim()], (err, results) => {
    if (err) {
      console.error('Error checking username:', err);
      return res.status(500).json({ available: false, message: 'Error en el servidor' });
    }

    if (results.length > 0) {
      return res.status(200).json({ available: false, message: 'Nombre de Usuario ya usado, cambialo o coloca otro' });
    }

    return res.status(200).json({ available: true, message: 'Nombre de usuario disponible' });
  });
});

// ========== A05: Injection + A07: Authentication Failures ==========
router.post('/', registerLimiter, registerRules, handleValidation, async (req, res) => {
  const { name, apodo, email, password, confirmPassword } = req.body;

  // Verificación adicional de contraseñas
  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Las contraseñas no coinciden.' });
  }

    try {
      // ========== A04: Cryptographic Failures - Bcrypt con salt ==========
      const hashedPassword = await bcrypt.hash(password, 12); // Salt rounds 12 para mayor seguridad
      
      // Siempre forzar rol cliente (null) en registro público para evitar escalada de privilegios
      let finalRol = null;

    const sql = 'INSERT INTO usuarios (nombre, apodo, correo, contrasena, id_rol) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [name, apodo, email, hashedPassword, finalRol], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          logSecurityEvent('Intento de registro con datos duplicados', { email, apodo });
          return res.status(400).json({ message: 'El correo o nombre de usuario ya está registrado.' });
        }
        console.error('Error al registrar usuario:', err);
        return res.status(500).json({ message: 'Error en el servidor' });
      }
      logInfo('Nuevo usuario registrado', { userId: result.insertId, apodo });
      sendWelcomeEmail(name, email, apodo);
      res.status(201).json({ message: 'Usuario registrado exitosamente' });
    });
    } catch (error) {
      console.error('Error al hashear contraseña:', error);
      return res.status(500).json({ message: 'Error en el servidor' });
    }
});

router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', '/html/register.html'));
});

module.exports = router;

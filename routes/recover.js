const express = require('express');
const router = express.Router();
const db = require('../models/db');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const { body, handleValidation } = require('../middleware/validate');

// Función robusta para enviar email de recuperación con fallback de consola
async function sendRecoveryEmail(email, code) {
  // Imprimir siempre en la consola del servidor para testing local sumamente fácil
  console.log(`\n==================================================`);
  console.log(`📧 [EMAIL DE RECUPERACIÓN ENVIADO]`);
  console.log(`Para: ${email}`);
  console.log(`Código de recuperación: ${code}`);
  console.log(`Este código expira en 10 minutos.`);
  console.log(`==================================================\n`);

  // Intentar envío real por correo si las credenciales SMTP están en las variables de entorno
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

      await transporter.sendMail({
        from: `"Agro-Campo" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Código de Seguridad de Cuenta - Agro-Campo',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
            <div style="text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 20px;">
              <h2 style="color: #1b4332; margin: 0;">Recuperación de Contraseña - Agro-Campo</h2>
            </div>
            <div style="padding: 20px 0; color: #333333; line-height: 1.6;">
              <p>Hola,</p>
              <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta asociada a este correo electrónico.</p>
              <p>Tu código de seguridad temporal es:</p>
              <div style="text-align: center; margin: 30px 0;">
                <span style="font-size: 32px; font-weight: bold; color: #1b4332; letter-spacing: 5px; background-color: #f0fdf4; padding: 15px 30px; border-radius: 8px; border: 1px dashed #10b981; display: inline-block;">${code}</span>
              </div>
              <p style="color: #e74c3c; font-weight: bold;">Este código expirará en 10 minutos por razones de seguridad.</p>
              <p>Si tú no solicitaste este cambio, puedes ignorar este correo de forma segura. Tu contraseña seguirá siendo la misma.</p>
            </div>
            <div style="border-top: 1px solid #eeeeee; padding-top: 20px; text-align: center; font-size: 12px; color: #777777;">
              <p>© 2026 Agro-Campo. Todos los derechos reservados.</p>
            </div>
          </div>
        `
      });
      console.log(`Correo enviado de manera exitosa a: ${email}`);
    } catch (err) {
      console.error('Error al enviar correo SMTP (se usó consola del servidor como respaldo):', err.message);
    }
  }
}

// 1. Solicitud de código de recuperación
router.post('/request', async (req, res) => {
  const { email } = req.body;

  if (!email || !email.trim()) {
    return res.status(400).json({ message: 'El correo electrónico es requerido' });
  }

  // Verificar si el correo pertenece a un usuario registrado
  db.query('SELECT * FROM usuarios WHERE correo = ?', [email.trim()], async (err, results) => {
    if (err) {
      console.error('Error SQL al buscar correo:', err);
      return res.status(500).json({ message: 'Error en el servidor' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'El correo electrónico no está registrado.' });
    }

    const user = results[0];

    // Generar un código aleatorio de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // El código expira en 10 minutos
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    // Guardar el código y expiración en la base de datos
    db.query(
      'UPDATE usuarios SET reset_code = ?, reset_expires = ? WHERE id_usuario = ?',
      [code, expires, user.id_usuario],
      async (updateErr) => {
        if (updateErr) {
          console.error('Error SQL al guardar código:', updateErr);
          return res.status(500).json({ message: 'Error en el servidor' });
        }

        // Enviar el correo
        await sendRecoveryEmail(user.correo, code);

        res.status(200).json({ 
          success: true, 
          message: 'Se ha enviado un código de recuperación a tu correo electrónico.' 
        });
      }
    );
  });
});

// 2. Verificación del código y cambio de contraseña
router.post('/reset', async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ message: 'Todos los campos son requeridos.' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres.' });
  }

  // Buscar el usuario
  db.query('SELECT * FROM usuarios WHERE correo = ?', [email.trim()], async (err, results) => {
    if (err) {
      console.error('Error SQL al verificar código:', err);
      return res.status(500).json({ message: 'Error en el servidor' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'El correo electrónico no es válido.' });
    }

    const user = results[0];

    // Verificar si hay un código guardado y coincide
    if (!user.reset_code || user.reset_code !== code.trim()) {
      return res.status(400).json({ message: 'El código de recuperación es incorrecto.' });
    }

    // Verificar si el código ya expiró
    const now = new Date();
    if (new Date(user.reset_expires) < now) {
      return res.status(400).json({ message: 'El código de recuperación ha expirado. Solicita uno nuevo.' });
    }

    try {
      // Hashear la nueva contraseña
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Actualizar la contraseña en la base de datos y limpiar los campos de recuperación
      db.query(
        'UPDATE usuarios SET contrasena = ?, reset_code = NULL, reset_expires = NULL WHERE id_usuario = ?',
        [hashedPassword, user.id_usuario],
        (updateErr) => {
          if (updateErr) {
            console.error('Error SQL al actualizar contraseña:', updateErr);
            return res.status(500).json({ message: 'Error al cambiar la contraseña.' });
          }

          res.status(200).json({
            success: true,
            message: 'Tu contraseña ha sido restablecida exitosamente.'
          });
        }
      );
    } catch (hashError) {
      console.error('Error al hashear contraseña:', hashError);
      res.status(500).json({ message: 'Error en el servidor' });
    }
  });
});

module.exports = router;

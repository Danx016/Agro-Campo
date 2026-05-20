const express = require('express');
const router = express.Router();
const db = require('../models/db');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const { verifyToken, verifySelf } = require('../middleware/auth');
const { profileUpdateRules, idParamRule, handleValidation } = require('../middleware/validate');
const { logSecurityEvent, logInfo } = require('../middleware/logger');

// Función para enviar correo de despedida
async function sendDeletionEmail(name, email) {
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
          <div style="text-align: center; border-bottom: 3px solid #ef4444; padding-bottom: 20px; margin-bottom: 20px;">
            <div style="font-size: 3.5em; margin-bottom: 5px;">👋</div>
            <h2 style="color: #991b1b; margin: 0 0 5px 0; font-size: 1.8em; font-weight: 700;">¡Tu cuenta ha sido eliminada!</h2>
            <p style="margin: 0; font-size: 0.95em; color: #ef4444; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">AGRO-CAMPO NOTIFICACIÓN</p>
          </div>

          <div style="color: #334155; line-height: 1.6; font-size: 1em;">
            <p>Hola <strong>${name}</strong>,</p>
            <p>Lamentamos mucho informarte que tu cuenta en <strong>Agro-Campo</strong> ha sido eliminada con éxito y todos tus datos personales han sido removidos de forma definitiva de nuestros sistemas según tu solicitud.</p>
            
            <p>Esperamos que tu experiencia apoyando a los productores y disfrutando de alimentos frescos locales haya sido excelente. Si en el futuro deseas volver a disfrutar de nuestros servicios, estaremos muy felices de recibirte nuevamente con los brazos abiertos.</p>
          </div>

          <div style="text-align: center; margin: 25px 0;">
            <a href="http://localhost:3000/register" style="display: inline-block; padding: 12px 28px; background-color: #10b981; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 0.95em; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.25);">
              Crear una Nueva Cuenta
            </a>
          </div>

          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; font-size: 0.82em; color: #64748b;">
            <p style="margin: 0 0 5px 0; font-weight: bold; color: #ef4444;">¡Esperamos volver a verte pronto, ${name}!</p>
            <p style="margin: 0;">Nit: 1050277880 | Tel: 3008723989</p>
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: `"Agro-Campo" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `👋 Confirmación: Tu cuenta de Agro-Campo ha sido eliminada`,
        html: emailHtml
      });
      console.log(`Correo de cuenta eliminada enviado con éxito a ${email}`);
    } catch (mailErr) {
      console.error('Error al enviar correo de cuenta eliminada:', mailErr.message);
    }
  } else {
    console.log("\n==================================================");
    console.log("👋 [CORREO DE CUENTA ELIMINADA SIMULADO]");
    console.log("Para:", email);
    console.log("Nombre:", name);
    console.log("==================================================\n");
  }
}

// ========== A01: Broken Access Control ==========
// Requiere autenticación + verificar que el usuario modifica sus propios datos
router.put('/:id', verifyToken, verifySelf, idParamRule, profileUpdateRules, handleValidation, async (req, res) => {
  const { nombre, email, username, password, avatar, code } = req.body;

  // Si se está intentando cambiar la contraseña, validar obligatoriamente el código de confirmación
  if (password && password.trim() !== '') {
    if (!code || code.trim() === '') {
      return res.status(400).json({ error: 'Se requiere un código de confirmación enviado a tu correo para cambiar la contraseña.' });
    }

    db.query('SELECT * FROM usuarios WHERE id_usuario = ?', [req.params.id], async (err, results) => {
      if (err || results.length === 0) {
        console.error('Error al buscar usuario para cambiar contraseña:', err);
        return res.status(500).json({ error: 'Error en el servidor' });
      }

      const user = results[0];

      // Verificar código
      if (!user.reset_code || user.reset_code !== code.trim()) {
        return res.status(400).json({ error: 'El código de confirmación de contraseña es incorrecto.' });
      }

      // Verificar expiración del código
      const now = new Date();
      if (new Date(user.reset_expires) < now) {
        return res.status(400).json({ error: 'El código de confirmación ha expirado. Solicita uno nuevo.' });
      }

      // Proceder con la actualización (incluyendo contraseña)
      try {
        const hashedPassword = await bcrypt.hash(password, 12);
        
        let query = 'UPDATE usuarios SET nombre=?, correo=?, apodo=?, contrasena=?, reset_code=NULL, reset_expires=NULL';
        let params = [nombre, email, username, hashedPassword];

        if (avatar) {
          query += ', avatar=?';
          params.push(avatar);
        }

        query += ' WHERE id_usuario=?';
        params.push(req.params.id);

        db.query(query, params, (updateErr) => {
          if (updateErr) {
            console.error('Error SQL al actualizar con contraseña:', updateErr);
            return res.status(500).json({ error: 'Error al actualizar usuario' });
          }
          logInfo('Perfil y contraseña actualizados con código', { userId: req.params.id });
          res.json({ success: true, message: 'Perfil y contraseña actualizados con éxito.' });
        });
      } catch (hashError) {
        console.error('Error al hashear contraseña en perfil:', hashError);
        return res.status(500).json({ error: 'Error al procesar la contraseña' });
      }
    });
  } else {
    // Si NO se está cambiando la contraseña, actualizar el resto de campos normalmente (sin código)
    let query = 'UPDATE usuarios SET nombre=?, correo=?, apodo=?';
    let params = [nombre, email, username];

    if (avatar) {
      query += ', avatar=?';
      params.push(avatar);
    }

    query += ' WHERE id_usuario=?';
    params.push(req.params.id);

    db.query(query, params, (err) => {
      if (err) {
        console.error('Error SQL al actualizar sin contraseña:', err);
        return res.status(500).json({ error: 'Error al actualizar usuario' });
      }
      logInfo('Perfil actualizado sin cambiar contraseña', { userId: req.params.id });
      res.json({ success: true, message: 'Perfil actualizado con éxito.' });
    });
  }
});

// Eliminar cuenta (requiere autenticación + verificar identidad + código de verificación por correo)
router.delete('/:id', verifyToken, verifySelf, idParamRule, handleValidation, (req, res) => {
  const userId = req.params.id;
  const { code } = req.body;

  if (!code || code.trim() === '') {
    return res.status(400).json({ error: 'Se requiere un código de seguridad enviado a tu correo para eliminar la cuenta.' });
  }

  // 1. Obtener los datos del usuario antes de eliminar la fila para verificar el código y poder enviarle el correo
  db.query('SELECT nombre, correo, reset_code, reset_expires FROM usuarios WHERE id_usuario = ?', [userId], (searchErr, results) => {
    if (searchErr || results.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const user = results[0];

    // Verificar código de seguridad
    if (!user.reset_code || user.reset_code !== code.trim()) {
      return res.status(400).json({ error: 'El código de seguridad ingresado es incorrecto.' });
    }

    // Verificar expiración del código
    const now = new Date();
    if (new Date(user.reset_expires) < now) {
      return res.status(400).json({ error: 'El código de seguridad ha expirado. Solicita uno nuevo.' });
    }

    // 2. Eliminar de la base de datos
    db.query('DELETE FROM usuarios WHERE id_usuario = ?', [userId], (err) => {
      if (err) return res.status(500).json({ error: 'Error al eliminar usuario' });
      
      logSecurityEvent('Cuenta eliminada', { userId });
      
      // 3. Enviar correo de despedida
      sendDeletionEmail(user.nombre, user.correo);
      
      res.json({ success: true, message: 'Usuario eliminado con éxito.' });
    });
  });
});
// ================== GESTIÓN DE DIRECCIONES ================== //

// Obtener direcciones de un usuario
router.get('/:id/direcciones', verifyToken, verifySelf, idParamRule, handleValidation, (req, res) => {
  db.query('SELECT * FROM direcciones WHERE id_usuario = ?', [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error al obtener direcciones' });
    res.json(results);
  });
});

// Agregar nueva dirección
router.post('/:id/direcciones', verifyToken, verifySelf, idParamRule, handleValidation, (req, res) => {
  const { titulo, direccion_principal, departamento, ciudad, telefono, codigo_postal, notas } = req.body;
  if (!direccion_principal || !departamento || !ciudad || !telefono) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  const query = 'INSERT INTO direcciones (id_usuario, titulo, direccion_principal, departamento, ciudad, telefono, codigo_postal, notas) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
  const params = [req.params.id, titulo || 'Principal', direccion_principal, departamento, ciudad, telefono, codigo_postal || '', notas || ''];

  db.query(query, params, (err, result) => {
    if (err) return res.status(500).json({ error: 'Error al guardar la dirección' });
    res.json({ success: true, id_direccion: result.insertId, message: 'Dirección guardada con éxito' });
  });
});

// Eliminar dirección
router.delete('/:id/direcciones/:id_dir', verifyToken, verifySelf, idParamRule, handleValidation, (req, res) => {
  db.query('DELETE FROM direcciones WHERE id_direccion = ? AND id_usuario = ?', [req.params.id_dir, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: 'Error al eliminar la dirección' });
    res.json({ success: true, message: 'Dirección eliminada' });
  });
});

// Actualizar dirección existente
router.put('/:id/direcciones/:id_dir', verifyToken, verifySelf, idParamRule, handleValidation, (req, res) => {
  const { titulo, direccion_principal, departamento, ciudad, telefono, codigo_postal, notas } = req.body;
  if (!direccion_principal || !departamento || !ciudad || !telefono) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  const query = 'UPDATE direcciones SET titulo = ?, direccion_principal = ?, departamento = ?, ciudad = ?, telefono = ?, codigo_postal = ?, notas = ? WHERE id_direccion = ? AND id_usuario = ?';
  const params = [titulo || 'Principal', direccion_principal, departamento, ciudad, telefono, codigo_postal || '', notas || '', req.params.id_dir, req.params.id];

  db.query(query, params, (err) => {
    if (err) return res.status(500).json({ error: 'Error al actualizar la dirección' });
    res.json({ success: true, message: 'Dirección actualizada con éxito' });
  });
});

module.exports = router;
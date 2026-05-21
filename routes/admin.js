const express = require("express");
const router = express.Router();
const db = require("../models/db");
const nodemailer = require("nodemailer");
const { verifyToken, verifyAdmin } = require("../middleware/auth");
const { productRules, productIdParamRule, handleValidation } = require("../middleware/validate");
const { logSecurityEvent, logInfo } = require("../middleware/logger");

// ========== A01: Broken Access Control ==========
// GET productos: público (cualquiera puede ver productos)
router.get("/productos", (req, res) => {
  db.query("SELECT * FROM productos", (err, results) => {
    if (err)
      return res.status(500).json({ error: "Error al obtener productos" });
    res.json(results);
  });
});

// GET producto por ID: público
router.get("/productos/:id_producto", productIdParamRule, handleValidation, (req, res) => {
  db.query(
    "SELECT * FROM productos WHERE id_producto = ?",
    [req.params.id_producto],
    (err, results) => {
      if (err || results.length === 0)
        return res.status(404).json({ error: "Producto no encontrado" });
      res.json(results[0]);
    }
  );
});

// ========== A01 + A05: Solo admin puede crear/editar/eliminar ==========
// Crear producto (requiere auth + admin + validación)
router.post("/productos", verifyToken, verifyAdmin, productRules, handleValidation, (req, res) => {
  const { nombre, precio, imagen, descripcion, categoria, origen, presentacion, cuidado, disponibilidad } = req.body;
  db.query(
    "INSERT INTO productos (nombre_producto, precio, imagen, descripcion, categoria, origen, presentacion, cuidado, disponibilidad) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [nombre, precio, imagen, descripcion, categoria || null, origen || null, presentacion || null, cuidado || null, disponibilidad || null],
    (err, result) => {
      if (err) {
        console.error("Error al crear producto:", err);
        return res.status(500).json({ error: "Error al crear producto" });
      }
      logInfo('Producto creado', { id: result.insertId, nombre, usuario: req.user.id });
      res.json({ id: result.insertId, nombre, precio, imagen, descripcion, categoria, origen, presentacion, cuidado, disponibilidad });
    }
  );
});

// Actualizar producto (requiere auth + admin + validación)
router.put("/productos/:id_producto", verifyToken, verifyAdmin, productIdParamRule, productRules, handleValidation, (req, res) => {
  const { nombre, precio, imagen, descripcion, categoria, origen, presentacion, cuidado, disponibilidad } = req.body;
  db.query(
    "UPDATE productos SET nombre_producto=?, precio=?, imagen=?, descripcion=?, categoria=?, origen=?, presentacion=?, cuidado=?, disponibilidad=? WHERE id_producto=?",
    [nombre, precio, imagen, descripcion, categoria || null, origen || null, presentacion || null, cuidado || null, disponibilidad || null, req.params.id_producto],
    (err) => {
      if (err) {
        console.error("Error al actualizar producto:", err);
        return res.status(500).json({ error: "Error al actualizar producto" });
      }
      logInfo('Producto actualizado', { id: req.params.id_producto, usuario: req.user.id });
      res.json({ id: req.params.id_producto, nombre, precio, imagen, descripcion, categoria, origen, presentacion, cuidado, disponibilidad });
    }
  );
});

// Eliminar producto (requiere auth + admin)
router.delete("/productos/:id_producto", verifyToken, verifyAdmin, productIdParamRule, handleValidation, (req, res) => {
  db.query(
    "DELETE FROM productos WHERE id_producto=?",
    [req.params.id_producto],
    (err) => {
      if (err)
        return res.status(500).json({ error: "Error al eliminar producto" });
      logInfo('Producto eliminado', { id: req.params.id_producto, usuario: req.user.id });
      res.json({ success: true, message: '¡Producto eliminado con éxito!' });
    }
  );
});

const bcrypt = require("bcrypt");

// ========== GESTIÓN DE USUARIOS ==========

// Obtener todos los usuarios (solo admin)
router.get("/usuarios", verifyToken, verifyAdmin, (req, res) => {
  db.query(
    "SELECT id_usuario, nombre, apodo, correo, id_rol, avatar FROM usuarios ORDER BY id_usuario DESC",
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: "Error al obtener usuarios" });
      }
      res.json(results);
    }
  );
});

// Obtener un usuario por ID (solo admin)
router.get("/usuarios/:id_usuario", verifyToken, verifyAdmin, (req, res) => {
  db.query(
    "SELECT id_usuario, nombre, apodo, correo, id_rol, avatar FROM usuarios WHERE id_usuario = ?",
    [req.params.id_usuario],
    (err, results) => {
      if (err || results.length === 0) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      res.json(results[0]);
    }
  );
});

// Actualizar usuario (solo admin)
router.put("/usuarios/:id_usuario", verifyToken, verifyAdmin, async (req, res) => {
  const { nombre, apodo, correo, id_rol, contrasena } = req.body;
  const idUsuario = req.params.id_usuario;

  try {
    if (contrasena && contrasena.trim() !== "") {
      // Si el admin envía una contraseña, la hasheamos con bcrypt
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(contrasena, saltRounds);
      
      db.query(
        "UPDATE usuarios SET nombre=?, apodo=?, correo=?, id_rol=?, contrasena=? WHERE id_usuario=?",
        [nombre, apodo, correo, id_rol === "null" || id_rol === "" ? null : id_rol, hashedPassword, idUsuario],
        (err) => {
          if (err) {
            return res.status(500).json({ error: "Error al actualizar usuario y contraseña" });
          }
          logInfo('Usuario y contraseña actualizados por admin', { id: idUsuario, admin: req.user.id });
          res.json({ id: idUsuario, nombre, apodo, correo, id_rol });
        }
      );
    } else {
      // Si no envía contraseña, conservamos la actual
      db.query(
        "UPDATE usuarios SET nombre=?, apodo=?, correo=?, id_rol=? WHERE id_usuario=?",
        [nombre, apodo, correo, id_rol === "null" || id_rol === "" ? null : id_rol, idUsuario],
        (err) => {
          if (err) {
            return res.status(500).json({ error: "Error al actualizar usuario" });
          }
          logInfo('Usuario actualizado por admin', { id: idUsuario, admin: req.user.id });
          res.json({ id: idUsuario, nombre, apodo, correo, id_rol });
        }
      );
    }
  } catch (error) {
    res.status(500).json({ error: "Error interno del servidor al procesar el usuario" });
  }
});

// Función para enviar correo cuando un administrador elimina una cuenta
async function sendAdminDeletionEmail(name, email) {
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
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #f87171; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <div style="text-align: center; border-bottom: 3px solid #dc2626; padding-bottom: 20px; margin-bottom: 20px;">
            <div style="font-size: 3.5em; margin-bottom: 5px;">⚠️</div>
            <h2 style="color: #991b1b; margin: 0 0 5px 0; font-size: 1.8em; font-weight: 700;">Notificación de Cuenta Eliminada</h2>
            <p style="margin: 0; font-size: 0.95em; color: #dc2626; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">AGRO-CAMPO ADMINISTRACIÓN</p>
          </div>

          <div style="color: #334155; line-height: 1.6; font-size: 1em;">
            <p>Hola <strong>${name}</strong>,</p>
            <p>Te informamos formalmente que tu cuenta registrada en la plataforma de <strong>Agro-Campo</strong> ha sido <strong>eliminada por un administrador</strong> de nuestro sistema.</p>
            
            <div style="background-color: #fef2f2; border: 1px solid #fca5a5; border-radius: 12px; padding: 18px; margin: 20px 0;">
              <h3 style="margin: 0 0 8px 0; color: #991b1b; font-size: 1.1em;">ℹ️ ¿Tienes alguna duda o reclamo?</h3>
              <p style="margin: 0; color: #4b5563;">Si crees que esto se trata de un error o deseas solicitar aclaraciones, por favor ponte en contacto inmediato con nuestro equipo de soporte técnico:</p>
              <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #1f2937;">
                <li style="margin-bottom: 6px;"><strong>Llamada de soporte:</strong> <a href="tel:3008723989" style="color: #2d5c88; text-decoration: none; font-weight: bold;">3008723989</a></li>
                <li style="margin-bottom: 6px;"><strong>Chat de WhatsApp:</strong> <a href="https://wa.me/573008723989" style="color: #16a34a; text-decoration: none; font-weight: bold;">Escríbenos por WhatsApp (3008723989)</a></li>
              </ul>
            </div>

            <p>Agradecemos tu atención a este comunicado.</p>
          </div>

          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; font-size: 0.82em; color: #64748b;">
            <p style="margin: 0 0 5px 0; font-weight: bold; color: #991b1b;">Soporte de Agro-Campo S.A.S</p>
            <p style="margin: 0;">Nit: 1050277880 | El Carmen de Bolívar, Colombia</p>
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: `"Agro-Campo Soporte" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `⚠️ Notificación: Tu cuenta de Agro-Campo ha sido eliminada por un administrador`,
        html: emailHtml
      });
      console.log(`Correo de eliminación por admin enviado con éxito a ${email}`);
    } catch (mailErr) {
      console.error('Error al enviar correo de eliminación por admin:', mailErr.message);
    }
  } else {
    console.log("\n==================================================");
    console.log("⚠️ [CORREO DE ELIMINACIÓN POR ADMIN SIMULADO]");
    console.log("Para:", email);
    console.log("Nombre:", name);
    console.log("Mensaje: Tu cuenta ha sido eliminada por un administrador. Contacta al 3008723989 o WhatsApp.");
    console.log("==================================================\n");
  }
}

// Eliminar usuario (solo admin)
router.delete("/usuarios/:id_usuario", verifyToken, verifyAdmin, (req, res) => {
  const idUsuario = req.params.id_usuario;
  
  // Evitar que el admin se elimine a sí mismo
  if (parseInt(idUsuario) === parseInt(req.user.id)) {
    return res.status(400).json({ error: "No puedes eliminar tu propia cuenta de administrador" });
  }

  // 1. Buscar los datos del usuario antes de eliminar la fila para poder enviarle el correo
  db.query('SELECT nombre, correo FROM usuarios WHERE id_usuario = ?', [idUsuario], (searchErr, results) => {
    if (searchErr || results.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const { nombre, correo } = results[0];

    // 2. Eliminar de la base de datos
    db.query(
      "DELETE FROM usuarios WHERE id_usuario=?",
      [idUsuario],
      (err) => {
        if (err) {
          return res.status(500).json({ error: "Error al eliminar usuario" });
        }
        
        logInfo('Usuario eliminado por admin', { id: idUsuario, admin: req.user.id });
        
        // 3. Enviar correo de notificación del administrador
        sendAdminDeletionEmail(nombre, correo);
        
        res.json({ success: true });
      }
    );
  });
});

// ========== GESTIÓN DE COMPRAS ==========

// Obtener todas las compras globales (solo admin)
router.get("/compras", verifyToken, verifyAdmin, (req, res) => {
  db.query(
    `SELECT c.id_compra, c.fecha, c.total, c.estado, u.nombre AS nombre_usuario, u.correo 
     FROM compras c 
     JOIN usuarios u ON c.id_usuario = u.id_usuario 
     ORDER BY c.fecha DESC`,
    (err, results) => {
      if (err) {
        console.error("Error SQL al obtener todas las compras:", err);
        return res.status(500).json({ error: "Error al obtener historial global de compras" });
      }
      res.json(results);
    }
  );
});

// Eliminar una compra (solo admin)
router.delete("/compras/:id_compra", verifyToken, verifyAdmin, (req, res) => {
  const idCompra = req.params.id_compra;

  // Eliminar detalles primero para evitar violaciones de clave foránea
  db.query(
    "DELETE FROM compra_detalles WHERE id_compra = ?",
    [idCompra],
    (err) => {
      if (err) {
        console.error("Error SQL al eliminar detalles de compra:", err);
        return res.status(500).json({ error: "Error al eliminar detalles de la compra" });
      }

      db.query(
        "DELETE FROM compras WHERE id_compra = ?",
        [idCompra],
        (err2) => {
          if (err2) {
            console.error("Error SQL al eliminar cabecera de compra:", err2);
            return res.status(500).json({ error: "Error al eliminar la compra" });
          }

          logInfo('Compra eliminada por admin', { idCompra, admin: req.user.id });
          res.json({ success: true });
        }
      );
    }
  );
});
// ========== ESTADÍSTICAS DEL SISTEMA ==========
router.get("/estadisticas", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const query = (sql, params = []) => new Promise((resolve, reject) => {
      db.query(sql, params, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    const ventasResult = await query("SELECT SUM(total) as ingresos, COUNT(id_compra) as ventas FROM compras");
    const usuariosResult = await query("SELECT COUNT(id_usuario) as usuarios FROM usuarios");
    const productosResult = await query("SELECT COUNT(id_producto) as productos FROM productos");

    res.json({
      ingresos: ventasResult[0].ingresos || 0,
      ventas: ventasResult[0].ventas || 0,
      usuarios: usuariosResult[0].usuarios || 0,
      productos: productosResult[0].productos || 0
    });
  } catch (err) {
    console.error("Error obteniendo estadísticas:", err);
    res.status(500).json({ error: "Error al obtener estadísticas del programa." });
  }
});

module.exports = router;

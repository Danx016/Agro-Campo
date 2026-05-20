const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { verifyToken, verifyVendedor } = require('../middleware/auth');
const { logInfo } = require('../middleware/logger');
const nodemailer = require('nodemailer');

// Obtener creditos del usuario
router.get('/creditos', verifyToken, (req, res) => {
  db.query('SELECT creditos FROM usuarios WHERE id_usuario = ?', [req.user.id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error interno' });
    res.json({ creditos: results[0] ? results[0].creditos : 0 });
  });
});

// 1. Guardar una nueva compra (Checkout)
router.post('/', verifyToken, async (req, res) => {
  const { idUser, productos, total, metodoPago, direccion } = req.body;

  if (!idUser || !productos || productos.length === 0 || !total) {
    return res.status(400).json({ error: 'Datos de compra incompletos' });
  }

  // ========== A01: IDOR Protection ==========
  if (parseInt(req.user.id) !== parseInt(idUser)) {
    return res.status(403).json({ error: 'No tienes permiso para realizar esta compra a nombre de otro usuario.' });
  }

  // Iniciar transacción de base de datos para asegurar integridad absoluta
  db.beginTransaction((transactionErr) => {
    if (transactionErr) {
      console.error('Error al iniciar transacción:', transactionErr);
      return res.status(500).json({ error: 'Error en el servidor al procesar la compra' });
    }

    // A. Verificar y descontar créditos si se usa Agro-Créditos
    if (metodoPago === 'Agro-Créditos') {
      db.query(`SELECT creditos FROM usuarios WHERE id_usuario = ? FOR UPDATE`, [idUser], (credErr, credRes) => {
        if (credErr || credRes.length === 0) {
          return db.rollback(() => res.status(500).json({ error: 'Error al verificar créditos' }));
        }
        const userCredits = parseFloat(credRes[0].creditos) || 0;
        if (userCredits < parseFloat(total)) {
          return db.rollback(() => res.status(400).json({ error: 'Créditos insuficientes' }));
        }
        db.query(`UPDATE usuarios SET creditos = creditos - ? WHERE id_usuario = ?`, [total, idUser], (deductErr) => {
          if (deductErr) {
            return db.rollback(() => res.status(500).json({ error: 'Error al descontar créditos' }));
          }
          procederConCompra();
        });
      });
    } else {
      procederConCompra();
    }

    function procederConCompra() {
      // B. Insertar cabecera de la compra
      db.query(
        'INSERT INTO compras (id_usuario, total, metodo_pago, direccion_envio) VALUES (?, ?, ?, ?)',
        [idUser, total, metodoPago || 'Tarjeta de Crédito', direccion || 'No especificada'],
      (insertErr, result) => {
        if (insertErr) {
          return db.rollback(() => {
            console.error('Error SQL al registrar compra:', insertErr);
            res.status(500).json({ error: 'Error al registrar la compra en la base de datos' });
          });
        }

        const idCompra = result.insertId;

        // B. Insertar cada línea de detalle de producto en compra_detalles y reducir stock
        const detailPromises = productos.map((item) => {
          return new Promise((resolve, reject) => {
            db.query(
              'INSERT INTO compra_detalles (id_compra, id_producto, cantidad, precio_unitario) VALUES (?, ?, ?, ?)',
              [idCompra, item.idProducto, item.cantidad, item.precio],
              (detailErr) => {
                if (detailErr) {
                  return reject(detailErr);
                }
                
                // Reducir stock con UPDATE atómico directo (más robusto)
                const idProd = parseInt(item.idProducto, 10);
                const cantidadComprada = parseInt(item.cantidad, 10);

                db.query(
                  `UPDATE productos 
                   SET disponibilidad = GREATEST(0, CAST(disponibilidad AS UNSIGNED) - ?)
                   WHERE id_producto = ?
                   AND disponibilidad REGEXP '^[0-9]'`,
                  [cantidadComprada, idProd],
                  (updateErr, updateResult) => {
                    if (updateErr) {
                      console.error(`[STOCK] Error UPDATE atómico para producto ${idProd}:`, updateErr);
                    } else {
                      console.log(`[STOCK] UPDATE atómico producto ${idProd}: -${cantidadComprada} uds. Filas afectadas: ${updateResult.affectedRows}`);
                    }
                    resolve();
                  }
                );
              }
            );
          });
        });

        Promise.all(detailPromises)
          .then(() => {
            // Confirmar transacción si todo se insertó con éxito
            db.commit((commitErr) => {
              if (commitErr) {
                return db.rollback(() => {
                  console.error('Error al confirmar transacción:', commitErr);
                  res.status(500).json({ error: 'Error al consolidar la compra' });
                });
              }

              logInfo('Compra registrada exitosamente', { idUser, idCompra, total });
              res.json({ success: true, idCompra, message: 'Compra registrada con éxito' });
            });
          })
          .catch((detailError) => {
            db.rollback(() => {
              console.error('Error al insertar detalles de la compra:', detailError);
              res.status(500).json({ error: 'Error al guardar los detalles de la compra' });
            });
          });
      }
    );
    } // Fin de procederConCompra
  });
});

// 2. Obtener historial de compras de un usuario
router.get('/usuario/:id_usuario', verifyToken, (req, res) => {
  const idUsuario = req.params.id_usuario;

  db.query(
    'SELECT id_compra, fecha, total, estado FROM compras WHERE id_usuario = ? ORDER BY fecha DESC',
    [idUsuario],
    (err, results) => {
      if (err) {
        console.error('Error SQL al obtener historial:', err);
        return res.status(500).json({ error: 'Error al obtener el historial de compras' });
      }
      res.json(results);
    }
  );
});

// 3. Obtener los detalles completos de un recibo electrónico
router.get('/recibo/:id_compra', verifyToken, (req, res) => {
  const idCompra = req.params.id_compra;

  // A. Obtener cabecera de la compra e información del cliente
  db.query(
    `SELECT c.id_compra, c.fecha, c.total, c.metodo_pago, c.direccion_envio, u.nombre AS nombre_cliente 
     FROM compras c 
     JOIN usuarios u ON c.id_usuario = u.id_usuario 
     WHERE c.id_compra = ?`,
    [idCompra],
    (err, headerResults) => {
      if (err) {
        console.error('Error SQL al obtener cabecera de recibo:', err);
        return res.status(500).json({ error: 'Error al obtener datos del recibo' });
      }

      if (headerResults.length === 0) {
        return res.status(404).json({ error: 'Recibo no encontrado' });
      }

      const recibo = headerResults[0];

      // B. Obtener las líneas de detalle con el nombre del producto
      db.query(
        `SELECT cd.cantidad, cd.precio_unitario, p.nombre_producto, p.presentacion 
         FROM compra_detalles cd 
         JOIN productos p ON cd.id_producto = p.id_producto 
         WHERE cd.id_compra = ?`,
        [idCompra],
        (detailErr, detailResults) => {
          if (detailErr) {
            console.error('Error SQL al obtener detalles de recibo:', detailErr);
            return res.status(500).json({ error: 'Error al obtener los detalles del recibo' });
          }

          recibo.detalles = detailResults;
          res.json(recibo);
        }
      );
    }
  );
});

// 4. Enviar factura electrónica por correo
router.post('/enviar-correo', verifyToken, async (req, res) => {
  const { idCompra, email } = req.body;

  if (!idCompra || !email) {
    return res.status(400).json({ error: 'Faltan datos obligatorios (idCompra o email)' });
  }

  // A. Obtener cabecera de la compra e información del cliente
  db.query(
    `SELECT c.id_compra, c.fecha, c.total, c.metodo_pago, c.direccion_envio, u.nombre AS nombre_cliente 
     FROM compras c 
     JOIN usuarios u ON c.id_usuario = u.id_usuario 
     WHERE c.id_compra = ?`,
    [idCompra],
    (err, headerResults) => {
      if (err || headerResults.length === 0) {
        return res.status(404).json({ error: 'Compra no encontrada para enviar correo' });
      }

      const recibo = headerResults[0];

      // B. Obtener los detalles completos con el nombre del producto y presentación
      db.query(
        `SELECT cd.cantidad, cd.precio_unitario, p.nombre_producto, p.presentacion 
         FROM compra_detalles cd 
         JOIN productos p ON cd.id_producto = p.id_producto 
         WHERE cd.id_compra = ?`,
        [idCompra],
        async (detailErr, detailResults) => {
          if (detailErr) {
            console.error('Error al obtener detalles para email:', detailErr);
            return res.status(500).json({ error: 'Error al compilar detalles del recibo' });
          }

          const totalValue = parseFloat(recibo.total);
          const subtotalValue = totalValue > 50 ? totalValue : totalValue - 2.0;
          const shippingValue = totalValue > 50 ? 0.0 : 2.0;
          const fechaStr = new Date(recibo.fecha).toLocaleDateString();

          // Armar filas de la tabla HTML
          let rowsHtml = '';
          detailResults.forEach(item => {
            const itemSubtotal = parseFloat(item.cantidad * item.precio_unitario).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
            rowsHtml += `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee; color: #334155;">
                  ${item.nombre_producto}
                  ${item.presentacion ? `<br><span style="font-size: 0.8em; color: #64748b;">Presentación: ${item.presentacion}</span>` : ''}
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center; color: #334155;">${item.cantidad}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; color: #334155;">$${parseFloat(item.precio_unitario).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: #0f172a;">$${itemSubtotal}</td>
              </tr>
            `;
          });

          // Armar el cuerpo de correo HTML elegante
          const emailHtml = `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
              <div style="text-align: center; border-bottom: 2px dashed #e2e8f0; padding-bottom: 20px; margin-bottom: 20px;">
                <h2 style="color: #2e7d32; margin: 0 0 5px 0; font-size: 1.8em; letter-spacing: 0.5px;">AGRO-CAMPO S.A.S</h2>
                <p style="margin: 0; font-size: 0.9em; color: #64748b; font-weight: bold;">Nit: 1050277880 | Tel: 3008723989</p>
                <p style="margin: 15px 0 0 0; font-size: 1.1em; font-weight: bold; color: #1e293b; text-transform: uppercase; letter-spacing: 1px;">Factura Electrónica de Venta</p>
              </div>

              <div style="margin-bottom: 20px; font-size: 0.95em; color: #334155; line-height: 1.6;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="vertical-align: top; padding-bottom: 10px;">
                      <strong>Cliente:</strong> ${recibo.nombre_cliente}<br>
                      <strong>Método de Pago:</strong> ${recibo.metodo_pago || 'Tarjeta de Crédito'}<br>
                      <strong>Correo Destino:</strong> ${email}
                    </td>
                    <td style="vertical-align: top; text-align: right; padding-bottom: 10px;">
                      <strong>Orden:</strong> #${recibo.id_compra}<br>
                      <strong>Fecha:</strong> ${fechaStr}<br>
                      <strong>Dirección:</strong> ${recibo.direccion_envio || 'No especificada'}
                    </td>
                  </tr>
                </table>
              </div>

              <div style="margin-bottom: 25px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.95em;">
                  <thead>
                    <tr style="background-color: #f8fafc;">
                      <th style="padding: 12px 10px; border-bottom: 2px solid #cbd5e1; text-align: left; color: #475569;">Producto</th>
                      <th style="padding: 12px 10px; border-bottom: 2px solid #cbd5e1; text-align: center; color: #475569;">Cant</th>
                      <th style="padding: 12px 10px; border-bottom: 2px solid #cbd5e1; text-align: right; color: #475569;">Precio Unit.</th>
                      <th style="padding: 12px 10px; border-bottom: 2px solid #cbd5e1; text-align: right; color: #475569;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rowsHtml}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colspan="3" style="padding: 10px; text-align: right; font-weight: bold; color: #475569;">Subtotal:</td>
                      <td style="padding: 10px; text-align: right; font-weight: bold; color: #1e293b;">$${subtotalValue.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                    </tr>
                    <tr>
                      <td colspan="3" style="padding: 10px; text-align: right; font-weight: bold; color: #475569;">Envío:</td>
                      <td style="padding: 10px; text-align: right; font-weight: bold; color: #1e293b;">${shippingValue === 0 ? 'Gratis' : `$${shippingValue.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}</td>
                    </tr>
                    <tr style="background-color: #f0fdf4;">
                      <td colspan="3" style="padding: 12px 10px; text-align: right; font-weight: bold; color: #166534; font-size: 1.1em; border-top: 2px solid #2e7d32;">Total a Pagar:</td>
                      <td style="padding: 12px 10px; text-align: right; font-weight: bold; color: #166534; font-size: 1.15em; border-top: 2px solid #2e7d32;">$${totalValue.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; font-size: 0.85em; color: #64748b; line-height: 1.4;">
                <p style="margin: 0 0 5px 0; font-weight: bold; color: #2e7d32;">¡Gracias por tu compra en Agro-Campo!</p>
                <p style="margin: 0;">Este correo es una notificación oficial de facturación electrónica. Por favor no responda a este mensaje.</p>
                <p style="margin: 10px 0 0 0; font-size: 0.75em; color: #94a3b8;">© 2026 Agro-Campo S.A.S. Todos los derechos reservados.</p>
              </div>
            </div>
          `;

          // Enviar correo real usando SMTP
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
                from: `"Facturación Electrónica Agro-Campo" <${process.env.SMTP_USER}>`,
                to: email,
                subject: `Factura Electrónica Agro-Campo #${recibo.id_compra}`,
                html: emailHtml
              });

              res.json({ success: true, message: 'Factura enviada correctamente por correo electrónico.' });
            } catch (mailErr) {
              console.error('Error al enviar correo de factura:', mailErr);
              res.status(500).json({ error: 'Error al enviar correo SMTP' });
            }
          } else {
            console.log("\n[FACTURACIÓN ELECTRONICA SIMULADA]");
            console.log("Para:", email);
            console.log("Compra ID:", recibo.id_compra);
            res.json({ success: true, message: 'Simulación: Factura enviada por correo con éxito.' });
          }
        }
      );
    }
  );
});

// 5. Cambiar estado de despacho del pedido (vendedor/admin)
router.put('/:id_compra/estado', verifyToken, verifyVendedor, (req, res) => {
  const { id_compra } = req.params;
  const { estado } = req.body;

  if (!estado) {
    return res.status(400).json({ error: 'Falta especificar el estado de despacho' });
  }

  db.query(
    'UPDATE compras SET estado = ? WHERE id_compra = ?',
    [estado, id_compra],
    (err, result) => {
      if (err) {
        console.error('Error al actualizar estado de despacho:', err);
        return res.status(500).json({ error: 'Error en el servidor al actualizar despacho' });
      }

      // Procesar reembolso de créditos
      if (estado === 'Reembolso procesado') {
        db.query(
          `SELECT id_usuario, total, reembolsado FROM compras WHERE id_compra = ?`,
          [id_compra],
          (refErr, refResults) => {
            if (!refErr && refResults.length > 0) {
              const compraRef = refResults[0];
              if (!compraRef.reembolsado) {
                // Agregar creditos y marcar como reembolsado
                db.query(
                  `UPDATE usuarios SET creditos = creditos + ? WHERE id_usuario = ?`,
                  [compraRef.total, compraRef.id_usuario],
                  (addCredErr) => {
                    if (!addCredErr) {
                      db.query(`UPDATE compras SET reembolsado = TRUE WHERE id_compra = ?`, [id_compra]);
                    }
                  }
                );
              }
            }
          }
        );
      }

      // Enviar una notificación elegante por correo electrónico al cliente para cualquier cambio de estado
      const statusDetails = {
        "Pedido recibido": {
          message: "Tu pedido fue recibido correctamente.",
          icon: "📥",
          color: "#3b82f6",
          bg: "#eff6ff",
          border: "#bfdbfe",
          textColor: "#1e3a8a",
          subject: "📥 ¡Tu pedido ha sido recibido correctamente!"
        },
        "Pago confirmado": {
          message: "Hemos confirmado tu pago.",
          icon: "💳",
          color: "#10b981",
          bg: "#f0fdf4",
          border: "#bbf7d0",
          textColor: "#166534",
          subject: "💳 ¡Pago confirmado de tu pedido!"
        },
        "Pedido en preparación": {
          message: "Tu producto está siendo preparado.",
          icon: "🚜",
          color: "#d97706",
          bg: "#fffbeb",
          border: "#fde68a",
          textColor: "#92400e",
          subject: "🚜 Tu pedido ya está en preparación"
        },
        "Pedido empacado": {
          message: "Tu pedido ya fue empacado y listo para despacho.",
          icon: "📦",
          color: "#4f46e5",
          bg: "#eef2ff",
          border: "#c7d2fe",
          textColor: "#3730a3",
          subject: "📦 ¡Tu pedido está empacado y listo!"
        },
        "Pedido enviado": {
          message: "Tu pedido fue entregado a la transportadora.",
          icon: "🚚",
          color: "#2563eb",
          bg: "#eff6ff",
          border: "#bfdbfe",
          textColor: "#1e40af",
          subject: "🚚 ¡Tu pedido ha sido enviado!"
        },
        "Producto en tránsito": {
          message: "Tu pedido va en camino.",
          icon: "🗺️",
          color: "#0284c7",
          bg: "#f0f9ff",
          border: "#bae6fd",
          textColor: "#075985",
          subject: "🗺️ ¡Tu pedido se encuentra en tránsito!"
        },
        "Producto llegó a centro logístico": {
          message: "Tu paquete llegó al centro de distribución de Barranquilla.",
          icon: "🏢",
          color: "#7c3aed",
          bg: "#f5f3ff",
          border: "#ddd6fe",
          textColor: "#5b21b6",
          subject: "🏢 Tu pedido llegó al centro logístico de Barranquilla"
        },
        "Pedido en ruta de entrega": {
          message: "El repartidor está entregando tu pedido hoy.",
          icon: "🛵",
          color: "#059669",
          bg: "#ecfdf5",
          border: "#a7f3d0",
          textColor: "#065f46",
          subject: "🛵 ¡Tu pedido está en ruta de entrega hoy!"
        },
        "Entrega exitosa": {
          message: "Tu pedido fue entregado exitosamente.",
          icon: "🎉",
          color: "#16a34a",
          bg: "#f0fdf4",
          border: "#bbf7d0",
          textColor: "#166534",
          subject: "🎉 ¡Tu pedido ha sido entregado exitosamente!"
        },
        "Entrega fallida": {
          message: "No fue posible entregar el pedido. Reprogramaremos la entrega.",
          icon: "⚠️",
          color: "#ea580c",
          bg: "#fff7ed",
          border: "#ffedd5",
          textColor: "#9a3412",
          subject: "⚠️ Intento de entrega fallido para tu pedido"
        },
        "Retraso en envío": {
          message: "Tu pedido presenta un retraso por condiciones logísticas.",
          icon: "⏳",
          color: "#ca8a04",
          bg: "#fefce8",
          border: "#fef08a",
          textColor: "#854d0e",
          subject: "⏳ Tu pedido presenta un retraso temporal"
        },
        "Producto cancelado": {
          message: "Tu pedido fue cancelado.",
          icon: "🚫",
          color: "#dc2626",
          bg: "#fef2f2",
          border: "#fecaca",
          textColor: "#991b1b",
          subject: "🚫 Tu pedido ha sido cancelado"
        },
        "Devolución iniciada": {
          message: "Hemos iniciado el proceso de devolución.",
          icon: "🔄",
          color: "#4b5563",
          bg: "#f9fafb",
          border: "#e5e7eb",
          textColor: "#1f2937",
          subject: "🔄 Se ha iniciado el proceso de devolución"
        },
        "Reembolso procesado": {
          message: "Tu reembolso fue realizado correctamente.",
          icon: "💰",
          color: "#0d9488",
          bg: "#f0fdfa",
          border: "#99f6e4",
          textColor: "#115e59",
          subject: "💰 ¡Reembolso procesado correctamente!"
        }
      };

      const details = statusDetails[estado] || {
        message: `Tu pedido #${id_compra} ha sido actualizado al estado: ${estado}.`,
        icon: "📦",
        color: "#10b981",
        bg: "#f0fdf4",
        border: "#bbf7d0",
        textColor: "#166534",
        subject: `📦 Estado de tu pedido #${id_compra} actualizado`
      };

      db.query(
        `SELECT c.id_compra, c.fecha, c.total, c.direccion_envio, u.nombre AS nombre_cliente, u.correo AS correo_cliente 
         FROM compras c 
         JOIN usuarios u ON c.id_usuario = u.id_usuario 
         WHERE c.id_compra = ?`,
        [id_compra],
        (searchErr, searchResults) => {
          if (searchErr || searchResults.length === 0) {
            console.error('Error o compra no encontrada para enviar correo de despacho:', searchErr);
            return;
          }

          const compra = searchResults[0];
          const email = compra.correo_cliente;
          const nombre = compra.nombre_cliente;

          // Obtener los productos de esta compra para listarlos en el correo
          db.query(
            `SELECT cd.cantidad, cd.precio_unitario, p.nombre_producto, p.presentacion 
             FROM compra_detalles cd 
             JOIN productos p ON cd.id_producto = p.id_producto 
             WHERE cd.id_compra = ?`,
            [id_compra],
            async (detailErr, detailResults) => {
              if (detailErr) {
                console.error('Error al compilar productos para correo de despacho:', detailErr);
                return;
              }

              // Generar filas de los productos comprados
              let productRows = '';
              detailResults.forEach(item => {
                productRows += `
                  <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #334155;">
                      ${item.nombre_producto}
                      ${item.presentacion ? `<br><span style="font-size: 0.8em; color: #64748b;">Presentación: ${item.presentacion}</span>` : ''}
                    </td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #334155; font-weight: bold;">${item.cantidad}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #475569;">$${parseFloat(item.precio_unitario).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                  </tr>
                `;
              });

              // Construcción de la plantilla del correo Premium con la temática del estado correspondiente
              const emailHtml = `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                  <!-- Encabezado con Icono dinámico según el Estado -->
                  <div style="text-align: center; border-bottom: 3px solid ${details.color}; padding-bottom: 20px; margin-bottom: 20px;">
                    <div style="font-size: 3.5em; margin-bottom: 8px;">${details.icon}</div>
                    <h2 style="color: #1b4332; margin: 0 0 5px 0; font-size: 1.6em; font-weight: 800;">¡Tu Pedido ha cambiado de Estado!</h2>
                    <p style="margin: 0; font-size: 0.9em; color: ${details.color}; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Nuevo Estado: ${estado}</p>
                  </div>

                  <!-- Mensaje del cuerpo principal -->
                  <div style="margin-bottom: 25px; color: #334155; line-height: 1.6; font-size: 1em;">
                    <p>Hola <strong>${nombre}</strong>,</p>
                    <p>Te informamos que tu pedido <strong>#${id_compra}</strong> ha sido actualizado en nuestra plataforma.</p>
                    
                    <!-- Tarjeta destacada del estado actual -->
                    <div style="background-color: ${details.bg}; border: 1px solid ${details.border}; border-radius: 12px; padding: 18px; margin: 15px 0; box-sizing: border-box;">
                      <span style="font-size: 0.85em; font-weight: 700; color: ${details.color}; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 5px;">
                        Mensaje Logístico
                      </span>
                      <p style="margin: 0; font-size: 1.05em; font-weight: bold; color: ${details.textColor};">${details.message}</p>
                    </div>

                    <p>La dirección de envío asignada a tu entrega es: <strong>${compra.direccion_envio || 'No especificada'}</strong>.</p>
                  </div>

                  <!-- Caja con los datos resumen del Pedido -->
                  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 25px;">
                    <h3 style="margin: 0 0 12px 0; color: #1b4332; font-size: 1.1em; font-weight: 700;">📋 Detalle de tu Pedido</h3>
                    
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.95em; margin-bottom: 12px;">
                      <thead>
                        <tr style="border-bottom: 1px solid #cbd5e1; text-align: left; color: #475569; font-weight: bold;">
                          <th style="padding-bottom: 8px; text-align: left;">Producto</th>
                          <th style="padding-bottom: 8px; text-align: center;">Cantidad</th>
                          <th style="padding-bottom: 8px; text-align: right;">Precio Unit.</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${productRows}
                      </tbody>
                    </table>

                    <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1em; color: #1b4332; border-top: 1px dashed #cbd5e1; padding-top: 10px; margin-top: 5px;">
                      <span>Total Pagado:</span>
                      <span>$${parseFloat(compra.total).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>

                  <!-- Botón de Acción -->
                  <div style="text-align: center; margin-bottom: 25px;">
                    <a href="http://localhost:3000/login" style="display: inline-block; padding: 12px 28px; background-color: #10b981; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 0.95em; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.25); transition: background 0.2s;">
                      Ver Estado en Tiempo Real
                    </a>
                  </div>

                  <!-- Footer del Correo -->
                  <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; font-size: 0.82em; color: #64748b; line-height: 1.4;">
                    <p style="margin: 0 0 5px 0; font-weight: bold; color: #10b981;">¡Gracias por preferir a Agro-Campo S.A.S!</p>
                    <p style="margin: 0;">Nit: 1050277880 | Tel: 3008723989</p>
                    <p style="margin: 10px 0 0 0; font-size: 0.75em; color: #94a3b8;">© 2026 Agro-Campo S.A.S. Del campo a tu mesa.</p>
                  </div>
                </div>
              `;

              // Intento de envío SMTP real
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
                    from: `"Agro-Campo Notificaciones" <${process.env.SMTP_USER}>`,
                    to: email,
                    subject: details.subject,
                    html: emailHtml
                  });
                  console.log(`Email de estado '${estado}' enviado con éxito a ${email}`);
                } catch (mailErr) {
                  console.error(`Error al enviar correo SMTP del estado '${estado}':`, mailErr.message);
                }
              } else {
                console.log("\n==================================================");
                console.log(`🚚 [NOTIFICACIÓN DE ESTADO SIMULADA POR CORREO]`);
                console.log("Para:", email);
                console.log("Cliente:", nombre);
                console.log("Pedido ID:", id_compra);
                console.log("Estado Actualizado:", estado);
                console.log("Mensaje:", details.message);
                console.log("==================================================\n");
              }
            }
          );
        }
      );

      res.json({ success: true, message: `El pedido #${id_compra} ha sido marcado como ${estado} con éxito.` });
    }
  );
});

// 6. Obtener todas las compras de la tienda con detalles para el portal de vendedores/admin
router.get('/todas', verifyToken, verifyVendedor, (req, res) => {
  db.query(
    `SELECT c.id_compra, c.fecha, c.total, c.estado, c.direccion_envio, u.nombre AS nombre_cliente, u.correo AS correo_cliente 
     FROM compras c 
     JOIN usuarios u ON c.id_usuario = u.id_usuario 
     ORDER BY c.fecha DESC`,
    (err, results) => {
      if (err) {
        console.error('Error al obtener compras de vendedores:', err);
        return res.status(500).json({ error: 'Error al recuperar registros de pedidos' });
      }

      // Para cada compra, obtener los detalles de productos correspondientes
      db.query(
        `SELECT cd.id_compra, cd.cantidad, cd.precio_unitario, p.nombre_producto 
         FROM compra_detalles cd 
         JOIN productos p ON cd.id_producto = p.id_producto`,
        (detailErr, details) => {
          if (detailErr) {
            console.error('Error al obtener detalles para vendedores:', detailErr);
            return res.status(500).json({ error: 'Error al recuperar detalles de pedidos' });
          }

          // Agrupar detalles por compra
          const comprasConDetalles = results.map(compra => {
            compra.detalles = details.filter(d => d.id_compra === compra.id_compra);
            return compra;
          });

          res.json(comprasConDetalles);
        }
      );
    }
  );
});

const otps = {}; // Almacenamiento en memoria para OTPs

// 7. Enviar OTP por correo
router.post('/enviar-otp', verifyToken, async (req, res) => {
  const { email, nombre } = req.body;
  if (!email) return res.status(400).json({ error: 'Falta el correo' });

  const code = Math.floor(1000 + Math.random() * 9000).toString(); // Código de 4 dígitos
  otps[email] = {
    code,
    expiresAt: Date.now() + 5 * 60000 // Expira en 5 minutos
  };

  const emailHtml = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; text-align: center; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <div style="font-size: 3em; margin-bottom: 10px;">🛡️</div>
      <h2 style="color: #1e3a8a; font-size: 1.6em; margin-top: 0;">Autenticación de Seguridad Bancaria</h2>
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">Hola <strong>${nombre || 'Usuario'}</strong>, hemos detectado una solicitud de pago en tu cuenta de Agro-Campo.</p>
      <p style="color: #475569; font-size: 16px;">Por tu seguridad, ingresa el siguiente código (OTP) para confirmar tu transacción:</p>
      <div style="font-size: 38px; font-weight: 800; color: #3b82f6; letter-spacing: 8px; margin: 25px 0; padding: 20px; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; display: inline-block;">
        ${code}
      </div>
      <p style="color: #ef4444; font-size: 14px; font-weight: bold;">Este código expirará en 5 minutos. No lo compartas con nadie.</p>
      <div style="border-top: 1px solid #e2e8f0; margin-top: 25px; padding-top: 15px;">
        <p style="color: #94a3b8; font-size: 12px;">Si no solicitaste esta transacción, por favor ignora este correo o contáctanos de inmediato.</p>
      </div>
    </div>
  `;

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
        from: `"Agro-Campo Seguridad" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Código de Verificación OTP: ${code}`,
        html: emailHtml
      });
      res.json({ success: true, message: 'OTP enviado al correo' });
    } catch (err) {
      console.error('Error al enviar OTP SMTP:', err);
      res.status(500).json({ error: 'Error al enviar correo' });
    }
  } else {
    console.log("\n==================================================");
    console.log("🛡️ [SIMULACIÓN OTP] Enviado por Correo");
    console.log("Para:", email);
    console.log("Código de 4 dígitos:", code);
    console.log("==================================================\n");
    res.json({ success: true, message: 'Simulación: OTP enviado' });
  }
});

// 8. Verificar OTP enviado
router.post('/verificar-otp', verifyToken, (req, res) => {
  const { email, code } = req.body;
  const record = otps[email];
  
  if (!record) {
    return res.status(400).json({ error: 'No hay código pendiente para este correo' });
  }
  if (Date.now() > record.expiresAt) {
    delete otps[email];
    return res.status(400).json({ error: 'El código ha expirado. Solicita uno nuevo.' });
  }
  if (record.code !== code) {
    return res.status(400).json({ error: 'Código incorrecto. Verifica el correo.' });
  }
  
  delete otps[email]; // OTP utilizado exitosamente
  res.json({ success: true, message: 'Código verificado con éxito' });
});

module.exports = router;

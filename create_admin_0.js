const db = require('./models/db');
const bcrypt = require('bcrypt');

async function createOrUpdateAdmin0() {
  try {
    // Generar hash de la contraseña
    const passwordHash = await bcrypt.hash('Admin.123', 12);
    
    // Primero, verificar si admin_0 existe
    db.query("SELECT id_usuario FROM usuarios WHERE apodo = 'admin_0'", async (err, results) => {
      if (err) {
        console.error("Error al buscar admin_0:", err);
        process.exit(1);
      }
      
      if (results && results.length > 0) {
        // admin_0 existe, actualizar rol y contraseña
        const idUsuario = results[0].id_usuario;
        db.query(
          "UPDATE usuarios SET contrasena = ?, id_rol = 1 WHERE id_usuario = ?",
          [passwordHash, idUsuario],
          (updateErr) => {
            if (updateErr) {
              console.error("Error al actualizar admin_0:", updateErr);
              process.exit(1);
            }
            console.log("✓ admin_0 ACTUALIZADO: contraseña = Admin.123, rol = administrador (1)");
            process.exit(0);
          }
        );
      } else {
        // admin_0 no existe, crear nuevo usuario como administrador
        db.query(
          "INSERT INTO usuarios (nombre, apodo, correo, contrasena, id_rol, avatar) VALUES (?, ?, ?, ?, ?, ?)",
          ['Administrador Bootstrap', 'admin_0', 'admin_0@agrocampo.local', passwordHash, 1, 'default.png'],
          (insertErr) => {
            if (insertErr) {
              console.error("Error al crear admin_0:", insertErr);
              process.exit(1);
            }
            console.log("✓ admin_0 CREADO: contraseña = Admin.123, rol = administrador (1)");
            process.exit(0);
          }
        );
      }
    });
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

createOrUpdateAdmin0();

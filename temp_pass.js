const db = require('./models/db');
const bcrypt = require('bcrypt');

const action = process.argv[2];

if (action === 'set') {
  db.query("SELECT id_usuario, apodo FROM usuarios WHERE apodo IN ('admin', 'admin_0')", async (err, res) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    if (!res || res.length === 0) {
      console.error("No se encontró un usuario admin o admin_0 en la base de datos.");
      process.exit(1);
    }
    const newHash = await bcrypt.hash('Admin.123', 12);
    const row = res[0];
    const updateSql = row.apodo === 'admin'
      ? "UPDATE usuarios SET apodo = ?, contrasena = ? WHERE id_usuario = ?"
      : "UPDATE usuarios SET contrasena = ? WHERE id_usuario = ?";
    const params = row.apodo === 'admin'
      ? ['admin_0', newHash, row.id_usuario]
      : [newHash, row.id_usuario];
    db.query(updateSql, params, (err2) => {
      if (err2) {
        console.error(err2);
        process.exit(1);
      }
      console.log("ADMIN CREDENCIALES ACTUALIZADAS A admin_0 / Admin.123");
      process.exit(0);
    });
  });
} else if (action === 'restore') {
  const hash = process.argv[3];
  if (!hash) {
    console.error("Provide hash to restore");
    process.exit(1);
  }
  db.query("UPDATE usuarios SET contrasena = ? WHERE apodo = 'admin'", [hash], (err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log("RESTORED");
    process.exit(0);
  });
} else {
  console.log("Usage: node temp_pass.js set|restore [hash]");
  process.exit(1);
}

const db = require('./models/db');
const bcrypt = require('bcrypt');

const action = process.argv[2];

if (action === 'set') {
  db.query("SELECT contrasena FROM usuarios WHERE apodo = 'admin'", async (err, res) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    const currentHash = res[0].contrasena;
    console.log("CURRENT_HASH:", currentHash);
    
    // Hash new password 'Admin123*'
    const newHash = await bcrypt.hash('Admin123*', 12);
    db.query("UPDATE usuarios SET contrasena = ? WHERE apodo = 'admin'", [newHash], (err2) => {
      if (err2) {
        console.error(err2);
        process.exit(1);
      }
      console.log("UPDATED_TO_ADMIN123*");
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

const mysql = require('mysql2');
require('dotenv').config();

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect(err => {
  if (err) {
    console.error('Error al conectar a MySQL:', err);
  } else {
    console.log('Conectado a MySQL');
    // Asegurar que la columna 'avatar' existe y es de tipo MEDIUMTEXT en la tabla de usuarios (para soportar Base64 de subidas locales)
    db.query("ALTER TABLE usuarios ADD COLUMN avatar MEDIUMTEXT", (alterErr) => {
      db.query("ALTER TABLE usuarios MODIFY COLUMN avatar MEDIUMTEXT", (modifyErr) => {
        if (modifyErr) {
          console.error('Error al configurar la columna avatar como MEDIUMTEXT:', modifyErr);
          } else {
            console.log('Columna avatar asegurada como MEDIUMTEXT en la base de datos.');
          }
        });
      });

      // Asegurar columna 'descripcion' en la tabla de productos para los detalles ricos
      db.query("ALTER TABLE productos ADD COLUMN descripcion TEXT DEFAULT NULL", (err) => {
        if (err && err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') {
          console.error('Error al asegurar la columna descripcion en la tabla productos:', err);
        }
      });

      // Asegurar columna 'categoria' para asignar cada producto a una seccion
      db.query("ALTER TABLE productos ADD COLUMN categoria VARCHAR(50) DEFAULT NULL", (err) => {
        if (err && err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') {
          console.error('Error al asegurar la columna categoria en la tabla productos:', err);
        } else {
          console.log('Columna categoria asegurada en la tabla productos.');
        }
      });

      // Asegurar columnas de detalles personalizados en la tabla productos
      db.query("ALTER TABLE productos ADD COLUMN origen VARCHAR(100) DEFAULT NULL", (err) => { if(err && err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') console.error('Error origen:', err); });
      db.query("ALTER TABLE productos ADD COLUMN presentacion VARCHAR(100) DEFAULT NULL", (err) => { if(err && err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') console.error('Error presentacion:', err); });
      db.query("ALTER TABLE productos ADD COLUMN cuidado VARCHAR(255) DEFAULT NULL", (err) => { if(err && err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') console.error('Error cuidado:', err); });
      db.query("ALTER TABLE productos ADD COLUMN disponibilidad VARCHAR(100) DEFAULT NULL", (err) => { if(err && err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') console.error('Error disponibilidad:', err); });

      // Asegurar que el precio de los productos sea decimal
      db.query("ALTER TABLE productos MODIFY COLUMN precio DECIMAL(10,2) NOT NULL", (err) => { 
        if(err) console.error('Error al modificar precio a DECIMAL:', err); 
        else console.log('Columna precio asegurada como DECIMAL(10,2).');
      });

    // Asegurar columnas para la recuperación de contraseña por código de correo
    db.query("ALTER TABLE usuarios ADD COLUMN reset_code VARCHAR(6) DEFAULT NULL", (err) => {
      if (err && err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') {
        console.error('Error al verificar/crear la columna reset_code:', err);
      }
    });
    db.query("ALTER TABLE usuarios ADD COLUMN reset_expires DATETIME DEFAULT NULL", (err) => {
      if (err && err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') {
        console.error('Error al verificar/crear la columna reset_expires:', err);
      } else {
        console.log('Columnas de recuperación de contraseña aseguradas en la base de datos.');
      }
    });

    // Asegurar columna para creditos de reembolso
    db.query("ALTER TABLE usuarios ADD COLUMN creditos DECIMAL(10,2) DEFAULT 0.00", (err) => {
      if (err && err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') {
        console.error('Error al asegurar la columna creditos en la tabla usuarios:', err);
      } else {
        console.log('Columna creditos asegurada en la tabla usuarios.');
      }
    });

    // Asegurar tabla 'compras' si no existe
    const createComprasTable = `
      CREATE TABLE IF NOT EXISTS compras (
        id_compra INT AUTO_INCREMENT PRIMARY KEY,
        id_usuario INT NOT NULL,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        total DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `;
    db.query(createComprasTable, (err) => {
      if (err) {
        console.error('Error al crear tabla compras:', err);
      } else {
        console.log('Tabla compras asegurada en la base de datos.');
        // Asegurar columna 'estado' en la tabla de compras para rastrear el despacho
        db.query("ALTER TABLE compras ADD COLUMN estado VARCHAR(50) DEFAULT 'Pedido recibido'", (err) => {
          if (err && err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') {
            console.error('Error al asegurar la columna estado en la tabla de compras:', err);
          } else {
            // Asegurar que si la columna ya existía, se amplíe a VARCHAR(50) para los nuevos estados largos
            db.query("ALTER TABLE compras MODIFY COLUMN estado VARCHAR(50) DEFAULT 'Pedido recibido'", () => {
              console.log('Columna estado para despacho asegurada en la tabla compras.');
              
              // Asegurar columna 'metodo_pago' en la tabla de compras para guardar el método de pago
              db.query("ALTER TABLE compras ADD COLUMN metodo_pago VARCHAR(50) DEFAULT 'Tarjeta de Crédito'", (err) => {
                if (err && err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') {
                  console.error('Error al asegurar la columna metodo_pago en la tabla de compras:', err);
                } else {
                  console.log('Columna metodo_pago para compras asegurada en la tabla compras.');
                }
              });

              // Asegurar columna 'reembolsado' para evitar reembolsos dobles
              db.query("ALTER TABLE compras ADD COLUMN reembolsado BOOLEAN DEFAULT FALSE", (err) => {
                if (err && err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') {
                  console.error('Error al asegurar la columna reembolsado en la tabla de compras:', err);
                }
              });
            });
          }
        });
      }
    });

    // Asegurar tabla 'compra_detalles' si no existe
    const createDetallesTable = `
      CREATE TABLE IF NOT EXISTS compra_detalles (
        id_detalle INT AUTO_INCREMENT PRIMARY KEY,
        id_compra INT NOT NULL,
        id_producto INT NOT NULL,
        cantidad INT NOT NULL,
        precio_unitario DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (id_compra) REFERENCES compras(id_compra) ON DELETE CASCADE,
        FOREIGN KEY (id_producto) REFERENCES productos(id_producto) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `;
    db.query(createDetallesTable, (err) => {
      if (err) {
        console.error('Error al crear tabla compra_detalles:', err);
      } else {
        console.log('Tabla compra_detalles asegurada en la base de datos.');
      }
    });
  }
});

module.exports = db;

// Este controlador no se usa actualmente.
// La lógica de registro está directamente en routes/register.js
// Se mantiene como referencia.

const db = require('../models/db');
const bcrypt = require('bcrypt');

exports.registerUser = async (req, res) => {
  const { name, email, apodo, password, confirmPassword, terms } = req.body;

  if (!terms) return res.status(400).json({ message: 'Debes aceptar los términos.' });
  if (password !== confirmPassword) return res.status(400).json({ message: 'Las contraseñas no coinciden.' });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = 'INSERT INTO usuarios (nombre, apodo, correo, contrasena) VALUES (?, ?, ?, ?)';
    db.query(sql, [name, apodo, email, hashedPassword], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ message: 'El correo o nombre de usuario ya está registrado.' });
        }
        console.error('Error al registrar usuario:', err);
        return res.status(500).json({ message: 'Error en el servidor' });
      }
      res.status(200).json({ message: 'Usuario registrado exitosamente' });
    });
  } catch (error) {
    console.error('Error al hashear contraseña:', error);
    return res.status(500).json({ message: 'Error en el servidor' });
  }
};

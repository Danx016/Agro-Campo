const { body, param, validationResult } = require('express-validator');

// Middleware para manejar resultados de validación
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Datos inválidos',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
}

// Reglas de validación para registro
const registerRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('El nombre es obligatorio')
    .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/).withMessage('El nombre solo puede contener letras y espacios')
    .escape(),
  body('apodo')
    .trim()
    .notEmpty().withMessage('El nombre de usuario es obligatorio')
    .isLength({ min: 3, max: 30 }).withMessage('El usuario debe tener entre 3 y 30 caracteres')
    .matches(/^[a-zA-Z0-9_.-]+$/).withMessage('El nombre de usuario solo puede contener letras, números, puntos o guiones bajos')
    .custom((value) => {
      if (!/[0-9_.-]/.test(value)) {
        throw new Error('El usuario debe incluir al menos un número, guión bajo (_) o punto.');
      }
      return true;
    })
    .escape(),
  body('email')
    .trim()
    .notEmpty().withMessage('El correo es obligatorio')
    .isEmail().withMessage('Correo electrónico inválido')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('La contraseña es obligatoria')
    .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#._-])[A-Za-z\d@$!%*?&#._-]+$/)
    .withMessage('La contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial.'),
  body('confirmPassword')
    .notEmpty().withMessage('Confirmar contraseña es obligatorio'),
  body('terms')
    .custom((value) => {
      if (value !== true && value !== 'true') {
        throw new Error('Debes aceptar los términos y condiciones');
      }
      return true;
    })
];

// Reglas de validación para login
const loginRules = [
  body('username')
    .trim()
    .notEmpty().withMessage('El usuario es obligatorio')
    .isLength({ max: 30 }).withMessage('Usuario demasiado largo')
    .escape(),
  body('password')
    .notEmpty().withMessage('La contraseña es obligatoria')
    .isLength({ max: 128 }).withMessage('Contraseña demasiado larga')
];

// Reglas de validación para productos
const productRules = [
  body('nombre')
    .trim()
    .notEmpty().withMessage('El nombre del producto es obligatorio')
    .isLength({ min: 2, max: 200 }).withMessage('Nombre debe tener entre 2 y 200 caracteres')
    .escape(),
  body('precio')
    .notEmpty().withMessage('El precio es obligatorio')
    .isFloat({ min: 0 }).withMessage('El precio debe ser un número positivo'),
  body('imagen')
    .trim()
    .notEmpty().withMessage('La imagen es obligatoria')
    .isLength({ max: 1000 }).withMessage('URL de imagen demasiado larga'),
  body('descripcion')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 5000 }).withMessage('La descripción es demasiado larga')
    .escape() // Sanitize to prevent Stored XSS
];

// Reglas para actualizar perfil
const profileUpdateRules = [
  body('nombre')
    .trim()
    .notEmpty().withMessage('El nombre es obligatorio')
    .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres')
    .escape(),
  body('email')
    .trim()
    .notEmpty().withMessage('El correo es obligatorio')
    .isEmail().withMessage('Correo electrónico inválido')
    .normalizeEmail(),
  body('username')
    .trim()
    .notEmpty().withMessage('El usuario es obligatorio')
    .isLength({ min: 3, max: 30 }).withMessage('El usuario debe tener entre 3 y 30 caracteres')
    .escape(),
  body('password')
    .optional({ checkFalsy: true })
    .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#._-])[A-Za-z\d@$!%*?&#._-]+$/)
    .withMessage('La contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial.'),
  body('avatar')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 5000000 }).withMessage('La foto de perfil es demasiado grande')
];

// Validar que el ID sea un número entero
const idParamRule = [
  param('id').isInt({ min: 1 }).withMessage('ID inválido')
];

const productIdParamRule = [
  param('id_producto').isInt({ min: 1 }).withMessage('ID de producto inválido')
];

module.exports = {
  handleValidation,
  registerRules,
  loginRules,
  productRules,
  profileUpdateRules,
  idParamRule,
  productIdParamRule
};

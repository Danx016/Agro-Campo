# 🌾 Agro-Campo: Documentación y Diagramas del Sistema

Este documento contiene la especificación visual y técnica de la arquitectura de la plataforma **Agro-Campo Logística y E-Commerce**. Los diagramas han sido diseñados utilizando **Mermaid**, permitiendo una renderización directa en GitHub, VS Code u otros entornos compatibles con Markdown.

---

## 📌 Tabla de Contenidos
1. [Diagrama de Contexto](#1-diagrama-de-contexto-nivel-1-c4)
2. [Diagrama de Componentes](#2-diagrama-de-componentes-nivel-3-c4)
3. [Diagrama de Casos de Uso](#3-diagrama-de-casos-de-uso)
4. [Diagrama de Arquitectura en Capas (N-Tier)](#4-diagrama-de-arquitectura-en-capas-n-tier)
5. [Diagrama de Flujo de Negocio (Compra, OTP y Despacho)](#5-diagrama-de-flujo-de-negocio-compra-otp-y-despacho)
6. [Diagrama de Clases UML (Modelo de Datos)](#6-diagrama-de-clases-uml-modelo-de-datos)
7. [Diagrama Entidad-Relación (Base de Datos / ERD)](#7-diagrama-entidad-relación-base-de-datos--erd)



---

## 1. Diagrama de Contexto (Nivel 1 C4)

El **Diagrama de Contexto** muestra los límites del sistema **Agro-Campo**, detallando los actores externos y los servicios de terceros con los que interactúa la plataforma a alto nivel.

```mermaid
graph TB
    %% Definición del Estilo General de Nodos
    classDef actorStyle fill:#E2F0D9,stroke:#385723,stroke-width:2px,color:#000000;
    classDef systemStyle fill:#D9E1F2,stroke:#305496,stroke-width:2px,color:#000000,stroke-dasharray: 0;
    classDef externalStyle fill:#FCE4D6,stroke:#C65911,stroke-width:2px,color:#000000;

    %% Actores
    Cliente["👤 Cliente (Agricultor/Consumidor)<br>Realiza compras, gestiona direcciones,<br>revisa trazabilidad e ingresa OTPs."]:::actorStyle
    Despachador["🚚 Despachador (Vendedor)<br>Administra logística de despachos,<br>monitorea KPIs y actualiza estados."]:::actorStyle
    Admin["👑 Administrador<br>Gestiona inventario, crea personal,<br>y configura parámetros globales."]:::actorStyle

    %% Sistema Central
    Sistema["🌾 Plataforma Agro-Campo<br>(Aplicación Web Express.js + SSR EJS)<br>Procesa compras, controla inventario,<br>trazabilidad y lógica de negocios."]:::systemStyle

    %% Sistemas Externos
    SMTP["✉️ Servicio SMTP (Nodemailer)<br>Envía correos con códigos OTP<br>y notificaciones de despacho."]:::externalStyle
    MySQL["🗄️ Base de Datos MySQL<br>Persistencia relacional de usuarios,<br>productos, compras y transacciones."]:::externalStyle

    %% Relaciones / Flujos
    Cliente -->|1. Navega catálogo, compra y paga| Sistema
    Cliente -->|2. Recibe correos OTP y facturas| SMTP
    Despachador -->|3. Actualiza estados de envío y KPIs| Sistema
    Admin -->|4. Realiza CRUD y crea cuentas de personal| Sistema
    
    Sistema <-->|5. Almacena y consulta datos de negocio| MySQL
    Sistema -->|6. Envía peticiones de correo de notificación| SMTP
    SMTP -->|7. Entrega correos a| Cliente
    SMTP -->|8. Entrega avisos logísticos a| Despachador

    %% Leyenda
    subgraph Leyenda
        L1[Actor del Sistema]:::actorStyle
        L2[Sistema Central]:::systemStyle
        L3[Servicio Externo]:::externalStyle
    end
```

### 📝 Resumen del Contexto:
* **Entrada**: Los usuarios ingresan a través del navegador web usando el frontend interactivo generado por Server-Side Rendering (EJS).
* **Procesamiento**: La aplicación web Node.js/Express valida la seguridad (JWT, CSRF, Rate Limiting) y ejecuta la lógica de compra y logística.
* **Almacenamiento**: Toda la información crítica transaccional y perfiles se guardan en la base de datos relacional MySQL.
* **Integración**: Nodemailer sirve como pasarela de mensajería saliente de forma asíncrona para control de seguridad (OTP) y alertas logísticas.

---

## 2. Diagrama de Componentes (Nivel 3 C4)

Este diagrama detalla cómo está estructurado el backend de **Agro-Campo**, mostrando las rutas, middlewares de seguridad, controladores de negocio y su relación con la base de datos.

```mermaid
graph TD
    classDef clientStyle fill:#E2F0D9,stroke:#385723,stroke-width:2px,color:#000000;
    classDef mwStyle fill:#FFF2CC,stroke:#D6B656,stroke-width:2px,color:#000000;
    classDef routeStyle fill:#D9E1F2,stroke:#305496,stroke-width:2px,color:#000000;
    classDef ctrlStyle fill:#E1D5E7,stroke:#967ADC,stroke-width:2px,color:#000000;
    classDef dbStyle fill:#F8CECC,stroke:#B85450,stroke-width:2px,color:#000000;

    %% Capa Cliente
    subgraph Frontend [Capa Cliente / Navegador]
        EJS["💻 Vistas EJS (SSR)<br>(index, vendedor, admin,<br>perfil, carrito, checkout)"]:::clientStyle
        LS["💾 LocalStorage<br>(Carrito Persistente)"]:::clientStyle
        SW["🔔 SweetAlert2<br>(Alertas Interactivas)"]:::clientStyle
    end

    %% Capa Middleware de Seguridad
    subgraph Middlewares [Middlewares de Seguridad & Filtros]
        Helmet["🛡️ Helmet Headers<br>(Previene XSS, Clickjacking)"]:::mwStyle
        Limiter["⏳ Rate Limiter<br>(Bloqueo por Fuerza Bruta)"]:::mwStyle
        CSRF["🔑 CSRF Protection<br>(Evita falsificación de peticiones)"]:::mwStyle
        AuthMW["👤 Auth Middleware<br>(verifyToken / verifyVendedor)"]:::mwStyle
    end

    %% Capa de Rutas Express
    subgraph Rutas [Enrutadores Express]
        R_Reg["/register"]:::routeStyle
        R_Log["/login"]:::routeStyle
        R_Admin["/api/admin"]:::routeStyle
        R_User["/api/user"]:::routeStyle
        R_Recover["/api/recover"]:::routeStyle
        R_Compra["/api/compra"]:::routeStyle
    end

    %% Capa de Controladores & Servicios
    subgraph Negocio [Lógica de Negocio y Controladores]
        C_Reg["registerController.js"]:::ctrlStyle
        C_Mail["Servicio SMTP Nodemailer"]:::ctrlStyle
        C_OTP["Gestor OTP (En memoria)"]:::ctrlStyle
    end

    %% Capa de Datos
    subgraph Datos [Persistencia y Acceso a Datos]
        DB_JS["🔌 db.js<br>(MySQL Connection Pool)"]:::dbStyle
        MySQL_DB[("🗄️ MySQL Database<br>(usuarios, productos,<br>compras, compra_detalles)")]:::dbStyle
    end

    %% Interacciones
    EJS -->|Peticiones HTTP/Fetch| Helmet
    Helmet --> Limiter
    Limiter --> CSRF
    CSRF --> AuthMW
    
    AuthMW -->|Ruta de Registro| R_Reg
    AuthMW -->|Ruta de Login| R_Log
    AuthMW -->|Ruta de Inventario| R_Admin
    AuthMW -->|Ruta de Perfil| R_User
    AuthMW -->|Ruta de Recuperación| R_Recover
    AuthMW -->|Ruta de Compras/OTP| R_Compra

    R_Reg --> C_Reg
    R_Recover --> C_OTP
    R_Compra --> C_OTP
    C_OTP --> C_Mail

    C_Reg --> DB_JS
    R_Log --> DB_JS
    R_Admin --> DB_JS
    R_User --> DB_JS
    R_Compra --> DB_JS
    
    DB_JS <--> MySQL_DB
```

---

## 3. Diagrama de Casos de Uso

El **Diagrama de Casos de Uso** ilustra los requerimientos del sistema agrupados por rol de usuario (Cliente, Despachador y Administrador), mostrando la herencia básica de sesión y las relaciones.

```mermaid
graph LR
    classDef actorStyle fill:#E2F0D9,stroke:#385723,stroke-width:2px,color:#000000;
    classDef ucStyle fill:#D9E1F2,stroke:#305496,stroke-width:1.5px,color:#000000;

    %% Actores
    User["👤 Usuario General<br>(Sesión Iniciada)"]:::actorStyle
    Cliente["🌾 Cliente"]:::actorStyle
    Despachador["🚚 Despachador (Vendedor)"]:::actorStyle
    Admin["👑 Administrador"]:::actorStyle

    %% Herencia de Actores
    Cliente --> User
    Despachador --> User
    Admin --> User

    %% Casos de Uso Compartidos
    subgraph UC_Shared [Casos de Uso Comunes]
        UC_Login(("Iniciar Sesión<br>& Auth JWT")):::ucStyle
        UC_OTP_Pass(("Recuperar Clave<br>(Vía Email OTP)")):::ucStyle
        UC_Profile(("Gestionar Perfil<br>(Foto avatar, datos)")):::ucStyle
    end

    %% Casos de Uso del Cliente
    subgraph UC_Client [Portal del Cliente]
        UC_Browse(("Buscar Productos<br>& Categorías")):::ucStyle
        UC_Cart(("Gestionar Carrito<br>(LocalStorage)")):::ucStyle
        UC_Checkout(("Realizar Compra<br>(Agro-Créditos o Card)")):::ucStyle
        UC_OTP_Pay(("Confirmar Pago<br>(Banca OTP 4-Dígitos)")):::ucStyle
        UC_History(("Ver Historial<br>& Trazabilidad")):::ucStyle
    end

    %% Casos de Uso del Despachador
    subgraph UC_Dispatcher [Consola del Despachador]
        UC_Dash(("Ver Dashboard<br>de Logística")):::ucStyle
        UC_Status(("Actualizar Despacho<br>(14 Estados Logísticos)")):::ucStyle
        UC_KPI(("Consultar KPIs<br>de Rendimiento")):::ucStyle
    end

    %% Casos de Uso del Administrador
    subgraph UC_Admin [Consola del Administrador]
        UC_CRUD(("CRUD Inventario<br>(Productos Agrícolas)")):::ucStyle
        UC_AddStaff(("Crear Cuenta<br>de Personal")):::ucStyle
    end

    %% Conexión de Actores a Casos de Uso
    User --> UC_Login
    User --> UC_OTP_Pass
    User --> UC_Profile

    Cliente --> UC_Browse
    Cliente --> UC_Cart
    Cliente --> UC_Checkout
    Cliente --> UC_History
    UC_Checkout -.->|includes| UC_OTP_Pay

    Despachador --> UC_Dash
    Despachador --> UC_Status
    Despachador --> UC_KPI

    Admin --> UC_CRUD
    Admin --> UC_AddStaff
```

---

## 4. Diagrama de Arquitectura en Capas (N-Tier)

La plataforma utiliza una arquitectura **N-Tier (Multicapa)** para garantizar la separación de conceptos, la seguridad de la lógica y la fácil escalabilidad del proyecto.

```mermaid
graph TD
    classDef cap1 fill:#E2F0D9,stroke:#385723,stroke-width:2px;
    classDef cap2 fill:#FFF2CC,stroke:#D6B656,stroke-width:2px;
    classDef cap3 fill:#D9E1F2,stroke:#305496,stroke-width:2px;
    classDef cap4 fill:#E1D5E7,stroke:#967ADC,stroke-width:2px;
    classDef cap5 fill:#F8CECC,stroke:#B85450,stroke-width:2px;
    classDef cap6 fill:#D5E8D4,stroke:#82B366,stroke-width:2px;

    subgraph Capa_1 [1. Capa de Presentación (Frontend / Cliente)]
        EJS_V["Vistas SSR (EJS Template Engine)"]:::cap1
        Client_JS["Interacciones AJAX / Fetch API (Vanilla JS)"]:::cap1
        Styling["CSS3 Flexible & SweetAlert2 (Mensajería Visual)"]:::cap1
    end

    subgraph Capa_2 [2. Capa de Filtros y Seguridad (Middlewares)]
        Headers["Helmet HTTP Headers & CORS Control"]:::cap2
        RateLimit["Rate Limiters (Login limit & Global limit)"]:::cap2
        CSRF_P["CSRF Token Middleware Protection"]:::cap2
        Auth_P["JWT Cookie Auth Validation (HttpOnly Cookies)"]:::cap2
    end

    subgraph Capa_3 [3. Capa de Enrutamiento (Rutas API)]
        R_Express["Express Routers (/api/compra, /api/user, /login, etc.)"]:::cap3
        Body_Limiter["Limitadores de Carga del Body (Body-parser 1MB max)"]:::cap3
    end

    subgraph Capa_4 [4. Capa de Lógica de Negocio (Servicios)]
        Transact["Gestor de Transacciones SQL (Garantía de stock y créditos)"]:::cap4
        OTP_Service["Servicio de Generación de Claves de un Solo Uso (OTP)"]:::cap4
        Mail_Service["Módulo de Envío de Correos Automatizados (Nodemailer)"]:::cap4
    end

    subgraph Capa_5 [5. Capa de Acceso a Datos (Persistencia / DAL)]
        Pool["MySQL2 Connection Pool Manager"]:::cap5
        SQL_Ops["Operaciones SQL Atómicas (GREATEST stock checks)"]:::cap5
    end

    subgraph Capa_6 [6. Capa de Almacenamiento (Base de Datos / Data)]
        MySQL_Engine["MySQL Database Server (Relacional)"]:::cap6
    end

    %% Relaciones entre capas (flujo descendente estricto)
    Capa_1 --> Capa_2
    Capa_2 --> Capa_3
    Capa_3 --> Capa_4
    Capa_4 --> Capa_5
    Capa_5 --> Capa_6
```

---

## 5. Diagrama de Flujo de Negocio (Compra, OTP y Despacho)

Este diagrama de flujo describe el ciclo de vida completo de una compra dentro de **Agro-Campo**, desde que el cliente inicia la transacción, pasando por la validación de seguridad bancaria por **OTP**, la persistencia atómica en la base de datos, hasta el despacho y la trazabilidad del paquete a cargo del **Despachador**.

```mermaid
flowchart TD
    classDef startEnd fill:#F8CECC,stroke:#B85450,stroke-width:2px,color:#000000;
    classDef step fill:#D9E1F2,stroke:#305496,stroke-width:2px,color:#000000;
    classDef condition fill:#FFF2CC,stroke:#D6B656,stroke-width:2px,color:#000000;
    classDef notify fill:#E1D5E7,stroke:#967ADC,stroke-width:2px,color:#000000;

    %% Definición del flujo
    Inicio([🟢 Cliente inicia Checkout en /envio]):::startEnd
    IngresaDatos[Ingresa dirección de despacho y método de pago]:::step
    MetodoPago{¿Método de Pago<br>es Agro-Créditos?}:::condition
    
    %% Flujo OTP
    SolicitaOTP[Envía petición POST /api/compra/enviar-otp]:::step
    EnviaMailOTP[Sistema genera OTP de 4 dígitos y envía correo al Cliente]:::notify
    EsperaCodigo[Cliente recibe e ingresa el código OTP en la interfaz]:::step
    ValidaOTP{¿Código OTP<br>es válido y no expiró?}:::condition
    ErrorOTP[Muestra error en pantalla y cancela flujo]:::step
    FinError([🔴 Compra Cancelada]):::startEnd

    %% Registro de Compra Transaccional
    CrearCompra[POST /api/compra con lista de productos y totales]:::step
    ValidarIDOR{¿ID del JWT coincide<br>con idUser del body?}:::condition
    ErrorIDOR[Bloquea petición: 403 Forbidden]:::step
    
    IniciarTransaccion[Inicia Transacción en MySQL]:::step
    SuficientesCreditos{¿Tiene créditos<br>suficientes?}:::condition
    DescontarCreditos[Descuenta créditos de la cuenta del Cliente]:::step
    RollbackTrans[Ejecuta ROLLBACK y cancela transacción]:::step
    ErrorSaldo[Muestra mensaje de error: Saldo Insuficiente]:::step

    InsCabecera[Inserta cabecera en tabla 'compras' con estado: 'Pedido en preparación']:::step
    InsDetalles[Inserta líneas en 'compra_detalles' y reduce stock de productos en MySQL]:::step
    CommitTrans[Ejecuta COMMIT de la transacción]:::step
    EnviaFactura[Genera Factura Electrónica y envía correo automático via SMTP]:::notify

    %% Flujo del Despachador
    DashVendedor[Pedido aparece en el Dashboard del Despachador /vendedor]:::step
    AsignarEstado[Despachador actualiza el estado de tracking en ruta]:::step
    ActualizarDB[Ejecuta UPDATE compras SET estado = nuevoEstado]:::step
    NotificarCliente[Sistema envía email con plantilla de diseño adaptada al nuevo estado]:::notify
    
    Entregado{¿El nuevo estado<br>es 'Entrega exitosa'?<br>o 'Cancelado'}:::condition
    FinFlujo([🟢 Compra y Despacho Completado]):::startEnd
    Reembolsar{¿Estado es<br>'Reembolso procesado'?}:::condition
    ProcesarDevolucion[Retorna créditos a la cuenta del usuario en MySQL]:::step

    %% Conexiones
    Inicio --> IngresaDatos
    IngresaDatos --> MetodoPago
    
    MetodoPago -- Sí --> SolicitaOTP
    SolicitaOTP --> EnviaMailOTP
    EnviaMailOTP --> EsperaCodigo
    EsperaCodigo --> ValidaOTP
    
    ValidaOTP -- No --> ErrorOTP
    ErrorOTP --> FinError
    
    ValidaOTP -- Sí --> CrearCompra
    MetodoPago -- No (Tarjeta) --> CrearCompra
    
    CrearCompra --> ValidarIDOR
    ValidarIDOR -- No --> ErrorIDOR
    ErrorIDOR --> FinError
    
    ValidarIDOR -- Sí --> IniciarTransaccion
    IniciarTransaccion --> SuficientesCreditos
    
    SuficientesCreditos -- No --> RollbackTrans
    RollbackTrans --> ErrorSaldo
    ErrorSaldo --> FinError
    
    SuficientesCreditos -- Sí --> DescontarCreditos
    DescontarCreditos --> InsCabecera
    
    InsCabecera --> InsDetalles
    InsDetalles --> CommitTrans
    CommitTrans --> EnviaFactura
    
    EnviaFactura --> DashVendedor
    DashVendedor --> AsignarEstado
    AsignarEstado --> ActualizarDB
    ActualizarDB --> NotificarCliente
    NotificarCliente --> Entregado
    
    Entregado -- No --> Reembolsar
    Reembolsar -- Sí --> ProcesarDevolucion
    ProcesarDevolucion --> AsignarEstado
    Reembolsar -- No --> AsignarEstado
    
    Entregado -- Sí --> FinFlujo
```

---

### 🛡️ Medidas de Seguridad Incorporadas en el Flujo:
1. **Protección IDOR (A01)**: El middleware del backend valida estrictamente que el identificador del usuario que realiza la compra coincida con el token de sesión (`req.user.id`).
2. **Integridad Transaccional**: La inserción de la cabecera y el detalle de la compra, así como el descuento de créditos y la reducción de stock, se realizan dentro de una **transacción atómica** (COMMIT/ROLLBACK) para evitar inconsistencias de datos en la base de datos si ocurre un error a mitad de camino.
3. **Mecanismo de Descuento Seguro**: La reducción de stock se calcula de forma segura en la base de datos relacional para evitar errores de condición de carrera.

---

## 6. Diagrama de Clases UML (Modelo de Datos)

Este **Diagrama de Clases UML** representa el modelo de datos relacional y las entidades del dominio de **Agro-Campo**, detallando sus atributos primarios, tipos de datos, métodos conceptuales y las relaciones de cardinalidad que estructuran el sistema.

```mermaid
classDiagram
    class Usuario {
        +int id_usuario
        +string nombre
        +string email
        +string password
        +string rol
        +string avatar
        +string reset_code
        +datetime reset_expires
        +decimal creditos
        +registrar()
        +iniciarSesion()
        +recuperarClave()
    }

    class Producto {
        +int id_producto
        +string nombre
        +text descripcion
        +string categoria
        +string origen
        +string presentacion
        +string cuidado
        +string disponibilidad
        +decimal precio
        +int stock
        +crear()
        +actualizar()
        +eliminar()
    }

    class Compra {
        +int id_compra
        +int id_usuario
        +datetime fecha
        +decimal total
        +string estado
        +string metodo_pago
        +boolean reembolsado
        +procesarCompra()
        +actualizarEstado()
    }

    class CompraDetalle {
        +int id_detalle
        +int id_compra
        +int id_producto
        +int cantidad
        +decimal precio_unitario
    }

    Usuario "1" --> "0..*" Compra : realiza
    Compra "1" *-- "1..*" CompraDetalle : contiene
    Producto "1" <-- "0..*" CompraDetalle : referenciado_en
```

### 📝 Resumen del Modelo de Datos:
* **Usuario (clientes/vendedores/admins)**: Posee campos de seguridad (`password`, `reset_code`), datos de perfil (`avatar`), y saldo en `creditos` para compras con Agro-Créditos.
* **Producto**: Contiene la información técnica agrícola y el `stock` que se descuenta atómicamente en cada compra.
* **Compra**: Entidad transaccional vinculada a un cliente. Rastrea el estado del despacho (hasta 14 estados logísticos) y el método de pago empleado.
* **CompraDetalle**: Tabla intermedia que resuelve la relación de muchos a muchos entre `Compra` y `Producto`, guardando la `cantidad` y el `precio_unitario` al momento exacto de la venta para mantener un registro histórico inmutable.

---

## 7. Diagrama Entidad-Relación (Base de Datos / ERD)

Este **Diagrama Entidad-Relación (ERD)** ilustra de forma clara y normalizada la estructura de la base de datos relacional de **Agro-Campo**, especificando llaves primarias (PK), llaves foráneas (FK), los tipos de datos exactos de cada columna y las restricciones e integridad referencial del motor InnoDB.

```mermaid
erDiagram
    USUARIOS {
        int id_usuario PK
        string nombre
        string email
        string password
        string rol
        string avatar
        string reset_code
        datetime reset_expires
        decimal creditos
    }

    PRODUCTOS {
        int id_producto PK
        string nombre
        text descripcion
        string categoria
        string origen
        string presentacion
        string cuidado
        string disponibilidad
        decimal precio
        int stock
    }

    COMPRAS {
        int id_compra PK
        int id_usuario FK
        datetime fecha
        decimal total
        string estado
        string metodo_pago
        boolean reembolsado
    }

    COMPRA_DETALLES {
        int id_detalle PK
        int id_compra FK
        int id_producto FK
        int cantidad
        decimal precio_unitario
    }

    USUARIOS ||--o{ COMPRAS : "realiza"
    COMPRAS ||--|{ COMPRA_DETALLES : "contiene"
    PRODUCTOS ||--o{ COMPRA_DETALLES : "incluido_en"
```

### 🔑 Detalle de Cardinalidad e Integridad de la Base de Datos:
1. **USUARIOS a COMPRAS (`1:N` / `Zero-to-Many`)**: Un usuario registrado puede no tener compras registradas en el sistema (por ejemplo, una cuenta nueva), o bien haber realizado múltiples compras a lo largo del tiempo.
2. **COMPRAS a COMPRA_DETALLES (`1:N` / `One-to-Many`)**: Cada registro de compra en la cabecera debe obligatoriamente contener uno o más detalles de productos específicos adquiridos. Si la compra se elimina, se ejecuta una acción `ON DELETE CASCADE` sobre los detalles relacionados.
3. **PRODUCTOS a COMPRA_DETALLES (`1:N` / `Zero-to-Many`)**: Un producto puede estar listado en el catálogo sin haber sido comprado aún por nadie (`0`), o bien haber sido referenciado en múltiples detalles de compra.



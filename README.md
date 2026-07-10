#  Sistema de Gestión Académica (API Backend) - CETIS 27

La API RESTful y el motor de lógica de negocio del ecosistema digital del CETIS 27. Este repositorio contiene el servidor de datos encargado de procesar las reglas de negocio, asegurar los endpoints mediante autenticación por tokens y gestionar la persistencia en la base de datos relacional de forma segura y eficiente.

---

##  Características del Servidor

*   **API RESTful Estandarizada:** Arquitectura de endpoints limpia, predecible y estructurada bajo el prefijo unificado `/api/v1/`.
*   **Acceso Avanzado a Base de Datos (ORM):** Integración de **Prisma ORM** para una manipulación de datos moderna, ágil y segura, optimizando las consultas relacionales.
*   **Autenticación y Seguridad Estricta:** Control de accesos mediante JSON Web Tokens (JWT) con expiración controlada y Middlewares de validación de sesión para proteger rutas críticas.
*   **Control de Lógica Desacoplada:** Flujo de código limpio en JavaScript que aísla las rutas HTTP del procesamiento directo de datos mediante controladores distribuidos.

---

##  Stack Tecnológico

*   **Entorno de Ejecución:** Node.js
*   **Lenguaje:** JavaScript (ES6+)
*   **Framework Web:** Express.js
*   **ORM:** Prisma 
*   **Base de Datos:** MySQL (Estructura relacional para el manejo consistente de alumnos, docentes, grupos y asistencias)
*   **Seguridad:** JWT (JSON Web Tokens) & Bcrypt para hashing seguro de contraseñas
*   **Herramientas:** Dotenv, Cors, Nodemon

---

##  Estructura Real del Servidor

El backend sigue una arquitectura modular y desacoplada, facilitando el mantenimiento y la escalabilidad del sistema:

```text
backend/
├── prisma/                 # Esquemas de datos, modelos y migraciones de Prisma
├── src/                    # Código fuente principal de la aplicación (JavaScript)
│   ├── app.js              # Punto de entrada y configuración del servidor Express
│   ├── config/             # Inicialización del cliente de Prisma y entornos
│   ├── controllers/        # Controladores (Manejo de peticiones, respuestas y reglas de negocio)
│   ├── middlewares/        # Filtros de seguridad (Verificación de JWT y roles)
│   └── routes/             # Mapeo de endpoints de la API (/api/v1/)
├── .env.example            # Plantilla de variables de entorno de referencia
└── .vscode/                # Configuraciones de entorno de desarrollo compartidas

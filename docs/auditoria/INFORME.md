# Auditoría técnica y limpieza — 19/10/2026

## Resultado y alcance

Revisados frontend React, backend Express/Mongoose, autenticación Entra, permisos,
adjuntos, integración HTTP con Business Central, variables locales, manifiestos,
lockfiles, configuración declarativa de Render, fuentes y pruebas.
La extensión AL permanece en su proyecto independiente de Documents/AL; no se ha
modificado ni publicado otra versión durante esta auditoría.

Se conserva la funcionalidad y se corrigen problemas concretos de seguridad y
mantenimiento. **No se certifica que el proyecto completo esté libre de todas las
vulnerabilidades conocidas**: quedan avisos en las herramientas de Create React App.
Tampoco equivale a un pentest ni a una inspección de la cuenta o los permisos de Render.

## 1. Vulnerabilidades encontradas y corregidas

| Análisis npm audit | Antes | Después |
| --- | --- | --- |
| Backend completo | 8: 1 crítica, 6 altas, 1 moderada | 0 |
| Frontend completo, incluidas herramientas | 113: 2 críticas, 73 altas, 35 moderadas, 3 bajas | 95: 0 críticas, 59 altas, 33 moderadas, 3 bajas |
| Frontend: dependencias de ejecución (`--omit=dev`) | No medido por separado antes de la reorganización | 0 |

Los recuentos son los de paquetes y cadenas afectadas que devuelve npm; no
equivalen a ese número de fallos independientes explotables desde la web.
Se guardan los resultados completos antes y después en los JSON de esta carpeta.

Se han aplicado actualizaciones compatibles y `npm audit fix` sin `--force`.
Se retira nodemon, sin referencias en los comandos del proyecto: era el origen
de los tres avisos que quedaban en el backend después de actualizar.

La cadena residual incluye react-scripts/Jest, webpack-dev-server y herramientas
de CSS y compilación. Hay avisos de agotamiento de recursos, serialización,
traversal y dependencias transitivas sin solución compatible en la cadena actual.
`npm audit fix --force` propone sustituir react-scripts por 0.0.0: no es una
actualización funcional válida. No se fuerza ni se ocultan avisos mediante overrides.
Mover herramientas a devDependencies no las corrige: el análisis completo sigue
mostrando sus 95 avisos. Su exposición afecta especialmente a desarrollo y CI;
el despliegue sirve el resultado estático, no el servidor de desarrollo de CRA.

## 2. Seguridad de aplicación

Correcciones aplicadas:

- La creación/consulta de solicitudes de acceso exige un token Microsoft válido.
  Antes permitía consultar un perfil existente y provocar una solicitud a partir
  de un email arbitrario sin autenticar. Ahora email, nombre y tenant proceden
  exclusivamente de las claims firmadas, no del cuerpo enviado por el navegador.
- Las cuentas desactivadas no reciben autorización al iniciar sesión.
- La validación JWT exige expiración numérica y vigente y valida nbf, firma RS256,
  tenant, issuer y audience. La descarga de claves tiene un timeout de 10 segundos.
- El login conserva el token antes de consultar el acceso, manteniendo el flujo
  de autorización con el nuevo requisito del backend. Los fallos muestran un
  mensaje genérico útil en pantalla.
- El rol Usuario no puede obtener pedidos archivados mediante `?estado=Archivar`.
  Se conservan las lecturas de pedidos activos compartidas entre roles, que son
  parte del comportamiento existente y están cubiertas por pruebas.
- Administración de usuarios acepta una lista de campos explícita, valida tipos,
  email y roles, rechaza operadores Mongo y activa validación en las actualizaciones.
- Los roles permitidos se validan también en el modelo de usuario; los catálogos
  de materiales y proyectos rechazan roles desconocidos. Los materiales inactivos
  no se devuelven por ID a roles sin permisos de gestión.
- Se limitan campos, partes y nombres de campos en multipart, manteniendo los
  límites existentes de diez archivos y diez MB por archivo.
- Express deja de anunciar X-Powered-By. Se añaden nosniff, Referrer-Policy,
  X-Frame-Options y una CSP limitada a base-uri, object-src y frame-ancestors.
  No se presenta esta CSP como una protección completa contra XSS.
- Las respuestas API se marcan no-store; una ruta API desconocida devuelve JSON
  404 en lugar de caer en el HTML de la SPA. El manejador final no expone stacks.
- Healthz responde 503 si MongoDB no está conectado. Un fallo de conexión no deja
  el proceso anunciándose como disponible. La migración existente de adjuntos
  recorre los pedidos mediante cursor, sin cargarlos todos de una vez.

## 3. Logging

Nuevo módulo `backend/utils/logger.js`: salida JSON con timestamp, nivel y evento.
Solo admite como contexto estado HTTP y contadores numéricos; descarta objetos
de error, peticiones, payloads, URLs, tokens e identificadores.
Niveles INFO, WARN y ERROR, configurables con LOG_LEVEL; SILENT los desactiva.

Se sustituyeron 49 llamadas de consola en fuentes, además de retirar los logs
específicos de destino BC y los errores completos de autenticación/login.
Se eliminaron mensajes de correo con emails e IDs de pedidos, respuestas Graph,
errores Axios/Mongo completos y diagnósticos de confirmación obsoletos.
Los eventos útiles incluyen `bc.movement_sent`, `bc.movement_posted`,
`validation.rejected`, `bc.error`, `auth.rejected` y `database.connection_failed`.

BC_LOG_REQUESTS queda desactivado en el .env local y en render.yaml. Incluso
activado por error, no imprime solicitudes en producción; en desarrollo solo
emite un evento sin datos del destino. Dotenv funciona en modo quiet.
El frontend no imprime errores de aplicación en producción. Existe un diagnóstico
local opcional con REACT_APP_LOG_ERRORS=true que solo muestra un mensaje fijo,
sin serializar el error original.

## 4. Código muerto y duplicidades

Archivos retirados por falta de uso o por ser diagnósticos temporales:

- `frontend/src/pages/Pedidos.jsx`: pantalla de ejemplo sin ruta ni importación,
  con datos ficticios y una referencia a pedido_id inexistente.
- `frontend/src/reportWebVitals.js` y la dependencia web-vitals: sin consumidores.
- `backend/models/MovimientoAlmacen.js` y `backend/models/SecuenciaAlmacen.js`:
  modelos antiguos sin referencias. No se eliminan sus colecciones ni documentos.
- `backend/scripts/diagnosticar-acopios.js` y
  `backend/scripts/diagnosticar-tarea-acopio.js`: diagnósticos temporales con datos
  específicos de las pruebas anteriores.
- Dos imágenes intermedias de `.tmp-debug` que no utiliza la web.

Se retira @fortawesome/fontawesome-free de la raíz: los iconos utilizados por React
se conservan en frontend. Se eliminan propiedades de mensajes de correo y variables
de diagnóstico que quedaron sin consumidores tras centralizar el logging.

ProjectSelector y Gestión de Pedidos reutilizan useProjectCatalog: una misma
consulta/cache por identidad en lugar de descargar reiteradamente los proyectos.
Se mantienen los contextos que tienen consumidores reales.

El recorrido estático de referencias desde index.js no dejó módulos JS/JSX/CSS
sin referencia tras estas eliminaciones. No se eliminaron selectores CSS por
coincidencias de texto: hay clases dinámicas y responsive. La revisión de
declaraciones idénticas dentro de reglas no encontró duplicados eliminables.
No se afirma haber demostrado que cada selector CSS sea necesario.

## 5. Dependencias y organización

Doce dependencias directas actualizadas; listado exacto en
`cambios-dependencias.json`. Entre ellas Axios 1.20.0, Express 5.3.0,
Mongoose 9.11.2, Multer 2.4.0, MSAL Browser 5.25.1, MSAL React 5.7.2,
React/React DOM 19.3.1 y React Router DOM 7.18.4.
Se actualizan también las versiones mínimas declaradas y los lockfiles.
No se han forzado saltos mayores de dotenv ni testing-library/user-event.

react-scripts y las librerías de pruebas se clasifican como desarrollo.
El build del backend instala explícitamente `frontend ci --include=dev` para que
Render pueda compilar aunque NODE_ENV=production. El código de ejecución y las
herramientas se auditan por separado, manteniendo visible el análisis completo.

La raíz incorpora comandos `npm test`, `npm run test:backend`,
`npm run test:frontend`, `npm run lint` y `npm run audit:production`.
No se reorganizan masivamente rutas, componentes ni servicios.

## 6. Variables, secretos y Render

- .env sigue fuera de Git; las credenciales locales se conservan. Solo se cambia
  BC_LOG_REQUESTS a false. El ejemplo documenta LOG_LEVEL y las variables Graph
  que utiliza el servicio de correo y que faltaban en la plantilla.
- La comparación literal de secretos locales contra los 147 archivos versionados
  examinados no encontró coincidencias. No aparecieron rutas .env/pem/pfx en la
  búsqueda dirigida por nombres en el historial. Esto no sustituye un análisis
  especializado de todo el historial ni detecta secretos desconocidos o rotados.
- Los identificadores públicos de la SPA y las direcciones oficiales de Microsoft
  no son secretos; no se confunden con client_secret ni se imprimen en logs.
- render.yaml conserva BC_PROJECTS_SERVICE=proyectos y añade LOG_LEVEL=INFO,
  BC_LOG_REQUESTS=false y GENERATE_SOURCEMAP=false para el build desplegado.
- No se han inspeccionado ni modificado las variables reales de la cuenta Render.
  Revisar que identidad BC, Entra, empresa/entorno, correo, FRONTEND_URL y Mongo
  coincidan con las configuraciones autorizadas del servicio desplegado.

## 7. Validación y límites

- Backend: 100 pruebas pasan, incluyendo permisos de roles, propiedad de pedidos,
  adjuntos, JWT con claves RSA de prueba, login, validaciones e idempotencia BC.
- Frontend: la ejecución completa final pasa 19 suites / 125 pruebas,
  incluidas las dos pruebas nuevas del flujo de login.
- ESLint: sin errores ni avisos tras retirar el ejemplo inválido y corregir las
  pruebas. Los tests usan consultas semánticas y evitan inspeccionar estructuras
  internas de iconos cuando no es necesario.
- Build de producción completado con GENERATE_SOURCEMAP=false, reproduciendo
  la configuración declarada de Render. El resultado no contiene archivos .map.
- Integración BC real: doce consultas GET verificadas con HTTP 200. Los logs
  contienen únicamente eventos, estados y recuentos. Unidades/movimientos de un
  producto concreto no se consultaron al no definir BC_TEST_ITEM.
- No se ejecutan POST ni registros BC reales, envíos de correo ni migraciones
  sobre datos reales durante la auditoría. Las pruebas de escritura usan dobles.
- La validación automática no sustituye una prueba de navegación con una cuenta
  real en Render tras desplegar, especialmente popup/redirect Microsoft y correo.

## 8. Archivos modificados y eliminados

El inventario completo está en `archivos.json`, con modificados, añadidos y
eliminados. La lista incluye los cambios ya existentes en render.yaml al iniciar
la auditoría, que se preservaron. El cambio local de .env no aparece en Git.
Las herramientas usadas puntualmente para esta auditoría se retiran al terminar.

## 9. Riesgos pendientes

1. **Prioridad alta: herramientas CRA.** Persisten 95 avisos completos de npm.
   Son necesarios para compilar y probar; separar devDependencies no elimina su
   riesgo en CI o desarrollo. No exponer el servidor de desarrollo a Internet.
2. **Registro de acopios del partner.** Se conserva la gestión de intentos y
   comprobantes. Los commits internos, los intentos desconocidos y el comportamiento
   de almacén/tareas del partner requieren revisión funcional propia de AL/BC.
3. **Tokens en localStorage y API con ID token.** Se preserva el contrato actual
   para no romper el login. Un siguiente trabajo debería evaluar access tokens
   para una audiencia API, scopes y autorización, y asociar usuarios a tid/oid
   en lugar de depender solo del email mutable.
4. **Adjuntos en memoria.** Hay límites de tamaño y partes, pero varias subidas
   concurrentes pueden consumir memoria. Valorar streaming, cuotas y análisis
   antivirus/firma real del contenido; no confiar solo en el MIME del navegador.
5. **Abuso y observabilidad.** Faltan límites por usuario/IP y alertas centralizadas
   en el despliegue. Añadirlos considerando los proxies de Render y la carga real.
6. **Historial de secretos y despliegue.** La comprobación realizada es acotada;
   incorporar gitleaks/secret scanning en CI y verificar la configuración remota.
7. **Cache y concurrencia.** Se reducen consultas de catálogos, pero no se han
   ejecutado pruebas de carga de MongoDB/BC reales ni de múltiples instancias.

## 10. Recomendaciones y siguiente despliegue

1. Priorizar una migración aislada de CRA a herramientas mantenidas, con pruebas
   de login Microsoft, redirect bridge, PWA, proxy local, CSS, variables REACT_APP
   y comandos Render. La documentación de React declara CRA obsoleto; no basta
   con cambiar una dependencia a ciegas.
2. Desplegar backend y frontend juntos: el POST de solicitudes de acceso exige
   token y el login actualizado lo proporciona antes de consultar la autorización.
3. Sincronizar el Blueprint o las variables equivalentes de Render. Ejecutar
   `npm test`, `npm run lint` y `npm run audit:production` antes de publicar.
4. Probar en el despliegue login autorizado y no autorizado, roles, pedidos,
   histórico, adjuntos, material, stock, entradas y movimientos. Una prueba real
   de registro debe usar una operación de negocio elegida por el usuario.
5. Añadir después CI y auditoría periódica completa, gestión de secretos, alertas,
   política de retención de logs y mediciones de rendimiento antes de optimizar más.

Fuentes primarias consultadas:

- [React: retirada de Create React App](https://react.dev/blog/2025/02/14/sunsetting-create-react-app).
- [npm: funcionamiento y límites de audit fix](https://docs.npmjs.com/cli/commands/npm-audit/).
- [Microsoft: ID tokens y validación](https://learn.microsoft.com/en-us/entra/identity-platform/id-tokens).

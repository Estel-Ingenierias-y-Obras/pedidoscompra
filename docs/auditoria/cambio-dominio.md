# Cambio a pedidoscompra.esteling.com

## Hallazgos y correcciones

- Login Microsoft: `REACT_APP_ENTRA_REDIRECT_URI` podia seguir apuntando al dominio anterior. El callback ahora siempre es el origen actual + `/redirect`, necesario para comunicar el popup con la ventana principal mediante el bridge de MSAL.
- CORS: antes solo se aceptaba `FRONTEND_URL` en produccion, con comparacion literal (una barra final tambien provocaba rechazo). Se acepta el nuevo origen y se normaliza el origen configurado. Se mantienen bloqueados los terceros y localhost en produccion.
- Correos de compras, cambios de estado y solicitudes/aprobaciones de acceso: usaban `FRONTEND_URL` obligatoriamente. Comparten ahora la configuracion normalizada, con el nuevo dominio como valor por defecto.
- Render: se declaran `FRONTEND_URL=https://pedidoscompra.esteling.com` y `REACT_APP_API_URL` vacio para el despliegue unificado existente. El ejemplo del frontend ya no fija localhost como API.
- Service worker: se excluyen `/redirect` y `/api/` del fallback offline y se renueva la cache para evitar reutilizar respuestas de autenticacion como pagina principal.
- Las rutas de React, llamadas API, manifest e iconos usan rutas relativas. No se encontraron URLs del dominio antiguo fijadas en el codigo original.
- La autenticacion usa tokens Bearer, sin cookies de sesion ligadas al dominio. El almacenamiento local y la instalacion PWA pertenecen a cada origen: hay que iniciar sesion de nuevo y reinstalar la PWA desde el nuevo dominio si procede.

## Ajustes externos necesarios

1. Microsoft Entra ID > Registros de aplicaciones > aplicacion cuyo client ID utiliza el frontend > Autenticacion > plataforma Single-page application (SPA): anadir exactamente `https://pedidoscompra.esteling.com/redirect`. Mantener el callback anterior si todavia se utiliza ese dominio. Este registro no puede cambiarse desde el repositorio.
2. Render > servicio que sirve backend y frontend: confirmar el dominio personalizado y HTTPS; establecer `FRONTEND_URL=https://pedidoscompra.esteling.com`. Eliminar el valor antiguo de `REACT_APP_API_URL` o dejarlo vacio. `REACT_APP_ENTRA_REDIRECT_URI` ya no se utiliza. Si hay `PUBLIC_URL` configurado con el dominio anterior, eliminarlo para que los recursos usen rutas del origen actual.
3. Mantener los client ID y tenant ID actuales tanto en frontend como en backend. Cambiar de dominio no requiere crear otro registro ni cambiar secretos.
4. Desplegar con una nueva compilacion del frontend: las variables `REACT_APP_*` se incorporan durante el build. Revisar valores existentes en el panel de Render aunque se use el blueprint.
5. Si se mantiene un frontend separado en Netlify, configurar `REACT_APP_API_URL` con la URL real del backend y `FRONTEND_URL` con el origen de ese frontend. La configuracion Render de este repositorio sirve ambos desde el mismo origen.

## Comprobacion del despliegue

- Abrir `/healthz` y confirmar estado correcto; abrir `/redirect` y una ruta interna directamente para comprobar el fallback SPA.
- Iniciar sesion con Microsoft y confirmar que el popup vuelve al nuevo `/redirect` y se cierra; comprobar que `POST /api/solicitudes-acceso` responde con JSON.
- Verificar navegacion y operaciones segun el rol, archivos adjuntos y las cuatro clases de notificaciones por correo; confirmar que sus enlaces abren el nuevo dominio.
- Comprobar desde la PWA y despues de recargar con una version anterior del service worker.

No se ha realizado un login real ni se han modificado Entra o Render. La herramienta de navegacion no pudo acceder a ninguno de los dos dominios durante esta revision; la configuracion remota queda pendiente de verificar.

Referencia: https://learn.microsoft.com/en-us/entra/msal/javascript/browser/redirect-bridge

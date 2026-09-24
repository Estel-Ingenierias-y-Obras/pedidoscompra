export const paginas = [
  { path: "/nuevasolicitud", label: "Nuevo Pedido", roles: ["Admin", "Usuario", "Encargado"] },
  { path: "/missolicitudes", label: "Pedidos", roles: ["Admin", "Usuario", "Encargado"] },
  { path: "/validar-solicitudes", label: "Gestión de Pedidos", roles: ["Admin", "Comprador"] },
  { path: "/historico-pedidos", label: "Histórico de Pedidos", roles: ["Admin", "Comprador", "Encargado"] },
  { path: "/material", label: "Material", roles: ["Admin", "Comprador"] },
  { path: "/usuarios", label: "Usuarios", roles: ["Admin"] },
  { path: "/configuracion", label: "Configuración", roles: ["Admin"] }
];

export const rutaInicio = rol => paginas.find(pagina => pagina.roles.includes(rol))?.path || "/";

export const puedeAcceder = (rol, pathname) => {
  const ruta = pathname.replace(/\/+$/, "").toLowerCase();
  const pagina = paginas.find(item => item.path === (ruta === "/pedidos" ? "/missolicitudes" : ruta));
  return pagina?.roles.includes(rol) || false;
};

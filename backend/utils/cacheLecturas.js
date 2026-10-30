// Solo para lecturas: comparte cargas simultáneas y conserva resultados completos.
function crearCacheLecturas({ ttl, ahora = Date.now, maxEntradas = Infinity }) {
  const entradas = new Map();
  return (clave, cargar) => {
    const previa = entradas.get(clave);
    if (previa && (previa.pendiente || previa.expira > ahora())) return previa.promesa;
    for (const [key, entrada] of entradas) {
      if (!entrada.pendiente && entrada.expira <= ahora()) entradas.delete(key);
    }
    const entrada = { pendiente: true };
    entrada.promesa = Promise.resolve().then(cargar).then(datos => {
      entrada.pendiente = false;
      entrada.expira = ahora() + ttl;
      return datos;
    }, error => {
      if (entradas.get(clave) === entrada) entradas.delete(clave);
      throw error;
    });
    if (entradas.size >= maxEntradas) entradas.delete(entradas.keys().next().value);
    entradas.set(clave, entrada);
    return entrada.promesa;
  };
}
module.exports = { crearCacheLecturas };

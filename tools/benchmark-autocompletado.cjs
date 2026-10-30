// Microbenchmark local de los bloques reales; no mide red ni renderizado React.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const assert = require('node:assert/strict');
const archivo = 'frontend/src/components/RequestItems.jsx';
const raiz = path.resolve(__dirname, '..');
const anterior = execFileSync('git', ['show', `HEAD:${archivo}`], { cwd: raiz, encoding: 'utf8' });
const actual = fs.readFileSync(path.join(raiz, archivo), 'utf8');
function preparar(codigo) {
  const inicio = codigo.indexOf('  const normalizar =', codigo.indexOf('function MaterialAutocomplete'));
  const fin = codigo.indexOf('  const seleccionar =', inicio);
  const contexto = vm.createContext({ useMemo: fn => fn() });
  return vm.runInContext(`(materiales, item) => { ${codigo.slice(inicio, fin)} return sugerencias; }`, contexto);
}
const antes = preparar(anterior), despues = preparar(actual);
const filas = Array.from({ length: 3000 }, (_, i) => ({ referencia: `REF-${i}`, descripcion: `Material ${i}` }));
const item = { elemento: 'sin coincidencias' };
assert.equal(JSON.stringify(antes(filas, item)), JSON.stringify(despues(filas, item)));
function medir(fn) {
  fn(filas, item);
  const tiempos = Array.from({ length: 5 }, () => {
    const inicio = performance.now(); fn(filas, item); return performance.now() - inicio;
  }).sort((a, b) => a - b);
  return Number(tiempos[2].toFixed(2));
}
console.log(JSON.stringify({ filas: filas.length, muestras: 5, medianaAntesMs: medir(antes), medianaDespuesMs: medir(despues),
  alcance: 'Busqueda sin coincidencias, incluye construir indice; baseline HEAD de git; sin red ni React' }, null, 2));

// Solo lectura: inspecciona solicitudes fallidas y su estado en BC.
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');
const Envio = require('../models/EnvioAcopio');
const bc = require('../services/almacenBC');
(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  const filtro = { entorno: process.env.BC_ENVIRONMENT, empresa: process.env.BC_COMPANY_ID, estado: 'error' };
  if (!process.argv.includes('--registro')) filtro.confirmadoBC = false;
  const ops = await Envio.find(filtro).sort({ updatedAt: -1 }).limit(5).lean();
  for (const op of ops) {
    const recibos = await bc.obtenerSolicitudAcopio(op.solicitudId);
    const resultados = [];
    for (const r of recibos) {
      let cabecera;
      try { const h = await bc.obtenerCabeceraAcopio(r.idacopio); cabecera = { existe: true, numero: h.numero }; }
      catch (e) { cabecera = { status: e.status }; }
      const lineas = r.numero ? (await bc.obtenerLineasAcopio(r.numero)).length : null;
      resultados.push({ numero: r.numero, creado: r.creado, registroiniciado: r.registroiniciado, registrado: r.registrado, cabecera, lineas });
    }
    console.log(JSON.stringify({ solicitudId: op.solicitudId, numero: op.numero, destino: op.datosEnviados?.cabecera?.destino, error: op.error, actualizado: op.updatedAt, recibos: resultados }));
    if (process.argv.includes('--comprobar-recuperacion')) {
      try {
        const resultado = await require('../services/movimientosAlmacen').recuperarBorrador(op.solicitudId, { email: op.creadoPor });
        console.log(JSON.stringify({ recuperacion: resultado }));
      } catch (e) { console.log(JSON.stringify({ recuperacion: false, status: e.status, mensaje: e.seguro ? e.message : 'No se pudo verificar' })); }
    }
  }
})().catch(e => { console.error(JSON.stringify({ mensaje: e.seguro ? e.message : 'No se pudo completar el diagnóstico', codigo: e.code })); process.exitCode = 1; }).finally(() => mongoose.disconnect());

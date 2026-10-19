// Diagnóstico de solo lectura. No registra ni cambia el proyecto.
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true });
const axios = require('axios');
const { obtenerToken } = require('../services/businessCentral');
const { urlProyectos, baseBC } = require('../services/bcConfig');
(async () => {
  const headers = { Authorization: `Bearer ${await obtenerToken()}` };
  const opciones = { headers, timeout: 15000, proxy: false, maxRedirects: 0 };
  const { data } = await axios.get(urlProyectos(), { ...opciones, params: { $filter: "no eq 'PZ99-001'" } });
  console.log(JSON.stringify({ proyecto: data.value.map(p => Object.fromEntries(Object.entries(p).filter(([k]) => /^(no|description|status)$|task|tarea/i.test(k)))) }));
  const catalogo = await axios.get(`${baseBC()}/ODataV4/`, opciones);
  console.log(JSON.stringify({ servicios: catalogo.data.value?.filter(s => /task|tarea|acopio|proyect|job/i.test(s.name)).map(s => s.name) }));
  for (const servicio of ['Job_Task_Lines', 'TareasProyecto', 'Ficha_proyecto_Excel']) {
    const url = new URL(urlProyectos());
    url.pathname = url.pathname.replace(/[^/]+$/, servicio);
    try {
      const filtro = servicio === 'Ficha_proyecto_Excel' ? "No eq 'PZ99-001'" : "Job_No eq 'PZ99-001'";
      const r = await axios.get(url.href, { ...opciones, params: { $filter: filtro, $top: 20 } });
      console.log(JSON.stringify({ servicio, filas: r.data.value.map(p => Object.fromEntries(Object.entries(p).filter(([k]) => /^(No|Job_No|Job_Task_No|Description|Job_Task_Type|Blocked)$|task|tarea/i.test(k)))) }));
    } catch(e) { console.log(JSON.stringify({ servicio, status: e.response?.status, codigo: e.response?.data?.error?.code })); }
  }
})().catch(e => { console.error(JSON.stringify({ status: e.response?.status, codigo: e.response?.data?.error?.code || e.code })); process.exitCode = 1; });

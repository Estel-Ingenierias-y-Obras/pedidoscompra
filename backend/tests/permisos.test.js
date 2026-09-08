const { test, before, after, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const Pedido = require("../models/Pedido");
const Usuario = require("../models/Usuario");
const emails = require("../services/emailService");

// Real routers and role middleware, with controlled identity and database/storage doubles.
auth.obtenerUsuarioActual = (req, res, next) => {
  if (!req.get("x-test-role")) return res.sendStatus(401);
  req.usuarioActual = { rol: req.get("x-test-role"), email: "owner@example.com" };
  next();
};
emails.sendStatusChangeNotification = async () => {};
const app = express();
app.use(express.json());
app.use("/api/pedidos", require("../routes/pedidos"));
app.use("/api/usuarios", require("../routes/usuarios"));
app.use("/api/configuracion/notificaciones-acceso", require("../routes/destinatariosAcceso"));
app.use("/api/configuracion/notificaciones-compras", require("../routes/destinatariosCompra"));
app.use("/api/solicitudes-acceso", require("../routes/solicitudesAcceso"));

let server, base, pedido, writes;
const id = "507f1f77bcf86cd799439011";
const fileId = "507f1f77bcf86cd799439012";
before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());
beforeEach(() => {
  mock.restoreAll();
  writes = 0;
  pedido = { _id: id, email: "owner@example.com", estado: "Pendiente", archivos: [] };
  mock.method(Pedido, "findById", async () => pedido);
  mock.method(Pedido, "findByIdAndUpdate", async (_, data) => { writes++; return { ...pedido, ...data }; });
  mock.method(Pedido, "findByIdAndDelete", async () => { writes++; });
});
const request = (role, method = "GET", path = "/api/pedidos", body) => fetch(base + path, {
  method,
  headers: { ...(role ? { "x-test-role": role } : {}), "Content-Type": "application/json" },
  ...(body ? { body: JSON.stringify(body) } : {})
});

for (const role of ["Usuario", "Comprador", "Admin"]) {
  test(`${role} puede leer todos los pedidos sin filtro de propietario`, async () => {
    mock.method(Pedido, "find", async filtro => {
      assert.deepEqual(filtro, {});
      return [pedido, { ...pedido, email: "other@example.com" }];
    });
    const response = await request(role);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).length, 2);
  });
}
test("lectura requiere autenticación y un rol conocido", async () => {
  assert.equal((await request(null)).status, 401);
  assert.equal((await request("Desconocido")).status, 403);
});
test("Usuario no puede editar, sustituir adjuntos ni eliminar pedidos ajenos", async () => {
  pedido.email = "other@example.com";
  for (const body of [
    { proyecto: "Otro" }, { email: "owner@example.com", descripcion: "Intento" },
    { archivosExistentes: [] }, { archivosDescripcionExistentes: [] },
    { comentarioCompras: "Intento" }, { estado: "Pedido" }
  ]) {
    assert.equal((await request("Usuario", "PUT", `/api/pedidos/${id}`, body)).status, 403);
  }
  const data = new FormData();
  data.append("archivosDescripcion", new Blob(["test"], { type: "text/plain" }), "test.txt");
  assert.equal((await fetch(`${base}/api/pedidos/${id}`, {
    method: "PUT", headers: { "x-test-role": "Usuario" }, body: data
  })).status, 403);
  assert.equal((await request("Usuario", "DELETE", `/api/pedidos/${id}`)).status, 403);
  assert.equal((await request("Usuario", "DELETE", `/api/pedidos/admin/${id}`)).status, 403);
  assert.equal((await request("Usuario", "PATCH", `/api/pedidos/${id}`, { estado: "Pedido" })).status, 404);
  assert.equal(writes, 0);
});
test("propietario puede editar y eliminar su pedido pendiente", async () => {
  pedido.email = "OWNER@example.com";
  assert.equal((await request("Usuario", "PUT", `/api/pedidos/${id}`, {
    proyecto: "Obra", descripcion: "Material", archivosDescripcionExistentes: []
  })).status, 200);
  assert.equal((await request("Usuario", "DELETE", `/api/pedidos/${id}`)).status, 200);
  assert.equal(writes, 2);
});
test("propietario conserva restricciones por estado y campos de compras", async () => {
  pedido.estado = "Pedido";
  assert.equal((await request("Usuario", "PUT", `/api/pedidos/${id}`, { proyecto: "Obra" })).status, 409);
  assert.equal((await request("Usuario", "DELETE", `/api/pedidos/${id}`)).status, 409);
  assert.equal((await request("Usuario", "PUT", `/api/pedidos/${id}`, { estado: "Archivar" })).status, 403);
  assert.equal((await request("Usuario", "PUT", `/api/pedidos/${id}`, { comentarioCompras: "No" })).status, 403);
  assert.equal(writes, 0);
});
for (const role of ["Comprador", "Admin"]) {
  test(`${role} conserva gestión de pedidos ajenos`, async () => {
    pedido.email = "other@example.com";
    assert.equal((await request(role, "PUT", `/api/pedidos/${id}`, { estado: "Pedido" })).status, 200);
    assert.equal((await request(role, "PUT", `/api/pedidos/${id}`, { comentarioCompras: "Listo" })).status, 200);
    assert.equal((await request(role, "DELETE", `/api/pedidos/admin/${id}`)).status, role === "Admin" ? 200 : 403);
  });
}
test("Comprador no puede crear pedidos ni acceder a administración", async () => {
  assert.equal((await request("Comprador", "POST", "/api/pedidos", {})).status, 403);
  for (const path of ["/api/usuarios", "/api/solicitudes-acceso", "/api/configuracion/notificaciones-acceso", "/api/configuracion/notificaciones-compras"]) {
    assert.equal((await request("Comprador", "GET", path)).status, 403);
  }
});
test("directorio limitado de compradores mantiene la asignación", async () => {
  mock.method(Usuario, "find", filtro => {
    assert.deepEqual(filtro, { rol: "Comprador", activo: { $ne: false } });
    return { select: campos => {
      assert.equal(campos, "nombre rol");
      return { lean: async () => [{ nombre: "Compras", rol: "Comprador" }] };
    } };
  });
  assert.equal((await request("Comprador", "GET", "/api/usuarios/compradores")).status, 200);
  assert.equal((await request("Usuario", "GET", "/api/usuarios/compradores")).status, 403);
});
test("Usuario lee adjuntos ajenos solo si pertenecen al pedido solicitado", async () => {
  mock.method(Pedido, "findOne", async query => {
    assert.equal(query._id, id);
    assert.ok(query.$or.some(item => item["archivosDescripcion.fileId"] === fileId));
    return { ...pedido, email: "other@example.com", archivosDescripcion: [
      { fileId, nombre: "material.txt", tipoMime: "text/plain" }
    ] };
  });
  mock.getter(mongoose.mongo, "GridFSBucket", () => function () {
    return {
      find: () => ({ next: async () => ({ _id: fileId, length: 4 }) }),
      openDownloadStream: () => Readable.from(["test"])
    };
  });
  const response = await request("Usuario", "GET", `/api/pedidos/${id}/archivos/${fileId}`);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "test");
  mock.method(Pedido, "findOne", async () => null);
  assert.equal((await request("Usuario", "GET", `/api/pedidos/${id}/archivos/${fileId}`)).status, 404);
});

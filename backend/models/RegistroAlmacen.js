const mongoose = require("mongoose");
const Operacion = require("./OperacionAlmacen");
// Colección distinta: crear una línea y registrarla son dos operaciones durables.
const schema = Operacion.schema.clone();
schema.set("collection", "registrosAlmacen");
module.exports = mongoose.model("RegistroAlmacen", schema);

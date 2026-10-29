const emailValido = email => typeof email === "string" && email.length <= 254 &&
  /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email);

function normalizarPersonasNotificadas(valor = []) {
  try {
    const lista = typeof valor === "string" ? JSON.parse(valor) : valor;
    if (!Array.isArray(lista)) throw new Error();
    const normalizados = lista.map(email => {
      if (typeof email !== "string") throw new Error();
      const limpio = email.trim().toLowerCase();
      if (!emailValido(limpio)) throw new Error();
      return limpio;
    });
    return [...new Set(normalizados)];
  } catch {
    const error = new Error("Las personas a notificar deben ser una lista de correos electrónicos válidos.");
    error.status = 400;
    throw error;
  }
}

module.exports = { normalizarPersonasNotificadas, emailValido };

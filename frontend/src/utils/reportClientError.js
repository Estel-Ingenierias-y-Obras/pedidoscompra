// Diagnóstico local opcional. No recibe ni imprime objetos HTTP o identidades.
export default function reportClientError() {
  if (process.env.NODE_ENV !== "production" && process.env.REACT_APP_LOG_ERRORS === "true") {
    console.warn("No se pudo completar una operación de la aplicación.");
  }
}

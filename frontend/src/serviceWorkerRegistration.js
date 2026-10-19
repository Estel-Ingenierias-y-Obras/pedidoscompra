import reportClientError from "./utils/reportClientError";
export function registerServiceWorker() {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    const serviceWorkerUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

    navigator.serviceWorker.register(serviceWorkerUrl).catch((error) => {
      reportClientError();
    });
  });
}

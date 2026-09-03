import { useEffect, useRef, useState } from "react";

function NotificationToast({ message, type = "exito", onClose, duration = 4000 }) {
  const [closing, setClosing] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const text = typeof message === "object" ? message?.texto : message;
  const toastType = typeof message === "object" ? message?.tipo || type : type;

  useEffect(() => {
    if (!text) return undefined;

    setClosing(false);
    const exitTimer = window.setTimeout(
      () => setClosing(true),
      Math.max(0, duration - 300)
    );
    const closeTimer = window.setTimeout(() => onCloseRef.current?.(), duration);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(closeTimer);
    };
  }, [text, toastType, duration]);

  if (!text) return null;

  return (
    <div
      className={`notification-toast notification-toast-${toastType}${closing ? " is-closing" : ""}`}
      role={toastType === "error" ? "alert" : "status"}
      aria-live={toastType === "error" ? "assertive" : "polite"}
    >
      {text}
    </div>
  );
}

export default NotificationToast;

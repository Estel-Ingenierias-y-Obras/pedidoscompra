import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import NotificationPeople, { NotificationPeopleList } from "./NotificationPeople";

function Editor() {
  const [value, setValue] = useState([]);
  return <><NotificationPeople value={value} onChange={setValue} /><NotificationPeopleList personas={value} /></>;
}

test("añade varios correos, normaliza espacios y mayúsculas, evita duplicados y permite quitar", () => {
  render(<Editor />);
  const input = screen.getByLabelText("Correo electrónico");
  fireEvent.change(input, { target: { value: " JUAN@empresa.com " } });
  fireEvent.keyDown(input, { key: "Enter" });
  fireEvent.change(input, { target: { value: "maria@externa.org" } });
  fireEvent.click(screen.getByRole("button", { name: "Añadir destinatario" }));
  fireEvent.change(input, { target: { value: "juan@empresa.com" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Eliminar juan@empresa.com" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Eliminar juan@empresa.com" }));
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
  fireEvent.change(input, { target: { value: "incorrecto@" } });
  fireEvent.click(screen.getByRole("button", { name: "Añadir destinatario" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Revisa el formato");
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
});

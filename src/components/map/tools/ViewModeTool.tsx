"use client";

import { useMapApp } from "../MapAppContext";

export function ViewModeTool() {
  const { state, setState } = useMapApp();
  return <button type="button" className="sr-only" onClick={() => setState({ projection: state.projection === "globe" ? "mercator" : "globe" })}>Cambiar proyección</button>;
}

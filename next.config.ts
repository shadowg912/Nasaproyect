import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 es un módulo nativo: no debe empaquetarse.
  serverExternalPackages: ["better-sqlite3"],
  // Evita que Turbopack tome un package-lock.json ajeno como raíz del proyecto.
  turbopack: {
    root: path.resolve(),
  },
  poweredByHeader: false,
};

export default nextConfig;

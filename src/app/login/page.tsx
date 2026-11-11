import type { Metadata } from "next";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar" };

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="w-full max-w-sm">
        <Brand className="mb-8 justify-center" />
        <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
          <h1 className="mb-1 text-xl font-bold text-ink">Bienvenido</h1>
          <p className="mb-5 text-sm text-muted">Servicios para residentes de tu conjunto.</p>
          <LoginForm />
        </div>
        <div aria-hidden className="mx-auto mt-6 h-1 w-16 rounded-full bg-accent" />
      </div>
    </main>
  );
}

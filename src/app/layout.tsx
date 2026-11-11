import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/sw-register";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Nexum", template: "%s · Nexum" },
  description: "Servicios al residente: paquetería, zonas comunes, asambleas y comunicados.",
  applicationName: "Nexum",
  // iPhone: al añadirla a la pantalla de inicio se abre como app, sin barras de Safari.
  appleWebApp: { capable: true, title: "Nexum", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  // Permite usar toda la pantalla (notch y barra inferior); el contenido respeta las áreas seguras.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1d4ed8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

// Se ejecuta antes del primer render para evitar el parpadeo del tema.
const themeScript = `try{var t=localStorage.getItem('theme');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import './globals.css';
import { Nav } from '@/components/nav';
import { config } from '@/lib/config';

export const metadata: Metadata = {
  title: 'CrediFlow',
  description: 'Plataforma ficticia de solicitudes de crédito - curso AWS Key Institute / Fedecrédito',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header className="topbar">
          <div className="brand">
            CrediFlow<span>backend de {config.student}</span>
          </div>
          <Nav />
        </header>
        <main>{children}</main>
        <footer>CrediFlow es un sistema ficticio con fines educativos. Nunca uses datos reales.</footer>
      </body>
    </html>
  );
}

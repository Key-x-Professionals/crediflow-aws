'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Estado' },
  { href: '/solicitudes', label: 'Solicitudes' },
  { href: '/solicitudes/nueva', label: 'Nueva solicitud' },
  { href: '/precalificacion', label: 'Precalificación' },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={path === l.href ? 'active' : ''}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

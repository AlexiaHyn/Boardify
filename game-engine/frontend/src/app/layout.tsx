import type { Metadata } from 'next';
import { Cinzel, Crimson_Pro } from 'next/font/google';
import './globals.css';

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700'],
});

const crimsonPro = Crimson_Pro({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  title: 'Boardify – Conjure Your Next Great Game',
  description:
    'Describe a board game idea and watch it materialize into a complete blueprint, powered by AI.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${cinzel.variable} ${crimsonPro.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}

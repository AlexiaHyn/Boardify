import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Card Game Engine',
  description: 'Multiplayer card game engine — play any card game online',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

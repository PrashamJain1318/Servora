import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SERVORA — Turn enquiries into customers',
  description:
    'AI-powered growth and operations platform for appointment-based service businesses.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  );
}

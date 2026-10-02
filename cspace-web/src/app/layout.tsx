import type { Metadata } from 'next';
import './globals.css';
import { UIProvider } from '@/components/ui-provider';

export const metadata: Metadata = {
  title: 'CSVecna | Automação WhatsApp & SaaS Multi-Tenant | C-Space Technologies',
  description: 'Plataforma SaaS CSVecna de automação inteligente para WhatsApp, disparo de mensagens, atendimento automático e inteligência de negócios por C-Space Technologies.',
  keywords: ['CSVecna', 'WhatsApp Bot', 'SaaS', 'Automação', 'C-Space Technologies', 'Angola', 'CRM WhatsApp', 'Atendimento'],
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    shortcut: ['/icon.svg'],
    apple: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt">
      <head>
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
        <link rel="shortcut icon" type="image/svg+xml" href="/icon.svg" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-[#07090e] text-slate-100 antialiased selection:bg-emerald-500 selection:text-black">
        <UIProvider>
          {children}
        </UIProvider>
      </body>
    </html>
  );
}

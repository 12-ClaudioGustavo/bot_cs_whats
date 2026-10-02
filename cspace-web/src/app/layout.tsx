import type { Metadata } from 'next';
import './globals.css';
import { UIProvider } from '@/components/ui-provider';

export const metadata: Metadata = {
  title: 'CSVecna - Automação WhatsApp & SaaS Multi-Tenant por C-Space Technologies',
  description: 'Plataforma SaaS CSVecna de automação inteligente para WhatsApp, disparo de mensagens, atendimento automático e inteligência de negócios por C-Space Technologies.',
  keywords: ['CSVecna', 'WhatsApp Bot', 'SaaS', 'Automação', 'C-Space Technologies', 'Angola', 'CRM WhatsApp', 'Atendimento'],
  icons: {
    icon: [
      { url: '/brand/csvecna-icon.jpg', type: 'image/jpeg' },
      { url: '/icon.png', type: 'image/png' },
    ],
    shortcut: ['/brand/csvecna-icon.jpg'],
    apple: [
      { url: '/brand/csvecna-icon.jpg', type: 'image/jpeg' },
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
        <link rel="icon" type="image/jpeg" href="/brand/csvecna-icon.jpg" />
        <link rel="shortcut icon" type="image/jpeg" href="/brand/csvecna-icon.jpg" />
        <link rel="apple-touch-icon" href="/brand/csvecna-icon.jpg" />
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

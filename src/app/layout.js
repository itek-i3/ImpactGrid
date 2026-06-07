import { Inter, League_Spartan, DM_Sans } from 'next/font/google';
import ThemeInitializer from '@/components/layout/ThemeInitializer';
import '@/styles/globals.css';
import Header from '@/components/layout/Header';

// Keep your font configurations here
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const leagueSpartan = League_Spartan({ subsets: ['latin'], variable: '--font-spartan', display: 'swap' });
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dmsans', display: 'swap' });

export const metadata = {
  title: 'ImpactNotion — Workspace for Impact360',
  description: 'A Notion-like workspace for organizing Impact360 community operations...',
  keywords: ['workspace', 'notion', 'impact360', 'documents', 'databases'],
};

export default function RootLayout({ children }) {
  // Note: 'currentProject' won't be available here by default 
  // because this is the global root layout.
  return (
    <html lang="en" className={`${inter.variable} ${leagueSpartan.variable} ${dmSans.variable}`} suppressHydrationWarning>
      <body>
        <ThemeInitializer />
        <div className="app-container">
          <Header /> 
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
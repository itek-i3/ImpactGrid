import { Inter, League_Spartan, DM_Sans, Plus_Jakarta_Sans, Schibsted_Grotesk, JetBrains_Mono } from 'next/font/google';
import ThemeInitializer from '@/components/layout/ThemeInitializer';
import '@/styles/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const leagueSpartan = League_Spartan({ subsets: ['latin'], variable: '--font-spartan', display: 'swap' });
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dmsans', display: 'swap' });
const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap', weight: ['400', '500', '600', '700'] });
const schibsted = Schibsted_Grotesk({ subsets: ['latin'], variable: '--font-schibsted', display: 'swap', weight: ['400', '600', '700', '800'] });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap', weight: ['400', '500', '600'] });

export const metadata = {
  title: 'ImpactNotion — Workspace for Impact360',
  description: 'A Notion-like workspace for organizing Impact360 community operations...',
  keywords: ['workspace', 'notion', 'impact360', 'documents', 'databases'],
};

export default function RootLayout({ children }) {
  // Note: 'currentProject' won't be available here by default 
  // because this is the global root layout.
  return (
    <html lang="en" className={`${inter.variable} ${leagueSpartan.variable} ${dmSans.variable} ${plusJakarta.variable} ${schibsted.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body>
        <ThemeInitializer />
        <div className="app-container">
          {children}
        </div>
      </body>
    </html>
  );
}
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Tech For Everyone",
  description: "모두를 위한 웹사이트 분석",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#f2f3f5]`}
      >
        {/* 상단 헤더 */}
        <header className="global-header">Tech for Everyone</header>

        {/* 전체 페이지 중앙 정렬 */}
        <main className="global-container">
          {children}
        </main>
      </body>
    </html>
  );
}

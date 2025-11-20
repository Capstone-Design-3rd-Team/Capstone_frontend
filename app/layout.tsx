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
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#f2f3f5]`}
      >
        {/* 상단 헤더 */}
        <header
          style={{
            width: "100%",
            height: "75px",
            backgroundColor: "black",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: "40px",
            fontWeight: 800,
            letterSpacing: "1px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
          }}
        >
          Tech for Everyone
        </header>

        {/* 중앙 Wrapper */}
        <div
          style={{
            maxWidth: "900px",
            width: "100%",
            margin: "0 auto",
            marginTop: "-35px",
            padding: "25px",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "50px",
              borderRadius: "16px",
              boxShadow: "0 6px 25px rgba(0, 0, 0, 0.12)",
              minHeight: "calc(100vh - 150px)",
            }}
          >
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}

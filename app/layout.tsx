import type { Metadata } from "next";
import AnimatedBackground from "../src/components/AnimatedBackground";
import "./globals.css";

export const metadata: Metadata = {
  title: "Careers — Join Our Team",
  description:
    "Explore career opportunities and join a team building meaningful products.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@100;200;300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col" style={{ fontFamily: '"Geist", ui-sans-serif, system-ui, sans-serif', position: "relative" }}>
        <AnimatedBackground />
        {children}
      </body>
    </html>
  );
}


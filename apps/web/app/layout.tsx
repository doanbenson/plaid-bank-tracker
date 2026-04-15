import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import SideNavbar from "@/components/bank/SideNavbar";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Banking Bento",
  description: "Snack-sized banking and finance manager",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} antialiased`}>
        <SideNavbar />
        {children}
      </body>
    </html>
  );
}

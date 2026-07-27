import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shanty's Table | Homemade Food",
  description: "Order fresh homemade meals, build your perfect plate and pay when you collect.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

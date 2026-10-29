import "./globals.css";
import AppShell from "../components/AppShell";

export const metadata = {
  title: "Policy QA",
  description: "Ask questions across company policy documents. Answers cite the passages they came from.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-canvas font-sans text-base text-ink antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

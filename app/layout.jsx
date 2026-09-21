export const metadata = {
  title: 'Mi PC de casa',
  description: 'Acceso remoto a mi PC personal',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}

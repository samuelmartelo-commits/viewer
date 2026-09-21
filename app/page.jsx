import Link from 'next/link';

export default function Home() {
  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>Mi PC remoto</h1>
      <p>
        <Link href="/view">Ir a la vista de control →</Link>
      </p>
    </div>
  );
}

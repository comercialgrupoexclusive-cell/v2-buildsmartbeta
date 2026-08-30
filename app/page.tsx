import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="max-w-lg">
        <p className="text-sm font-medium text-gray-500">Gestão de projetos e obras</p>
        <h1 data-testid="app-title" className="text-3xl font-bold">
          BuildSmart V2
        </h1>
        <p className="mt-2 text-gray-600">
          Project é o núcleo permanente da operação. Entre para acessar seu espaço de trabalho.
        </p>
      </div>
      <Link className="rounded-lg bg-black px-5 py-2.5 text-white" href="/login">
        Entrar no BuildSmart
      </Link>
    </main>
  );
}

import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 p-6 text-center">
      <div>
        <p className="text-sm font-medium text-gray-500">Gate G02 · Identidade</p>
        <h1 data-testid="app-title" className="text-3xl font-bold">
          BuildSmart V2
        </h1>
        <p className="mt-2 text-gray-600">
          Project é o núcleo permanente da operação.
        </p>
      </div>
      <div className="flex gap-3">
        <Link className="rounded-lg bg-black px-4 py-2 text-white" href="/login">
          Entrar
        </Link>
        <Link className="rounded-lg border px-4 py-2" href="/projects">
          Projetos
        </Link>
      </div>
    </main>
  );
}

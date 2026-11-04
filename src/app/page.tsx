export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <section
        aria-labelledby="project-title"
        className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12"
      >
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-800">
          Gestión agropecuaria
        </p>

        <h1
          id="project-title"
          className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl"
        >
          AgroTrack
        </h1>

        <p className="mt-6 text-lg leading-8 text-slate-700">
          Una plataforma para organizar la información de los animales y las
          operaciones de la finca en un solo lugar.
        </p>

        <div className="mt-8 rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
          Proyecto en desarrollo. Esta pantalla verifica la configuración
          inicial; los módulos funcionales todavía no están disponibles.
        </div>
      </section>
    </main>
  );
}
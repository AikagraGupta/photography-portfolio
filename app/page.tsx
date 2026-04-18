import InfiniteGallery from "@/components/InfiniteGallery";
import { localGalleryPhotos } from "@/lib/local-gallery";

export default function Home() {
  const galleryImages = localGalleryPhotos.map((photo) => ({
    src: photo.src,
    alt: `${photo.collection} - ${photo.title}`,
  }));

  return (
    <main className="min-h-screen bg-background">
      <InfiniteGallery
        images={galleryImages}
        speed={1.2}
        zSpacing={3}
        visibleCount={12}
        falloff={{ near: 0.8, far: 14 }}
        className="h-screen w-full overflow-hidden"
      />

      <div className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-4 text-[11px] font-mono uppercase tracking-[0.3em] text-white mix-blend-exclusion md:px-6">
        <p>Aikagra Gupta</p>
        <div className="pointer-events-auto flex items-center gap-4">
          <span>Shanghai</span>
          <a
            href="https://github.com/AikagraGupta/photography-portfolio"
            target="_blank"
            rel="noreferrer"
            className="transition hover:opacity-70"
          >
            GitHub
          </a>
        </div>
      </div>

      <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center px-3 text-center text-white mix-blend-exclusion">
        <div className="max-w-5xl">
          <p className="mb-4 text-[11px] font-mono uppercase tracking-[0.38em] text-white/90">
            Photography + Videography
          </p>
          <h1 className="font-serif text-4xl tracking-tight md:text-7xl">
            <span className="italic">I create;</span> therefore I am
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-6 text-white/90 md:text-base">
            Local gallery built only from the Shanghai photo set.
          </p>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-8 z-20 text-center font-mono text-[11px] font-semibold uppercase tracking-[0.26em] text-white mix-blend-exclusion">
        <p>Use mouse wheel, arrow keys, or touch to navigate</p>
        <p className="mt-2 opacity-60">
          Auto-play resumes after 3 seconds of inactivity
        </p>
      </div>
    </main>
  );
}

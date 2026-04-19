import HomeScene from "@/components/HomeScene";
import { localGalleryPhotos } from "@/lib/local-gallery";

export default function Home() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const galleryImages = localGalleryPhotos.map((photo) => ({
    src: `${basePath}${photo.src}`,
    alt: `${photo.collection} - ${photo.title}`,
  }));

  return (
    <main className="min-h-screen bg-background">
      <HomeScene images={galleryImages} />

      <div className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-4 text-[11px] font-mono uppercase tracking-[0.3em] text-white mix-blend-exclusion md:px-6">
        <p>Aikagra Gupta</p>
        <div className="pointer-events-auto flex items-center gap-4">
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

      <div className="fixed inset-x-0 bottom-8 z-20 text-center font-mono text-[11px] font-semibold uppercase tracking-[0.26em] text-white mix-blend-exclusion">
        <p>Use mouse wheel, arrow keys, or touch to navigate</p>
        <p className="mt-2 opacity-60">
          Auto-play resumes after 3 seconds of inactivity
        </p>
      </div>
    </main>
  );
}

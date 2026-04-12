import Image from "next/image";
import InfiniteGallery from "@/components/InfiniteGallery";
import { flickrProfileUrl, formatFlickrDate, getFlickrPhotos } from "@/lib/flickr";

const capabilities = [
  "Editorial portraits and lookbooks",
  "Brand campaigns and launch visuals",
  "Short-form films and reels",
  "Event coverage with a cinematic finish",
];

const filmProjects = [
  {
    title: "Nocturne",
    type: "Fashion short",
    image: "/5.webp",
    details: "Direction, camera, color, and vertical cutdowns for social launch.",
  },
  {
    title: "Room Tone",
    type: "Artist profile",
    image: "/8.webp",
    details: "Observational motion piece built around atmosphere, pacing, and clean interview frames.",
  },
];

export default async function Home() {
  const photos = await getFlickrPhotos(12);
  const heroImages = photos.map((photo) => ({
    src: photo.image,
    alt: photo.title,
  }));
  const featuredPhotos = photos.slice(0, 3);
  const archivePhotos = photos.slice(3, 9);

  return (
    <main className="relative overflow-hidden bg-background text-foreground">
      <header className="pointer-events-none fixed inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-5 py-5 md:px-8">
          <a
            href="#top"
            className="pointer-events-auto text-sm uppercase tracking-[0.4em] text-white/85 transition hover:text-white"
          >
            Aikagra Studio
          </a>
          <nav className="pointer-events-auto hidden items-center gap-6 text-xs uppercase tracking-[0.35em] text-white/65 md:flex">
            <a href="#selected-work" className="transition hover:text-white">
              Work
            </a>
            <a href="#archive" className="transition hover:text-white">
              Archive
            </a>
            <a href="#films" className="transition hover:text-white">
              Films
            </a>
            <a href="#contact" className="transition hover:text-white">
              Contact
            </a>
          </nav>
        </div>
      </header>

      <section id="top" className="relative min-h-screen overflow-hidden">
        <InfiniteGallery
          images={heroImages}
          speed={1.15}
          zSpacing={3}
          visibleCount={12}
          falloff={{ near: 0.8, far: 14 }}
          className="absolute inset-0 h-full w-full"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,8,0.26),rgba(8,8,8,0.82)_78%,rgba(8,8,8,0.97))]" />
        <div className="ambient-orb left-[-8rem] top-24 h-72 w-72 bg-[radial-gradient(circle,rgba(211,162,106,0.38),transparent_70%)]" />
        <div className="ambient-orb right-[-7rem] top-[22%] h-80 w-80 bg-[radial-gradient(circle,rgba(127,78,55,0.28),transparent_72%)] [animation-delay:-6s]" />

        <div className="relative z-10 mx-auto flex min-h-screen max-w-[1600px] flex-col justify-end px-5 pb-12 pt-28 md:px-8 md:pb-16 lg:pt-36">
          <div className="max-w-4xl">
            <p className="eyebrow text-white/70">Photography + videography portfolio</p>
            <h1 className="mt-5 max-w-4xl font-serif text-5xl leading-none tracking-[-0.04em] text-white sm:text-6xl md:text-8xl">
              Frames shaped by shadow,
              <span className="block italic text-[color:var(--accent)]">
                movement, and memory.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/72 md:text-lg">
              Live imagery now pulls from your public Flickr stream, so the homepage
              stays current as you publish new work.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#selected-work"
                className="link-pill bg-white text-black hover:bg-[color:var(--accent)]"
              >
                View selected work
              </a>
              <a
                href={flickrProfileUrl}
                target="_blank"
                rel="noreferrer"
                className="link-pill border border-white/20 bg-white/6 text-white hover:bg-white/12"
              >
                Open Flickr
              </a>
            </div>
          </div>

          <div className="mt-14 grid gap-6 border-t border-white/12 pt-6 text-sm text-white/70 md:grid-cols-3">
            <div>
              <p className="eyebrow text-white/45">Feed source</p>
              <p className="mt-2 text-base text-white">Recent public uploads from Flickr</p>
            </div>
            <div>
              <p className="eyebrow text-white/45">Base</p>
              <p className="mt-2 text-base text-white">Shanghai with worldwide availability</p>
            </div>
            <div>
              <p className="eyebrow text-white/45">Focus</p>
              <p className="mt-2 text-base text-white">
                Editorial portraits, campaign visuals, and motion stories
              </p>
            </div>
          </div>

          <div className="mt-8 text-xs uppercase tracking-[0.35em] text-white/42">
            Use mouse wheel, arrow keys, or touch to move through the gallery
          </div>
        </div>
      </section>

      <section
        id="selected-work"
        className="relative mx-auto max-w-[1600px] px-5 py-20 md:px-8 md:py-28"
      >
        <div className="grid gap-10 lg:grid-cols-[0.65fr_1.35fr] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:h-fit">
            <p className="eyebrow">Selected stills</p>
            <h2 className="section-heading mt-5">
              Recent public uploads, pulled straight from your Flickr stream.
            </h2>
            <p className="mt-5 max-w-md text-base leading-7 text-muted">
              These cards are server-rendered from your Flickr public feed, so replacing
              a photo in your stream updates the site without touching the code.
            </p>
          </div>

          <div className="grid gap-8">
            {featuredPhotos.map((photo, index) => (
              <article
                key={photo.link}
                className="portfolio-panel grid gap-5 overflow-hidden border border-line bg-panel p-4 md:grid-cols-[1.05fr_0.95fr] md:p-5"
              >
                <a
                  href={photo.link}
                  target="_blank"
                  rel="noreferrer"
                  className="overflow-hidden"
                >
                  <Image
                    src={photo.image}
                    alt={photo.title}
                    width={1400}
                    height={1000}
                    priority={index === 0}
                    sizes="(max-width: 768px) 100vw, 60vw"
                    className="portfolio-image h-[300px] w-full object-cover md:h-[420px]"
                  />
                </a>
                <div className="flex flex-col justify-between gap-8 py-2">
                  <div>
                    <p className="eyebrow">Flickr spotlight</p>
                    <h3 className="mt-3 font-serif text-3xl tracking-[-0.03em] text-white md:text-4xl">
                      {photo.title}
                    </h3>
                    <p className="mt-4 max-w-md text-base leading-7 text-muted">
                      Published on {formatFlickrDate(photo.dateTaken)}. Tap through to
                      see the full-resolution Flickr page and metadata.
                    </p>
                  </div>
                  <div className="grid gap-3 border-t border-line pt-4 text-sm text-white/72 sm:grid-cols-2">
                    <p>Live-synced from your public Flickr uploads.</p>
                    <a
                      href={photo.link}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-white/20 underline-offset-4 transition hover:decoration-white"
                    >
                      View on Flickr
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="archive" className="border-y border-line bg-[color:rgba(255,255,255,0.02)]">
        <div className="mx-auto max-w-[1600px] px-5 py-20 md:px-8 md:py-28">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">Flickr archive</p>
              <h2 className="section-heading mt-5">A wider grid of recent frames.</h2>
            </div>
            <a
              href={flickrProfileUrl}
              target="_blank"
              rel="noreferrer"
              className="link-pill border border-line bg-transparent text-white hover:bg-white/6"
            >
              Browse full photostream
            </a>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {archivePhotos.map((photo) => (
              <a
                key={photo.link}
                href={photo.link}
                target="_blank"
                rel="noreferrer"
                className="portfolio-panel flex flex-col overflow-hidden border border-line bg-panel p-3"
              >
                <Image
                  src={photo.image}
                  alt={photo.title}
                  width={1200}
                  height={1600}
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="portfolio-image h-[360px] w-full object-cover"
                />
                <div className="flex items-end justify-between gap-4 border-t border-line pt-4">
                  <div>
                    <p className="eyebrow">Recent upload</p>
                    <h3 className="mt-2 font-serif text-2xl tracking-[-0.03em] text-white">
                      {photo.title}
                    </h3>
                  </div>
                  <p className="max-w-[10rem] text-right text-sm leading-6 text-muted">
                    {formatFlickrDate(photo.dateTaken)}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section id="films" className="mx-auto max-w-[1600px] px-5 py-20 md:px-8 md:py-28">
        <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
          <div>
            <p className="eyebrow">Videography</p>
            <h2 className="section-heading mt-5">
              Motion work that holds on mood long enough to feel cinematic.
            </h2>
            <p className="mt-5 max-w-md text-base leading-7 text-muted">
              The still photography now comes from your Flickr feed. This motion section
              is ready for your reel links or embedded video projects next.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {filmProjects.map((film) => (
              <article key={film.title} className="flex flex-col gap-4">
                <div className="overflow-hidden border border-line bg-panel p-3">
                  <Image
                    src={film.image}
                    alt={film.title}
                    width={1200}
                    height={1600}
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="portfolio-image h-[420px] w-full object-cover"
                  />
                </div>
                <div className="flex items-start justify-between gap-4 border-t border-line pt-4">
                  <div>
                    <p className="eyebrow">{film.type}</p>
                    <h3 className="mt-2 font-serif text-3xl tracking-[-0.03em] text-white">
                      {film.title}
                    </h3>
                  </div>
                  <p className="max-w-xs text-sm leading-6 text-muted">{film.details}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="border-t border-line">
        <div className="mx-auto max-w-[1600px] px-5 py-20 md:px-8 md:py-28">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-20">
            <div>
              <p className="eyebrow">Approach</p>
              <h2 className="section-heading mt-5">
                A quiet, high-contrast visual language across stills and moving image.
              </h2>
            </div>
            <div className="grid gap-8">
              <p className="max-w-2xl text-lg leading-8 text-white/82">
                Your site now uses the public Flickr feed as its photography source of
                truth. Keep posting there and the portfolio stays current; the local
                bundled imagery remains only as a safety fallback.
              </p>
              <div className="grid gap-4 border-t border-line pt-6 md:grid-cols-2">
                {capabilities.map((item) => (
                  <p key={item} className="text-base leading-7 text-muted">
                    {item}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="relative border-t border-line">
        <div className="mx-auto max-w-[1600px] px-5 py-20 md:px-8 md:py-28">
          <div className="max-w-4xl">
            <p className="eyebrow">Let&apos;s make something with atmosphere</p>
            <h2 className="mt-5 font-serif text-4xl leading-none tracking-[-0.04em] text-white sm:text-5xl md:text-7xl">
              Available for portraits, campaigns, branded motion, and live events.
            </h2>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="mailto:hello@aikagra.studio"
                className="link-pill bg-[color:var(--accent)] text-black hover:bg-white"
              >
                hello@aikagra.studio
              </a>
              <a
                href={flickrProfileUrl}
                target="_blank"
                rel="noreferrer"
                className="link-pill border border-line bg-transparent text-white hover:bg-white/6"
              >
                Follow on Flickr
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

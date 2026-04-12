const FLICKR_USER_ID = "204170567@N07";

export const flickrProfileUrl = `https://www.flickr.com/photos/${FLICKR_USER_ID}/`;

const flickrFeedUrl = `https://api.flickr.com/services/feeds/photos_public.gne?id=${encodeURIComponent(
  FLICKR_USER_ID
)}&lang=en-us&format=json&nojsoncallback=1`;

type FlickrFeedItem = {
  title: string;
  link: string;
  media?: {
    m?: string;
  };
  date_taken: string;
};

type FlickrFeedResponse = {
  title: string;
  modified: string;
  items: FlickrFeedItem[];
};

export type FlickrPhoto = {
  title: string;
  link: string;
  image: string;
  thumb: string;
  dateTaken: string;
};

const fallbackImages = ["/1.webp", "/2.webp", "/3.webp", "/4.webp", "/5.webp", "/6.webp", "/7.webp", "/8.webp"];

function upgradeFlickrImage(url: string, size: "q" | "z" | "b" = "z") {
  return url.replace(/_m\.(jpg|jpeg|png|webp)$/i, `_${size}.$1`);
}

function formatFallbackTitle(index: number) {
  return `Portfolio frame ${String(index + 1).padStart(2, "0")}`;
}

function formatPhotoTitle(title: string, index: number) {
  const cleaned = title.trim();

  if (!cleaned) {
    return formatFallbackTitle(index);
  }

  if (cleaned.toLowerCase().startsWith("untitled-")) {
    return cleaned.replace(/^untitled-/i, "Frame ");
  }

  if (/^dsc\d+/i.test(cleaned)) {
    return cleaned.replace(/^DSC/i, "Sequence ");
  }

  return cleaned.replace(/[_-]+/g, " ").trim();
}

export function getFallbackPhotos(limit = 8): FlickrPhoto[] {
  return fallbackImages.slice(0, limit).map((image, index) => ({
    title: formatFallbackTitle(index),
    link: flickrProfileUrl,
    image,
    thumb: image,
    dateTaken: "Portfolio selection",
  }));
}

export async function getFlickrPhotos(limit = 20): Promise<FlickrPhoto[]> {
  try {
    const response = await fetch(flickrFeedUrl, {
      next: { revalidate: 3600 },
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Flickr feed request failed with ${response.status}`);
    }

    const data = (await response.json()) as FlickrFeedResponse;

    if (!Array.isArray(data.items) || data.items.length === 0) {
      return getFallbackPhotos(limit);
    }

    return data.items
      .filter((item) => item.media?.m)
      .slice(0, limit)
      .map((item, index) => ({
        title: formatPhotoTitle(item.title, index),
        link: item.link,
        image: upgradeFlickrImage(item.media!.m!, "z"),
        thumb: upgradeFlickrImage(item.media!.m!, "q"),
        dateTaken: item.date_taken,
      }));
  } catch {
    return getFallbackPhotos(limit);
  }
}

export function formatFlickrDate(dateTaken: string) {
  if (dateTaken === "Portfolio selection") {
    return dateTaken;
  }

  const date = new Date(dateTaken);
  if (Number.isNaN(date.getTime())) {
    return dateTaken;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

import Head from 'expo-router/head';
import { usePathname } from 'expo-router';
import { absoluteUrl, OG_IMAGE_PATH, SITE_NAME } from '@/lib/site';

interface SeoProps {
  title: string;
  description: string;
  indexable?: boolean;
  /** Absolute image URL for social previews; defaults to the site card. */
  image?: string | null;
  type?: 'website' | 'profile' | 'article';
}

/**
 * Document metadata for the current screen. The innermost <Seo> wins, so a
 * screen can refine what the root layout sets from the route.
 */
export function Seo({ title, description, indexable = true, image, type = 'website' }: SeoProps) {
  const pathname = usePathname();
  const url = absoluteUrl(pathname === '/' ? '' : pathname);
  const card = image || absoluteUrl(OG_IMAGE_PATH);

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={indexable ? 'index, follow' : 'noindex, nofollow'} />
      <link rel="canonical" href={url} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="fr_FR" />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={card} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={card} />
    </Head>
  );
}

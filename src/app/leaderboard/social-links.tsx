import type { IconType } from 'react-icons';
import {
  FaBluesky,
  FaFacebookF,
  FaGlobe,
  FaInstagram,
  FaLinkedinIn,
  FaTiktok,
  FaXTwitter,
  FaYoutube,
} from 'react-icons/fa6';

import { linkPlatform, type LinkPlatform } from '@/lib/promoters';

export const PLATFORM_META: Record<
  LinkPlatform,
  { label: string; Icon: IconType }
> = {
  x: { label: 'X', Icon: FaXTwitter },
  instagram: { label: 'Instagram', Icon: FaInstagram },
  tiktok: { label: 'TikTok', Icon: FaTiktok },
  linkedin: { label: 'LinkedIn', Icon: FaLinkedinIn },
  bluesky: { label: 'Bluesky', Icon: FaBluesky },
  facebook: { label: 'Facebook', Icon: FaFacebookF },
  youtube: { label: 'YouTube', Icon: FaYoutube },
  website: { label: 'Website', Icon: FaGlobe },
};

/**
 * A promoter's one link as an icon button, the icon picked from the link's
 * host (a globe for any other website). Every link was reviewed by an
 * approver, but it still leads off-site to an account we do not control, so
 * it carries nofollow and opens in a new tab.
 */
export default function ProfileLink({
  name,
  link,
}: {
  name: string;
  link?: string;
}) {
  if (!link) return null;
  const { label, Icon } = PLATFORM_META[linkPlatform(link)];
  const what = label === 'Website' ? 'website' : `on ${label}`;
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer nofollow"
      aria-label={`${name} ${what}`}
      title={`${name} ${what}`}
      className="inline-flex rounded-full p-1.5 align-middle text-gray-700 hover:bg-gray-900 hover:text-white transition-colors"
    >
      <Icon />
    </a>
  );
}

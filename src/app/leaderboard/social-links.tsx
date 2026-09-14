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

import {
  LINK_PLATFORMS,
  type LinkPlatform,
  type PromoterLinks,
} from '@/lib/promoters';

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
 * A promoter's social links as icon buttons. Every link was reviewed by an
 * approver, but they still lead off-site to accounts we do not control, so
 * they carry nofollow and open in a new tab.
 */
export default function SocialLinks({
  name,
  links,
}: {
  name: string;
  links: PromoterLinks;
}) {
  return (
    <span className="inline-flex flex-wrap gap-1.5 align-middle">
      {LINK_PLATFORMS.filter((platform) => links[platform]).map((platform) => {
        const { label, Icon } = PLATFORM_META[platform];
        return (
          <a
            key={platform}
            href={links[platform]}
            target="_blank"
            rel="noopener noreferrer nofollow"
            aria-label={`${name} on ${label}`}
            title={`${name} on ${label}`}
            className="rounded-full p-1.5 text-gray-700 hover:bg-gray-900 hover:text-white transition-colors"
          >
            <Icon />
          </a>
        );
      })}
    </span>
  );
}

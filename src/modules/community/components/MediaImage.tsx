import { useCallback, useEffect, useState } from 'react';
import { fetchCommunityMediaUrl } from '../api/posts';
import { RemoteImage } from '../../../shared/ui/RemoteImage';

/** Automatic re-issues after a failed URL or download, before asking the user to retry. */
const AUTO_REISSUES = 2;

interface MediaImageProps {
  mediaId: string | null | undefined;
  width: number;
  height: number;
  radius: number;
}

/**
 * A community/inquiry photo by media id. Signed URLs expire after 60s (community-api.md):
 * the URL is issued on mount and decoded once, and only re-issued when the URL request or the
 * download fails — a few times automatically, then via the tile's reload button.
 */
export function MediaImage({ mediaId, width, height, radius }: MediaImageProps) {
  const [attempt, setAttempt] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const reissue = useCallback(() => setAttempt(n => n + 1), []);

  useEffect(() => {
    setFailed(false);
    setUrl(null); // never retry the old (possibly expired) URL while a new one is issued
    if (!mediaId) return;
    let cancelled = false;
    fetchCommunityMediaUrl(mediaId).then(
      ({ data }) => !cancelled && setUrl(data.url),
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [mediaId, attempt]);

  useEffect(() => {
    if (failed && attempt < AUTO_REISSUES) reissue();
  }, [failed, attempt, reissue]);

  const gaveUp = failed && attempt >= AUTO_REISSUES;
  return (
    <RemoteImage
      url={url}
      width={width}
      height={height}
      radius={radius}
      onError={() => setFailed(true)}
      onRetry={gaveUp ? reissue : undefined}
    />
  );
}

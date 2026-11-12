import { loadFreshDogSheets } from './loadDogSheets';
import type { DogAssetManifest } from '../../../dog/types';

// "fail" in a URL makes its download fail; anything else decodes to a stub image.
jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    Data: { fromURI: (url: string) => (url.includes('fail') ? Promise.reject(new Error('403')) : Promise.resolve(url)) },
    Image: { MakeImageFromEncoded: (data: string) => ({ data }) },
  },
}));

const NOW = Date.parse('2026-11-11T00:00:00Z');
const manifest = (url: string, expiresInMs: number) =>
  ({
    expiresAt: new Date(NOW + expiresInMs).toISOString(),
    animations: { IDLE: { spritesheetUrl: url, frames: [] } },
  }) as unknown as DogAssetManifest;

test('a fresh manifest loads without re-issuing', async () => {
  const reissue = jest.fn();
  const result = await loadFreshDogSheets(manifest('a.png', 60_000), reissue, () => NOW);
  expect(reissue).not.toHaveBeenCalled();
  expect(result.sheets['a.png']).toBeTruthy();
});

test('an expired manifest is re-issued before downloading', async () => {
  const fresh = manifest('b.png', 60_000);
  const reissue = jest.fn().mockResolvedValue(fresh);
  const result = await loadFreshDogSheets(manifest('fail-old.png', 1_000), reissue, () => NOW);
  expect(reissue).toHaveBeenCalledTimes(1);
  expect(result.manifest).toBe(fresh);
  expect(result.sheets['b.png']).toBeTruthy();
});

test('a failing sheet is retried a limited number of times, then left as a skeleton', async () => {
  const reissue = jest.fn().mockResolvedValue(manifest('fail.png', 60_000));
  const result = await loadFreshDogSheets(manifest('fail.png', 60_000), reissue, () => NOW);
  expect(reissue).toHaveBeenCalledTimes(2);
  expect(result.sheets['fail.png']).toBeNull();
});

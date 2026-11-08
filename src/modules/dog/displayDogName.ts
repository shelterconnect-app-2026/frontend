/** Remove the internal seed label from generated sample dogs before showing their names. */
export function displayDogName(name: string | null | undefined): string {
  const cleanName = (name ?? '').replace(/^\s*생성\s*샘플\s*\d+\s*(?:[·•:：-]\s*)?/u, '').trim();
  return cleanName || '강아지';
}

export function withKoreanConjunction(name: string): string {
  const last = name.charCodeAt(name.length - 1);
  const hasFinalConsonant = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
  return `${name}${hasFinalConsonant ? '과' : '와'}`;
}

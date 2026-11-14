const IMPORT_METADATA = /^production-batch-\S+\s*\/\s*public animal\s+\S+\.|공공 API 원본 기반 비공개 생성 샘플/;

/** The public API still contains batch provenance in some introduction fields. */
export function displayDogIntroduction(introduction: string | null, dogName: string): string {
  const value = introduction?.trim();
  const fallback = `${dogName}에 대한 소개 글은 아직 없어요.\n대화하며 조금씩 알아가 봐요.`;
  if (!value) {
    return fallback;
  }
  if (!IMPORT_METADATA.test(value)) {
    return value;
  }
  const originalTraits = value.match(/원문 특징:\s*(.+)$/);
  return originalTraits?.[1]?.trim() || fallback;
}

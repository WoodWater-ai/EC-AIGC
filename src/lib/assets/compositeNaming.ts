const stripExtension = (name: string) => name.replace(/\.[^./\\]+$/, '');

/** 套图统一命名：A+B+套装，最长 80 个字符。 */
export const buildCompositeResourceName = (names: Array<string | undefined>): string => {
  const normalized = names
    .map((name) => stripExtension((name ?? '').trim()))
    .filter(Boolean);
  if (normalized.length === 0) return '合成套装';

  const suffix = '+套装';
  const joined = normalized.join('+');
  return `${joined.slice(0, 80 - suffix.length)}${suffix}`;
};

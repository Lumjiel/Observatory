const WORDS_PER_MINUTE = 200;
const CJK_CHARS_PER_MINUTE = 300;

export function calculateReadingTime(content) {
  if (!content) return '1 min';

  const text = content.replace(/---[\s\S]*?---/, '').replace(/[#*`~>|]/g, '').trim();

  const cjkChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length;
  const words = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g, ' ').split(/\s+/).filter(Boolean).length;

  const minutes = Math.ceil(cjkChars / CJK_CHARS_PER_MINUTE + words / WORDS_PER_MINUTE);
  return Math.max(1, minutes) + ' min';
}
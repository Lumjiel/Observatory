export function slugify(text) {
  if (!text) return '';
  return text
    .replace(/\.md$/i, '')
    .replace(/[\/\\]/g, '-')
    .replace(/[\s]+/g, '-')
    .replace(/[：:]/g, '')
    .replace(/[（）()]/g, '')
    .replace(/[？?]/g, '')
    .replace(/[！!]/g, '')
    .replace(/[，,、]/g, '-')
    .replace(/[「」【】"'""''《》]/g, '')
    .replace(/[｜|·]/g, '-')
    .replace(/[^\w一-龥-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}
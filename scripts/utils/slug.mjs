/**
 * Slug 生成工具
 * 统一项目中所有 slug 生成逻辑
 */

export function slugify(title) {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9一-龥]+/g, '-')
        .replace(/^-|-$/g, '');
}
/**
 * 阅读时间计算
 * 统一项目中所有阅读时间计算逻辑
 */

const WORDS_PER_MINUTE = 200;

export function calculateReadingTime(content) {
    const chineseChars = (content.match(/[一-龥]/g) || []).length;
    const englishWords = (content.match(/[a-zA-Z]+/g) || []).length;
    const totalWords = chineseChars + englishWords;
    const minutes = Math.ceil(totalWords / WORDS_PER_MINUTE);
    return minutes < 1 ? '1 min' : `${minutes} min`;
}
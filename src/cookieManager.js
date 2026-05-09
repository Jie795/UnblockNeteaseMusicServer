const request = require('./request');
const { logScope } = require('./logger');

const logger = logScope('cookieManager');

// Cookie 缓存存储
const cookieCache = new Map();

/**
 * 检查字符串是否为 URL
 * @param {string} str
 * @returns {boolean}
 */
const isUrl = (str) => {
	if (!str) return false;
	return str.startsWith('http://') || str.startsWith('https://');
};

/**
 * 从 URL 获取 cookie 文本
 * @param {string} url
 * @returns {Promise<string>}
 */
const fetchCookieFromUrl = async (url) => {
	try {
		logger.info(`正在从 URL 获取 cookie: ${url}`);
		const response = await request('GET', url);
		const cookieText = await response.body(false); // false 表示返回字符串而不是 Buffer
		logger.info(`成功从 URL 获取 cookie，长度: ${cookieText.length}`);
		return cookieText.trim();
	} catch (error) {
		logger.error(`从 URL 获取 cookie 失败: ${error.message}`);
		throw error;
	}
};

/**
 * 获取 cookie，支持直接文本或 URL
 * @param {string} cookieOrUrl - cookie 文本或 URL
 * @param {string} cacheKey - 缓存键名
 * @returns {Promise<string|null>}
 */
const getCookie = async (cookieOrUrl, cacheKey = 'default') => {
	if (!cookieOrUrl) return null;

	// 如果不是 URL，直接返回 cookie 文本
	if (!isUrl(cookieOrUrl)) {
		return cookieOrUrl;
	}

	// 检查缓存
	const cached = cookieCache.get(cacheKey);
	const now = Date.now();

	if (cached && now - cached.timestamp < 3600000) {
		// 1小时 = 3600000 毫秒
		logger.info(`使用缓存的 cookie (${cacheKey})，剩余时间: ${Math.floor((3600000 - (now - cached.timestamp)) / 1000)}秒`);
		return cached.cookie;
	}

	// 缓存过期或不存在，重新获取
	try {
		const cookie = await fetchCookieFromUrl(cookieOrUrl);
		cookieCache.set(cacheKey, {
			cookie,
			timestamp: now,
		});
		logger.info(`Cookie 已缓存 (${cacheKey})，有效期: 1小时`);
		return cookie;
	} catch (error) {
		// 如果获取失败但有旧缓存，返回旧缓存
		if (cached) {
			logger.warn(`获取新 cookie 失败，使用过期的缓存 (${cacheKey})`);
			return cached.cookie;
		}
		throw error;
	}
};

/**
 * 清除指定的 cookie 缓存
 * @param {string} cacheKey
 */
const clearCache = (cacheKey) => {
	cookieCache.delete(cacheKey);
	logger.info(`已清除 cookie 缓存: ${cacheKey}`);
};

/**
 * 清除所有 cookie 缓存
 */
const clearAllCache = () => {
	cookieCache.clear();
	logger.info('已清除所有 cookie 缓存');
};

module.exports = {
	getCookie,
	clearCache,
	clearAllCache,
	isUrl,
};

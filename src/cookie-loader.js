const request = require('./request');
const { logScope } = require('./logger');

const logger = logScope('cookie-loader');

// Cookie 缓存，格式: { name: { value: string, expireTime: number } }
const cookieCache = {};

// 缓存有效期：1 天（毫秒）
const CACHE_DURATION = 24 * 60 * 60 * 1000;

/**
 * 加载 Cookie，支持从 HTTP URL 获取或直接使用字符串
 * @param {string} cookieValue - Cookie 字符串或 HTTP URL
 * @param {string} name - Cookie 名称（用于日志和缓存）
 * @returns {Promise<string|null>} - 返回 Cookie 字符串或 null
 */
async function loadCookie(cookieValue, name = 'Cookie') {
	if (!cookieValue) {
		return null;
	}

	// 检查是否是 HTTP/HTTPS URL
	if (
		cookieValue.startsWith('http://') ||
		cookieValue.startsWith('https://')
	) {
		// 检查缓存是否有效
		const cached = cookieCache[name];
		if (cached && cached.expireTime > Date.now()) {
			const preview =
				cached.value.length > 50
					? cached.value.substring(0, 50) + '...'
					: cached.value;
			logger.debug(`使用缓存的 ${name}: ${preview}`);
			return cached.value;
		}

		// 缓存过期或不存在，重新获取
		try {
			logger.info(`从 URL 获取 ${name}: ${cookieValue}`);
			const response = await request('GET', cookieValue);
			const cookieText = await response.body();
			const trimmedCookie = cookieText.toString().trim();

			if (trimmedCookie) {
				// 保存到缓存
				cookieCache[name] = {
					value: trimmedCookie,
					expireTime: Date.now() + CACHE_DURATION,
				};

				const preview =
					trimmedCookie.length > 50
						? trimmedCookie.substring(0, 50) + '...'
						: trimmedCookie;
				logger.info(`✓ 成功获取 ${name}: ${preview} (缓存 24 小时)`);
				return trimmedCookie;
			} else {
				logger.warn(`从 URL 获取的 ${name} 为空`);
				return null;
			}
		} catch (error) {
			logger.error(
				`✗ 获取 ${name} 失败: ${error.message || error.code || 'Unknown error'}`
			);

			// 如果有缓存（即使过期），在出错时仍然使用
			if (cached && cached.value) {
				logger.warn(`使用过期的缓存 ${name}`);
				return cached.value;
			}

			return null;
		}
	}

	// 直接返回 Cookie 字符串（不缓存）
	const preview =
		cookieValue.length > 50
			? cookieValue.substring(0, 50) + '...'
			: cookieValue;
	logger.info(`使用配置的 ${name}: ${preview}`);
	return cookieValue;
}

module.exports = {
	loadCookie,
};

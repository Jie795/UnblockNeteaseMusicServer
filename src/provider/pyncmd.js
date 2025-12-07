const select = require('./select');
const request = require('../request');
const { getManagedCacheStorage } = require('../cache');

/**
 * Extract source from provider name (e.g., 'pyncmd-kuwo' -> 'kuwo', 'pyncmd' -> 'netease')
 * @param {string} providerName - The provider name (e.g., 'pyncmd', 'pyncmd-kuwo', 'pyncmd-joox')
 * @returns {string} - The source name for API (default: 'netease')
 */
function getSourceFromProviderName(providerName) {
	if (!providerName || providerName === 'pyncmd') {
		return 'netease';
	}
	// Extract source from 'pyncmd-{source}' format
	const match = providerName.match(/^pyncmd-(.+)$/);
	return match ? match[1] : 'netease';
}

/**
 * Search for a song using the API
 * @param {string} source - The music source (kuwo, joox, etc.)
 * @param {Object} info - Song info with keyword/name
 * @returns {Promise<string>} - The song ID
 */
const search = (source, info) => {
	const keyword = encodeURIComponent(info.keyword || info.name || '');
	const url =
		'https://music-api.gdstudio.xyz/api.php?types=search&source=' +
		source +
		'&name=' +
		keyword +
		'&count=15&pages=1';

	return request('GET', url)
		.then((response) => response.json())
		.then((jsonBody) => {
			// Handle different response formats
			let results = [];
			if (Array.isArray(jsonBody)) {
				results = jsonBody;
			} else if (jsonBody && Array.isArray(jsonBody.data)) {
				results = jsonBody.data;
			} else if (jsonBody && jsonBody.result && Array.isArray(jsonBody.result)) {
				results = jsonBody.result;
			}
			
			if (!results || results.length === 0) {
				return Promise.reject();
			}

			// Select the best match from results
			const list = results.map((song) => ({
				id: song.id || song.songId || song.musicId,
				name: song.name || song.songName || song.title,
				duration: song.duration || song.time || 0,
				album: song.album
					? {
							id: song.album.id || song.album.albumId,
							name: song.album.name || song.album.albumName,
						}
					: null,
				artists: song.artist
					? [{ id: null, name: song.artist }]
					: song.artists
						? song.artists.map((artist) => ({
								id: artist.id || null,
								name: artist.name || artist,
							}))
						: song.singer
							? [{ id: null, name: song.singer }]
							: [],
			}));

			const matched = select(list, info);
			return matched ? matched.id : Promise.reject();
		});
};

/**
 * Get the audio URL for a song
 * @param {string} source - The music source
 * @param {string} id - The song ID
 * @returns {Promise<string>} - The audio URL
 */
const track = (source, id) => {
	// Credit: This API is provided by GD studio (music.gdstudio.xyz).
	const url =
		'https://music-api.gdstudio.xyz/api.php?types=url&source=' +
		source +
		'&id=' +
		id +
		'&br=' +
		['999', '320'].slice(
			select.ENABLE_FLAC ? 0 : 1,
			select.ENABLE_FLAC ? 1 : 2
		);
	return request('GET', url)
		.then((response) => response.json())
		.then((jsonBody) => {
			if (
				!jsonBody ||
				typeof jsonBody !== 'object' ||
				!('url' in jsonBody)
			)
				return Promise.reject();

			return jsonBody.br > 0 ? jsonBody.url : Promise.reject();
		});
};

/**
 * Create a provider function for a specific source
 * @param {string} source - The music source (netease, kuwo, joox, etc.)
 * @returns {Object} - Provider object with check method
 */
function createProvider(source) {
	const cs = getManagedCacheStorage(`provider/pyncmd-${source}`);
	
	const check = (info) => {
		// For netease, we can use the id directly from info
		if (source === 'netease' && info.id) {
			return cs.cache(info, () => track(source, info.id));
		}
		
		// For other sources, we need to search first
		return cs.cache(info, () => 
			search(source, info).then((id) => track(source, id))
		);
	};
	
	return { check };
}

// Default provider (netease) - for backward compatibility
const defaultProvider = createProvider('netease');

module.exports = defaultProvider;
module.exports.createProvider = createProvider;
module.exports.getSourceFromProviderName = getSourceFromProviderName;

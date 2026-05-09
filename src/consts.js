const DEFAULT_SOURCE = ['kugou', 'bodian', 'migu', 'ytdlp'];
const pyncmdProvider = require('./provider/pyncmd');

const PROVIDERS = {
	qq: require('./provider/qq'),
	kugou: require('./provider/kugou'),
	kuwo: require('./provider/kuwo'),
	bodian: require('./provider/bodian'),
	migu: require('./provider/migu'),
	joox: require('./provider/joox'),
	youtube: require('./provider/youtube'),
	youtubedl: require('./provider/youtube-dl'),
	ytdlp: require('./provider/yt-dlp'),
	bilibili: require('./provider/bilibili'),
	bilivideo: require('./provider/bilivideo'),
	pyncmd: pyncmdProvider,
};

/**
 * Dynamically register pyncmd-{source} providers
 * This allows support for pyncmd-kuwo, pyncmd-joox, pyncmd-migu, etc.
 */
function registerPyncmdProviders() {
	// Pre-register common sources
	const commonSources = ['kuwo', 'joox'];

	commonSources.forEach((source) => {
		const providerName = `pyncmd-${source}`;
		if (!(providerName in PROVIDERS)) {
			PROVIDERS[providerName] = pyncmdProvider.createProvider(source);
		}
	});

	// Return a function to dynamically register additional sources on demand
	return (source) => {
		const providerName = `pyncmd-${source}`;
		if (!(providerName in PROVIDERS)) {
			PROVIDERS[providerName] = pyncmdProvider.createProvider(source);
		}
		return PROVIDERS[providerName];
	};
}

// Initialize pyncmd providers
const registerPyncmd = registerPyncmdProviders();

// Export function to dynamically register pyncmd providers
module.exports = {
	DEFAULT_SOURCE,
	PROVIDERS,
	registerPyncmd,
};

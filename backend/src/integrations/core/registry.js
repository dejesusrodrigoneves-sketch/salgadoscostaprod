const providers = new Map();

export function registerProvider(provider) {
  if (!provider || !provider.platform) throw new Error('Provider sem platform');
  providers.set(provider.platform, provider);
  return provider;
}

export function getProvider(platform) {
  return providers.get(platform) || null;
}

export function listProviders() {
  return Array.from(providers.values());
}

export default { registerProvider, getProvider, listProviders };

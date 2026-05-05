const CACHE_KEY = "fundchain_campaigns";

export function saveCampaignsToCache(campaigns) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(campaigns));
  } catch (e) { console.error("Cache save error:", e); }
}

export function loadCampaignsFromCache() {
  try {
    const data = localStorage.getItem(CACHE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) { return []; }
}

export function addCampaignToCache(campaign) {
  const existing = loadCampaignsFromCache();
  const updated = [...existing.filter(c => !(c.id === campaign.id && c.blockchain === campaign.blockchain)), campaign];
  saveCampaignsToCache(updated);
}

// Narrative campaign localStorage persistence — PoC v1.
// Single active campaign per browser. Multiplayer/Firestore comes later.

var LS_KEY = 'dom_narrative_campaign_v1'

function saveCampaign(campaign) {
  if (!campaign) return
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(campaign))
  } catch (e) {
    console.warn('[narrativeStorage] save failed:', e)
  }
}

function loadCampaign() {
  try {
    var raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (e) {
    console.warn('[narrativeStorage] load failed:', e)
    return null
  }
}

function clearCampaign() {
  try { localStorage.removeItem(LS_KEY) } catch (e) { /* ignore */ }
}

function hasCampaign() {
  return loadCampaign() != null
}

export { saveCampaign, loadCampaign, clearCampaign, hasCampaign }

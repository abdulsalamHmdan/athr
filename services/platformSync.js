const Ambassador = require('../models/Ambassador');

const BASE = process.env.PLATFORM_API_BASE || `http://localhost:${process.env.PORT || 3000}/api/platform`;
const VERIFY_URL = process.env.PLATFORM_VERIFY_URL || `${BASE}/verify-or-create`;
const DONATIONS_URL = process.env.PLATFORM_DONATIONS_URL || `${BASE}/donations-total`;
const API_KEY = process.env.PLATFORM_API_KEY || 'mock-key';

const STALE_MS = 24 * 60 * 60 * 1000;

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_KEY}`,
  };
}

async function verifyOrCreateAccount({ phone, name }) {
  const r = await fetch(VERIFY_URL, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ phone, name }),
  });
  if (!r.ok) throw new Error(`verify_failed_${r.status}`);
  return r.json();
}

async function fetchTotalDonations({ phone }) {
  const url = `${DONATIONS_URL}?phone=${encodeURIComponent(phone)}`;
  const r = await fetch(url, { headers: authHeaders() });
  if (!r.ok) throw new Error(`donations_failed_${r.status}`);
  const data = await r.json();
  return Number(data.total || 0);
}

async function syncAmbassador(ambDoc) {
  // let profileId = ambDoc.platformProfileId;
  // if (!profileId) {
  //   const acc = await verifyOrCreateAccount({ phone: ambDoc.phone, name: ambDoc.name });
  //   profileId = acc.profileId || '';
  //   ambDoc.platformProfileId = profileId;
  // }
  const total = await fetchTotalDonations({ phone: ambDoc.phone });
  ambDoc.totalDonations = total;
  ambDoc.donationsUpdatedAt = new Date();
  await ambDoc.save();
  return { profileId, totalDonations: total, donationsUpdatedAt: ambDoc.donationsUpdatedAt };
}

async function syncStale() {
  const cutoff = new Date(Date.now() - STALE_MS);
  const stale = await Ambassador.find({
    $or: [{ donationsUpdatedAt: null }, { donationsUpdatedAt: { $lt: cutoff } }],
  });
  let ok = 0;
  let failed = 0;
  for (const amb of stale) {
    try {
      await syncAmbassador(amb);
      ok++;
    } catch (e) {
      failed++;
      console.error('[platformSync] failed for', amb.phone, e.message);
    }
  }
  return { scanned: stale.length, ok, failed };
}

module.exports = { syncAmbassador, syncStale, verifyOrCreateAccount, fetchTotalDonations, STALE_MS };

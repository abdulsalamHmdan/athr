const express = require('express');
const router = express.Router();

const GOALS_API = 'https://donate.utq.org.sa/api/v1/orders/report/goals:ED4SFhUVFUcZGBsZHRgeTyEdIiQgHyIhJCMmJSgnKiksKy4tMC8yMQ';

router.get('/donations-all', async (req, res) => {
  try {
    const r = await fetch(`${GOALS_API}?ts=1772312400-1772744400`);
    const data = await r.json();
    res.json({
      total: data?.totals?.total || 0,
      currency: 'SAR',
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    res.json({ total: 0, currency: 'SAR', error: 'fetch_failed' });
  }
});

router.get('/donations/:phone', async (req, res) => {
  const phone = req.params.phone;
  try {
    const r = await fetch(`${GOALS_API}?goal_creator=${encodeURIComponent(phone)}`);
    const data = await r.json();
    console.log('Fetched data for phone', phone, data);
    const total = data?.totals?.total || 0;
    const items = Array.isArray(data?.items)
      ? data.items.map((it) => ({
          pk: it.pk,
          name: it.name,  
          total: it.total || 0,
          goal: it.goal || 0,
        }))
      : [];
    res.json({
      phone,
      total,
      items,
      currency: 'SAR',
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    res.json({ phone, total: 0, items: [], currency: 'SAR', error: 'fetch_failed' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();

const GOALS_API = 'https://donate.utq.org.sa/api/v1/orders/report/goals:ED4SFhUVFUcZGBsZHRgeTyEdIiQgHyIhJCMmJSgnKiksKy4tMC8yMQ';

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

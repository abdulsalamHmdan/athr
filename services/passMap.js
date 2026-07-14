// خريطة الرحلة (سيزون باس) — تعريف المراحل على الخادم، مطابق لتطبيق السفير
// (my-app/src/lib/pass.ts). كل 2000 نقطة صندوق، كل 5 صناديق حلقة، و3 حلقات مجمع.

const BOX_STEP = 2000;
const BOXES_PER_RING = 5;
const RINGS_TOTAL = 3;
const PASS_TOTAL = BOX_STEP * BOXES_PER_RING * RINGS_TOTAL; // 30,000

// مكافآت الاستلام — تُصرف كنقاط إضافية (BonusPoints) مرة واحدة لكل مرحلة
const REWARDS = { box: 100, ring: 250, complex: 500 };

const ORDINALS = ['الأولى', 'الثانية', 'الثالثة'];

function buildNodes() {
  const nodes = [];
  for (let r = 1; r <= RINGS_TOTAL; r++) {
    for (let b = 1; b <= BOXES_PER_RING; b++) {
      const overall = (r - 1) * BOXES_PER_RING + b;
      nodes.push({
        id: `box-${overall}`,
        threshold: overall * BOX_STEP,
        reward: REWARDS.box,
        title: `الصندوق ${overall}`,
      });
    }
    nodes.push({
      id: `ring-${r}`,
      threshold: r * BOX_STEP * BOXES_PER_RING,
      reward: REWARDS.ring,
      title: `حلقة التحفيظ ${ORDINALS[r - 1]}`,
    });
  }
  nodes.push({
    id: 'complex',
    threshold: PASS_TOTAL,
    reward: REWARDS.complex,
    title: 'مجمع الأثر',
  });
  return nodes;
}

const PASS_NODES = buildNodes();
const NODE_BY_ID = Object.fromEntries(PASS_NODES.map((n) => [n.id, n]));

module.exports = { PASS_NODES, NODE_BY_ID, PASS_TOTAL, REWARDS };

const GOALS_API = 'https://donate.utq.org.sa/api/v1/orders/report/goals:ED4SFhUVFUcZGBsZHRgeTyEdIiQgHyIhJCMmJSgnKiksKy4tMC8yMQ';
let items = [];
async function fn(number) {
    const r = await fetch(`${GOALS_API}?goal_creator=${encodeURIComponent(number)}`);
    const data = await r.json();
    // console.log("Page:", 0);
    let hs = data.hasMore;
    const total = data?.totals?.total || 0;
    let page = 1;
    items.push(...(data?.items || []));
    while (hs) {
        const r2 = await fetch(`${GOALS_API}?goal_creator=${encodeURIComponent(number)}&page=${page}`);
        const data2 = await r2.json();
        hs = data2.hasMore;
        page++;
        items.push(...(data2?.items || []));
    }

    console.log("Total items:", items.length);
    console.log("Total:", total);
}
fn("542062402");
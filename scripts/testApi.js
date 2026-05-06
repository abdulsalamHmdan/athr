// fetch('https://donate.utq.org.sa/api/v1/goal/list',{method: 'POST',headers:{'k':'ED4SFhUVFUcZGBsZHRgeTyEdIiQgHyIhJCMmJSgnKiksKy4tMC8yMQ'}}).then(r=>r.json()).then(console.log).catch(console.error);



// fetch('http://donate.utq.org.sa/api/v1/clients/fetch?phone=966507499583',{method: 'get',headers:{'k':'ED4SFhUVFUcZGBsZHRgeTyEdIiQgHyIhJCMmJSgnKiksKy4tMC8yMQ'}}).then(r=>r.json()).then(console.log).catch(console.error);

fetch('http://donate.utq.org.sa/api/v1/goals/list?client_id=1759',{method: 'get',headers:{'k':'ED4SFhUVFUcZGBsZHRgeTyEdIiQgHyIhJCMmJSgnKiksKy4tMC8yMQ'}}).then(r=>r.json()).then(console.log).catch(console.error);

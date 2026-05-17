(async () => {
  
  const res = await fetch('https://sfeer.site/api/out/ambassadors', {
    method: 'get',
    headers: {'x-api-key':"a5b9bd2dbb993707e8ed80622349a8c355830681ab7b90944a3987f21e07efc7" },
  });

  result = await res.json();
  console.log(result);
})();
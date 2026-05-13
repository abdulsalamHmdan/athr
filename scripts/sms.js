
(async()=>{
for (let i = 0; i < 10; i++) {
  await fetch("http://10.0.7.145:8080/send-sms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: "msg-001",
      to: "+966507499583",
      message: `تجربة رسالة ${i + 1}`,
    }),
  });
  const r = await fetch("http://10.0.7.145:8080/health");
  const data = await r.json();
  console.log(`Health check after message ${i + 1}:`, data);

}


})();
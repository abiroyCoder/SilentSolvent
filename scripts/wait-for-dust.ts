async function waitForDust() {
  console.log('Waiting for network to be ready...');
  let attempts = 0;
  while (attempts < 120) {
    try {
      const response = await fetch('http://127.0.0.1:8088/api/v4/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'query { blocks(limit: 1) { height } }' })
      });
      const data = await response.json();
      if (data?.data?.blocks?.[0]?.height >= 0) {
        console.log('DUST ready (network is up and syncing blocks).');
        process.exit(0);
      }
    } catch (err) {}
    await new Promise((r) => setTimeout(r, 5000));
    attempts++;
    console.log(`Waiting... attempt ${attempts}`);
  }
  console.error('Network never came up. Is Docker running?');
  process.exit(1);
}

waitForDust();

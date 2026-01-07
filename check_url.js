
async function checkUrl() {
  try {
    const res = await fetch('http://localhost:5174/models/makehuman/plmxs.fbx', { method: 'HEAD' });
    console.log('Status:', res.status);
    console.log('Content-Type:', res.headers.get('content-type'));
    console.log('Content-Length:', res.headers.get('content-length'));
  } catch (err) {
    console.error('Fetch failed:', err);
  }
}

checkUrl();

async function testAnimeSites() {
  const sites = [
    { id: 'animesvision', url: 'https://animesvision.biz' },
    { id: 'animesonlinecc', url: 'https://animesonlinecc.to' },
    { id: 'betteranime', url: 'https://betteranime.net' },
    { id: 'animeroll', url: 'https://animeroll.net' },
    { id: 'animesgratis', url: 'https://animesgratis.vip' },
    { id: 'crunchyroll', url: 'https://www.crunchyroll.com' },
    { id: 'plutotv', url: 'https://pluto.tv' }
  ];

  for (const s of sites) {
    try {
      const res = await fetch(s.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(6000),
        redirect: 'follow'
      });
      console.log(s.id, '-> status:', res.status, 'url:', res.url);
    } catch(e) {
      console.log(s.id, '-> error:', e.message);
    }
  }
}
testAnimeSites();

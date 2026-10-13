async function testSearches() {
  const tests = [
    { nome: 'Animes Vision ?s=', url: 'https://animesvision.biz/?s=one+piece' },
    { nome: 'Animes Vision /search?nome=', url: 'https://animesvision.biz/search?nome=one+piece' },
    { nome: 'AnimesOnlineCC ?s=', url: 'https://animesonlinecc.to/?s=one+piece' },
    { nome: 'AnimesOnlineCC /search/', url: 'https://animesonlinecc.to/search/one+piece' }
  ];
  for (const t of tests) {
    try {
      const res = await fetch(t.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(6000)
      });
      console.log(t.nome, '-> status:', res.status, 'url:', res.url);
      const html = await res.text();
      console.log('   has one piece:', html.toLowerCase().includes('one piece'), 'length:', html.length);
    } catch(e) {
      console.log(t.nome, '-> error:', e.message);
    }
  }
}
testSearches();

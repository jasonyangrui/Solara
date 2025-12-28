const SAFE_HEADERS = ["content-type","cache-control","accept-ranges","content-length","etag"];

function createCorsHeaders(init?: Headers) {
  const headers = new Headers();
  if (init) {
    for (const [k,v] of init.entries()) {
      if (SAFE_HEADERS.includes(k.toLowerCase())) headers.set(k,v);
    }
  }
  headers.set("Access-Control-Allow-Origin","*");
  return headers;
}

async function searchNetease(name: string) {
  const url = `https://music-api.gdstudio.xyz/api.php?types=search&source=netease&name=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  const data = await res.json();
  return { source: "netease", songs: data.result?.songs || [] };
}

async function searchQQ(name: string) {
  const url = `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?p=1&n=20&w=${encodeURIComponent(name)}`;
  const res = await fetch(url, {
    headers: { "User-Agent":"Mozilla/5.0" }
  });
  const data = await res.json();
  // 数据处理成统一格式
  const songs = (data?.data?.song?.list || []).map((item: any) => ({
    id: item.songid,
    name: item.songname,
    artist: item.singer.map((s:any)=>s.name).join(","),
    url: "", // 需要单独解码获取播放链接
    pic: "",
    lyric: ""
  }));
  return { source: "qq", songs };
}

async function searchKuwo(name: string) {
  const url = `http://www.kuwo.cn/api/www/search/searchMusic?key=${encodeURIComponent(name)}`;
  const res = await fetch(url, {
    headers: { "User-Agent":"Mozilla/5.0" }
  });
  const data = await res.json();
  const songs = (data?.data?.list || []).map((item:any)=>({
    id: item.MusicId,
    name: item.MusicName,
    artist: item.Artist,
    url: "",
    pic: item.AlbumPic,
    lyric: ""
  }));
  return { source: "kuwo", songs };
}

export async function onRequest({ request }: { request: Request }) {
  const url = new URL(request.url);
  const platform = (url.searchParams.get("platform") || "netease").toLowerCase();
  const name = url.searchParams.get("name") || "";
  if(!name) return new Response("Missing 'name' parameter", { status: 400 });

  let result;
  if(platform==="netease") result = await searchNetease(name);
  else if(platform==="qq") result = await searchQQ(name);
  else if(platform==="kuwo") result = await searchKuwo(name);
  else return new Response("Invalid platform", {status:400});

  return new Response(JSON.stringify(result), {
    headers: createCorsHeaders()
  });
}

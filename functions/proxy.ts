const SAFE_HEADERS = [
  "content-type",
  "cache-control",
  "accept-ranges",
  "content-length",
  "etag",
  "last-modified",
  "expires",
];

function createCorsHeaders(init?: Headers) {
  const headers = new Headers();
  if (init) {
    for (const [k, v] of init.entries()) {
      if (SAFE_HEADERS.includes(k.toLowerCase())) headers.set(k, v);
    }
  }
  headers.set("Access-Control-Allow-Origin", "*");
  return headers;
}

// 1️⃣ 网易云搜索，保留原有 GD Studio API
async function searchNetease(name: string) {
  const url = `https://music-api.gdstudio.xyz/api.php?types=search&source=netease&name=${encodeURIComponent(
    name
  )}`;
  const res = await fetch(url);
  const data = await res.json();
  return { source: "netease", songs: data.result?.songs || [] };
}

// 2️⃣ QQ 音乐搜索
async function searchQQ(name: string) {
  const url = `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?p=1&n=20&w=${encodeURIComponent(
    name
  )}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const data = await res.json();
  const songs =
    (data?.data?.song?.list || []).map((item: any) => ({
      id: item.songid,
      name: item.songname,
      artist: item.singer.map((s: any) => s.name).join(","),
      url: "", // QQ 播放需要单独解析或代理
      pic: "", // 可以通过 songmid 获取封面
      lyric: "",
    })) || [];
  return { source: "qq", songs };
}

// 3️⃣ 酷我音乐搜索
async function searchKuwo(name: string) {
  const url = `http://www.kuwo.cn/api/www/search/searchMusic?key=${encodeURIComponent(
    name
  )}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const data = await res.json();
  const songs =
    (data?.data?.list || []).map((item: any) => ({
      id: item.MusicId,
      name: item.MusicName,
      artist: item.Artist,
      url: "", // 酷我播放链接需要单独解析或代理
      pic: item.AlbumPic,
      lyric: "",
    })) || [];
  return { source: "kuwo", songs };
}

// 4️⃣ 可选：QQ/酷我播放代理（将真实音频链接返回前端）
async function proxyAudio(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  const headers = createCorsHeaders(res.headers);
  return new Response(res.body, { status: res.status, headers });
}

// 5️⃣ 主请求处理
export async function onRequest({ request }: { request: Request }) {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  if (!["GET", "HEAD"].includes(request.method)) {
    return new Response("Method not allowed", { status: 405 });
  }

  const platform = (url.searchParams.get("platform") || "netease").toLowerCase();
  const name = url.searchParams.get("name") || "";
  const target = url.searchParams.get("target"); // 如果前端传播放链接

  if (target) {
    return proxyAudio(target);
  }

  if (!name) {
    return new Response("Missing 'name' parameter", { status: 400 });
  }

  let result;
  if (platform === "netease") result = await searchNetease(name);
  else if (platform === "qq") result = await searchQQ(name);
  else if (platform === "kuwo") result = await searchKuwo(name);
  else return new Response("Invalid platform", { status: 400 });

  return new Response(JSON.stringify(result), {
    headers: createCorsHeaders(),
  });
}

import { Container, getContainer } from "@cloudflare/containers";
import { env } from "cloudflare:workers";

export class AndrikRadio extends Container {
  defaultPort = 8080;
  requiredPorts = [8080];
  sleepAfter = "1h";
  enableInternet = true;
  pingEndpoint = "health";
  envVars = {
    YOUTUBE_STREAM_KEY: env.YOUTUBE_STREAM_KEY || "",
    PLAYLIST_URL: env.PLAYLIST_URL || "https://andrikmetal.com/api/music/downloads",
    YOUTUBE_LIVE_URL: env.YOUTUBE_LIVE_URL || "https://www.youtube.com/@andrikmetal/live",
    STREAM_COVER: "/tmp/andrik-stream-cover-r565.webp",
    STREAM_COVER_URL: env.STREAM_COVER_URL || "https://andrikmetal.com/assets/andrik-stream-cover-r565.webp",
    STREAM_COVER_FALLBACK_URL: env.STREAM_COVER_FALLBACK_URL || "https://andrikmetal.com/assets/lyra-hero-r563.webp"
  };

  override async onActivityExpired() {
    this.renewActivityTimeout();
  }
}

type Env = {
  RADIO: DurableObjectNamespace<AndrikRadio>;
  PLAYLIST_URL: string;
  YOUTUBE_LIVE_URL: string;
  YOUTUBE_STREAM_KEY?: string;
};

function cors(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET,HEAD,OPTIONS");
  headers.set("cache-control", "no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function containerFetch(env: Env, path: string) {
  const radio = getContainer(env.RADIO, "andrik-radio-main");
  return radio.fetch(new Request(`http://container${path}`, { method: "GET" }));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,HEAD,OPTIONS" } });
    if (url.pathname === "/live") return Response.redirect(env.YOUTUBE_LIVE_URL || "https://www.youtube.com/@andrikmetal/live", 302);
    if (["/", "/status", "/health", "/library"].includes(url.pathname)) {
      try { return cors(await containerFetch(env, url.pathname === "/" ? "/status" : url.pathname)); }
      catch (error) { return Response.json({ ok:false, service:"ANDRIK Metal Radio 24/7", error:String(error) }, { status:503, headers:{ "access-control-allow-origin":"*", "cache-control":"no-store" } }); }
    }
    return Response.json({ ok:true, service:"ANDRIK Metal Radio 24/7", status:"https://radio.andrikmetal.com/status", listen:env.YOUTUBE_LIVE_URL || "https://www.youtube.com/@andrikmetal/live" }, { headers:{ "access-control-allow-origin":"*", "cache-control":"no-store" } });
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    try { await containerFetch(env, "/health"); }
    catch (error) { console.error("ANDRIK Radio heartbeat failed", error); }
  }
};

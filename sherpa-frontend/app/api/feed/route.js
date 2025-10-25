import { BACKEND_URL } from "@/lib/config";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const url = `${BACKEND_URL}/api/v1/feeds${type ? `?type=${encodeURIComponent(type)}` : ""}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    return new Response(JSON.stringify(data), { status: res.status, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Failed to load feed" }), { status: 500 });
  }
}


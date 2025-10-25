import { BACKEND_URL } from "@/lib/config";

export async function POST(request) {
  const payload = await request.json();
  const url = `${BACKEND_URL}/api/v1/analyze-transcript`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), { status: res.status, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Failed to analyze transcript" }), { status: 500 });
  }
}


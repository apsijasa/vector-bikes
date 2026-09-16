import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = () =>
  new Response('{"ok":true,"db":false}', {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

import { env } from "cloudflare:workers";

const isAdmin = (request: Request) => Boolean(env.ADMIN_PIN) && request.headers.get("x-admin-pin") === env.ADMIN_PIN;

export async function POST(request: Request) {
  if (!isAdmin(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const data = await request.formData();
  const image = data.get("image");
  if (!(image instanceof File) || image.size === 0 || image.size > 8_000_000 || !["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
    return Response.json({ error: "Upload a JPG, PNG or WebP smaller than 8 MB" }, { status: 400 });
  }
  const extension = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
  const key = `${crypto.randomUUID()}.${extension}`;
  await env.IMAGES.put(key, image.stream(), { httpMetadata: { contentType: image.type, cacheControl: "public, max-age=31536000, immutable" } });
  return Response.json({ url: `/api/images/${key}` }, { status: 201 });
}

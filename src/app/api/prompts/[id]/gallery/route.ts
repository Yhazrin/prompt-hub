import { NextRequest, NextResponse } from 'next/server';
import { getPrompt, getGalleryImages, addGalleryImage } from '@server/database.mjs';
import fs from 'fs';
import path from 'path';

const GALLERY_DIR = process.env.GALLERY_DIR || path.join(process.env.DATA_DIR || './data', '../images/gallery');
if (!fs.existsSync(GALLERY_DIR)) fs.mkdirSync(GALLERY_DIR, { recursive: true });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const prompt = getPrompt(id);
    if (!prompt) return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    return NextResponse.json(getGalleryImages(id));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const prompt = getPrompt(id);
    if (!prompt) return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get('image') as File;
    if (!file) return NextResponse.json({ error: 'No image file provided' }, { status: 400 });

    const ext = path.extname(file.name).toLowerCase() || '.jpg';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const filePath = path.join(GALLERY_DIR, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    const imageEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      filename,
      url: `/images/gallery/${filename}`,
      original_name: file.name,
      size: file.size,
      uploaded_at: Date.now(),
      synced: false,
      feishu_block_id: null,
      feishu_token: null,
    };

    addGalleryImage(id, imageEntry);
    return NextResponse.json({ success: true, image: imageEntry });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getPrompt, getGalleryImages, markGalleryImageSynced } from '@server/database.mjs';
import { uploadImageToFeishu, appendImageBlockToDoc } from '@server/feishu.mjs';
import fs from 'fs';
import path from 'path';

const GALLERY_DIR = process.env.GALLERY_DIR || path.join(process.env.DATA_DIR || './data', '../images/gallery');

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const { id, imageId } = await params;
    const prompt = getPrompt(id);
    if (!prompt) return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    if (!prompt.wiki_obj_token) return NextResponse.json({ error: 'No Feishu document linked' }, { status: 400 });

    const images = getGalleryImages(id);
    const img = images.find(i => i.id === imageId);
    if (!img) return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    if (img.synced) return NextResponse.json({ error: 'Already synced' }, { status: 400 });

    const localPath = path.join(GALLERY_DIR, img.filename);
    if (!fs.existsSync(localPath)) return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });

    const feishuToken = await uploadImageToFeishu(localPath);
    const blockId = await appendImageBlockToDoc(prompt.wiki_obj_token, feishuToken, 600, 400);
    markGalleryImageSynced(id, imageId, blockId || '', feishuToken);

    return NextResponse.json({ success: true, feishu_token: feishuToken, feishu_block_id: blockId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

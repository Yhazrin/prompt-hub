import { NextRequest, NextResponse } from 'next/server';
import { getGalleryImages, deleteGalleryImage } from '@server/database.mjs';
import fs from 'fs';
import path from 'path';

const GALLERY_DIR = process.env.GALLERY_DIR || path.join(process.env.DATA_DIR || './data', '../images/gallery');

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const { id, imageId } = await params;
    const images = getGalleryImages(id);
    const img = images.find(i => i.id === imageId);
    if (!img) return NextResponse.json({ error: 'Image not found' }, { status: 404 });

    const filePath = path.join(GALLERY_DIR, img.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    deleteGalleryImage(id, imageId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

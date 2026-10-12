import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.zip': 'application/zip',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function isImageExtension(ext: string, mime?: string): boolean {
  if (mime && mime.startsWith('image/')) return true;
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.avif'].includes(
    ext.toLowerCase()
  );
}

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
}

function getUniqueFilePath(dir: string, desiredName: string): { finalName: string; fullPath: string } {
  const safeName = sanitizeFileName(desiredName) || `file-${Date.now()}`;
  const ext = path.extname(safeName);
  const base = path.basename(safeName, ext);

  let candidate = safeName;
  let counter = 1;
  while (fs.existsSync(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ dir, candidate))) {
    candidate = `${base}-${counter}${ext}`;
    counter++;
  }
  return {
    finalName: candidate,
    fullPath: path.join(/*turbopackIgnore: true*/ dir, candidate),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  const defaultFolder = path.join(process.cwd(), 'local-media');

  if (action === 'default') {
    return NextResponse.json({ defaultFolder });
  }

  const folder = searchParams.get('folder') || defaultFolder;
  const file = searchParams.get('file');

  if (!file) {
    return NextResponse.json({ error: 'Missing file parameter' }, { status: 400 });
  }

  try {
    // Prevent directory traversal outside the target folder
    const safeFileName = path.basename(file);
    const fullFilePath = path.join(/*turbopackIgnore: true*/ folder, safeFileName);

    if (!fs.existsSync(/*turbopackIgnore: true*/ fullFilePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(/*turbopackIgnore: true*/ fullFilePath);
    const ext = path.extname(safeFileName).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(safeFileName)}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    console.error('Error serving local media file:', err);
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const rawFolder = formData.get('folderPath') as string | null;
    const defaultFolder = path.join(process.cwd(), 'local-media');
    const targetFolder = rawFolder && rawFolder.trim() ? rawFolder.trim() : defaultFolder;

    // Ensure target folder exists
    if (!fs.existsSync(/*turbopackIgnore: true*/ targetFolder)) {
      fs.mkdirSync(/*turbopackIgnore: true*/ targetFolder, { recursive: true });
    }

    const uploadedFiles = formData.getAll('files') as File[];
    const imageUrlsRaw = formData.get('imageUrls') as string | null;
    const imageUrls: string[] = imageUrlsRaw ? JSON.parse(imageUrlsRaw) : [];

    if ((!uploadedFiles || uploadedFiles.length === 0) && imageUrls.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const savedResults = [];

    const makeTimestampName = (ext: string) => {
      const now = new Date();
      const stamp =
        now.getFullYear().toString() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') +
        '-' +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0') +
        '-' +
        String(now.getMilliseconds()).padStart(3, '0');
      return `pasted-${stamp}${ext || '.png'}`;
    };

    for (const file of uploadedFiles) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      let originalName = file.name || '';
      const extFromMime =
        file.type === 'image/png'
          ? '.png'
          : file.type === 'image/jpeg'
          ? '.jpg'
          : file.type === 'image/gif'
          ? '.gif'
          : file.type === 'image/webp'
          ? '.webp'
          : '';

      if (
        !originalName ||
        originalName === 'image.png' ||
        originalName === 'image.jpg' ||
        originalName === 'blob'
      ) {
        originalName = makeTimestampName(extFromMime || '.png');
      }

      const { finalName, fullPath } = getUniqueFilePath(targetFolder, originalName);
      fs.writeFileSync(/*turbopackIgnore: true*/ fullPath, buffer);

      const ext = path.extname(finalName);
      const isImage = isImageExtension(ext, file.type);
      const normalizedPath = fullPath.replace(/\\/g, '/');
      const serveUrl = `/api/local-media?folder=${encodeURIComponent(
        targetFolder
      )}&file=${encodeURIComponent(finalName)}`;

      savedResults.push({
        fileName: finalName,
        folderPath: targetFolder,
        savedPath: normalizedPath,
        serveUrl,
        isImage,
        size: buffer.length,
        mimeType: file.type || MIME_MAP[ext.toLowerCase()] || 'application/octet-stream',
        markdownLink: isImage
          ? `![${finalName}](${normalizedPath})`
          : `[${finalName}](${normalizedPath})`,
      });
    }

    // Also process any pasted HTML <img> data URLs or remote URLs
    for (const imgUrl of imageUrls) {
      try {
        let buffer: Buffer | null = null;
        let mimeType = 'image/png';
        let desiredName = makeTimestampName('.png');

        if (imgUrl.startsWith('data:image/')) {
          const match = imgUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
          if (match) {
            mimeType = match[1];
            buffer = Buffer.from(match[2], 'base64');
            const ext = mimeType.includes('jpeg') || mimeType.includes('jpg')
              ? '.jpg'
              : mimeType.includes('gif')
              ? '.gif'
              : mimeType.includes('webp')
              ? '.webp'
              : '.png';
            desiredName = makeTimestampName(ext);
          }
        } else if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) {
          const res = await fetch(imgUrl);
          if (res.ok) {
            const ab = await res.arrayBuffer();
            buffer = Buffer.from(ab);
            mimeType = res.headers.get('content-type') || 'image/png';
            const urlPath = new URL(imgUrl).pathname;
            const base = path.basename(urlPath);
            desiredName = base && /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(base)
              ? base
              : makeTimestampName('.png');
          }
        }

        if (buffer && buffer.length > 0) {
          const { finalName, fullPath } = getUniqueFilePath(targetFolder, desiredName);
          fs.writeFileSync(/*turbopackIgnore: true*/ fullPath, buffer);
          const normalizedPath = fullPath.replace(/\\/g, '/');
          const serveUrl = `/api/local-media?folder=${encodeURIComponent(
            targetFolder
          )}&file=${encodeURIComponent(finalName)}`;

          savedResults.push({
            fileName: finalName,
            folderPath: targetFolder,
            savedPath: normalizedPath,
            serveUrl,
            isImage: true,
            size: buffer.length,
            mimeType,
            markdownLink: `![${finalName}](${normalizedPath})`,
          });
        }
      } catch (e) {
        console.warn('Skipped invalid pasted image URL:', e);
      }
    }

    return NextResponse.json({
      folderPath: targetFolder,
      files: savedResults,
    });
  } catch (err) {
    console.error('Failed to copy pasted files to local folder:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save pasted files' },
      { status: 500 }
    );
  }
}

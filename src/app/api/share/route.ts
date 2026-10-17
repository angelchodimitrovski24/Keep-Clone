import { NextRequest, NextResponse } from 'next/server';
import { saveSharedNote, getSharedNote, deleteSharedNote } from '@/lib/shareStorage';
import { Note } from '@/types/note';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const note = body.note as Partial<Note> | undefined;
    const customSlug = typeof body.customSlug === 'string' ? body.customSlug.trim() : undefined;

    if (!note) {
      return NextResponse.json({ error: 'Missing note payload' }, { status: 400 });
    }

    const payload = {
      id: customSlug || undefined,
      originalNoteId: note.id,
      title: (note.title || '').trim(),
      content: note.content || '',
      isList: Boolean(note.isList),
      todos: Array.isArray(note.todos) ? note.todos : [],
      color: note.color || 'default',
      theme: note.theme || 'none',
      labels: Array.isArray(note.labels) ? note.labels : [],
      category: note.category || null,
      images: Array.isArray(note.images) ? note.images : [],
      drawings: Array.isArray(note.drawings) ? note.drawings : [],
      audioRecordings: Array.isArray(note.audioRecordings) ? note.audioRecordings : [],
      createdAt: note.createdAt || Date.now(),
      updatedAt: note.updatedAt || Date.now(),
    };

    const saved = await saveSharedNote(payload);

    return NextResponse.json({
      success: true,
      shortId: saved.id,
      url: `/s/${saved.id}`,
      note: saved,
    });
  } catch (error) {
    console.error('Error creating share link:', error);
    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing note ID' }, { status: 400 });
    }

    const note = await getSharedNote(id, true);
    if (!note) {
      return NextResponse.json({ error: 'Shared note not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      note,
    });
  } catch (error) {
    console.error('Error fetching shared note:', error);
    return NextResponse.json({ error: 'Failed to fetch shared note' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing note ID' }, { status: 400 });
    }

    const deleted = await deleteSharedNote(id);
    return NextResponse.json({ success: deleted });
  } catch (error) {
    console.error('Error deleting shared note:', error);
    return NextResponse.json({ error: 'Failed to delete shared note' }, { status: 500 });
  }
}

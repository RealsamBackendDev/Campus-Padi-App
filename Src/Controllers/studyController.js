const OpenAI = require('openai');
const pdfParse = require('pdf-parse');
const multer = require('multer');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

const chunkText = (text) => {
  const clean = text.replace(/\s+/g, ' ').trim();
  const chunks = [];
  let i = 0;
  while (i < clean.length) {
    chunks.push(clean.slice(i, i + CHUNK_SIZE));
    i += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
};

const embedTexts = async (texts) => {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  });
  return res.data.map((d) => d.embedding);
};

const cosineSimilarity = (a, b) => {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

exports.uploadDocument = async (req, res) => {
  try {
    const { title, courseCode, description } = req.body;

    if (!title || !req.file) {
      return res.status(400).json({ message: 'Title and a PDF or text file are required.' });
    }

    const isPdf = req.file.mimetype === 'application/pdf';
    const isText = req.file.mimetype === 'text/plain';

    if (!isPdf && !isText) {
      return res.status(400).json({ message: 'Only PDF or plain text files are supported.' });
    }

    const text = isPdf
      ? (await pdfParse(req.file.buffer)).text
      : req.file.buffer.toString('utf-8');

    if (!text || text.trim().length < 50) {
      return res.status(400).json({ message: 'Could not extract enough text from this file.' });
    }

    const document = await prisma.studyDocument.create({
      data: {
        school: req.user.school,
        title,
        courseCode: courseCode || null,
        description: description || null,
        fileType: isPdf ? 'PDF' : 'TEXT',
        textContent: text,
        status: 'PENDING',
        uploadedById: req.user.id,
      },
    });

    const chunks = chunkText(text);

    for (let i = 0; i < chunks.length; i += 20) {
      const batch = chunks.slice(i, i + 20);
      const embeddings = await embedTexts(batch);
      await prisma.studyChunk.createMany({
        data: batch.map((content, idx) => ({
          documentId: document.id,
          chunkIndex: i + idx,
          content,
          embedding: embeddings[idx],
        })),
      });
    }

    const ready = await prisma.studyDocument.update({
      where: { id: document.id },
      data: { status: 'READY' },
      include: { _count: { select: { chunks: true } } },
    });

    res.status(201).json({
      message: `Document processed into ${ready._count.chunks} chunks. Ready for Study Buddy.`,
      data: ready,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error processing document', error: error.message });
  }
};

exports.getDocuments = async (req, res) => {
  try {
    const documents = await prisma.studyDocument.findMany({
      where: { school: req.user.school, status: 'READY' },
      select: {
        id: true,
        title: true,
        courseCode: true,
        description: true,
        fileType: true,
        createdAt: true,
        uploadedBy: { select: { name: true } },
        _count: { select: { chunks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ message: 'Documents retrieved successfully', data: documents });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving documents', error: error.message });
  }
};

exports.searchDocuments = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 3) {
      return res.status(400).json({ message: 'Search query must be at least 3 characters.' });
    }

    const chunks = await prisma.studyChunk.findMany({
      where: { document: { school: req.user.school, status: 'READY' } },
      include: {
        document: { select: { id: true, title: true, courseCode: true } },
      },
    });

    if (chunks.length === 0) {
      return res.json({ message: 'No knowledge base yet for your school.', data: [] });
    }

    const [queryEmbedding] = await embedTexts([q.trim()]);

    const scored = chunks
      .map((chunk) => ({
        documentId: chunk.document.id,
        title: chunk.document.title,
        courseCode: chunk.document.courseCode,
        snippet: chunk.content.slice(0, 300),
        score: cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    res.json({ message: 'Search completed', data: scored });
  } catch (error) {
    res.status(500).json({ message: 'Error searching documents', error: error.message });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const document = await prisma.studyDocument.findFirst({
      where: {
        id,
        OR: [
          { uploadedById: req.user.id },
          { school: req.user.school, ...(req.user.role === 'SUPER_ADMIN' ? {} : {}) },
        ],
      },
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found.' });
    }

    if (document.uploadedById !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only the uploader or a super admin can delete.' });
    }

    await prisma.studyDocument.delete({ where: { id } });
    res.json({ message: 'Document deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting document', error: error.message });
  }
};
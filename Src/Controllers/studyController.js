const pdfParse = require('pdf-parse');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const EMBEDDING_MODEL = 'gemini-embedding-001';

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

const CHAT_MODEL = 'gemini-3.8-flash';
const FREE_WEEKLY_LIMIT = 5;

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
  const all = [];

  for (let i = 0; i < texts.length; i += 50) {
    const batch = texts.slice(i, i + 50);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: batch.map((text) => ({
            model: `models/${EMBEDDING_MODEL}`,
            content: { parts: [{ text }] },
          })),
        }),
      }
    );

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message);
    }

    all.push(...data.embeddings.map((e) => e.values));
  }

  return all;
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
    console.error('Study upload error:', error.message);
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
    console.error('Study documents error:', error.message);
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
    console.error('Study search error:', error.message);
    res.status(500).json({ message: 'Error searching documents', error: error.message });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const document = await prisma.studyDocument.findFirst({
      where: { id },
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
    console.error('Study delete error:', error.message);
    res.status(500).json({ message: 'Error deleting document', error: error.message });
  }
};


exports.askQuestion = async (req, res) => {
  try {
    const { question, mode } = req.body;
    const userId = req.user.id;

    if (!question || question.trim().length < 5) {
      return res.status(400).json({ message: 'Please ask a fuller question.' });
    }

    const assignmentMode = mode === 'assignment';

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentCount = await prisma.studyQuery.count({
      where: { userId, createdAt: { gte: weekAgo } },
    });

    if (req.user.role === 'STUDENT' && recentCount >= FREE_WEEKLY_LIMIT) {
      return res.status(429).json({
        message: `You've used your ${FREE_WEEKLY_LIMIT} free questions this week. Pro subscription is coming soon — meanwhile, upload materials to grow your school's knowledge base.`,
      });
    }

    const chunks = await prisma.studyChunk.findMany({
      where: { document: { school: req.user.school, status: 'READY' } },
      include: { document: { select: { title: true, courseCode: true } } },
    });

    if (chunks.length === 0) {
      return res.status(400).json({ message: 'No materials uploaded for your school yet. Upload past questions first.' });
    }

    const [questionEmbedding] = await embedTexts([question.trim()]);

    const topChunks = chunks
      .map((chunk) => ({ chunk, score: cosineSimilarity(questionEmbedding, chunk.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .filter((x) => x.score > 0.3);

        const contextText = topChunks.length
      ? topChunks
          .map((x, i) => {
            const code = x.chunk.document.courseCode
              ? ' — ' + x.chunk.document.courseCode
              : '';
            return `[${i + 1}] (${x.chunk.document.title}${code}): ${x.chunk.content}`;
          })
          .join('\n\n')
      : 'No relevant material found in the knowledge base.';

    const prompt =
      'You are Study Buddy, a tutor for Nigerian university students.\n\n' +
      'RULES:\n' +
      '- Answer using ONLY the context below. If the answer is not there, say exactly: "I don\'t have this in your school\'s materials yet" and suggest what the student could upload.\n' +
      '- Cite sources inline like [1], [2] matching the context numbers.\n' +
      '- Use short bullet points in study-note style. Never write an essay that can be copy-pasted as an assignment answer.\n\n' +
      `CONTEXT:\n${contextText}\n\n` +
      `QUESTION: ${question.trim()}` +
      (assignmentMode
        ? '\n\nASSIGNMENT MODE: Do NOT give the answer directly. Guide the student with one small step or one question at a time, citing relevant context.'
        : '');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${CHAT_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message);
    }

    const answer = data.candidates[0].content.parts[0].text;

    const sources = topChunks.map((x) => ({
      title: x.chunk.document.title,
      courseCode: x.chunk.document.courseCode,
      match: Math.round(x.score * 100),
    }));

    await prisma.studyQuery.create({
      data: {
        userId,
        question: question.trim(),
        answer,
        sources,
        mode: assignmentMode ? 'ASSIGNMENT' : 'STUDY',
      },
    });

    res.json({
      message: 'Answer ready',
      data: { answer, sources, questionsUsed: recentCount + 1, weeklyLimit: FREE_WEEKLY_LIMIT },
    });
  } catch (error) {
    console.error('Study ask error:', error.message);
    res.status(500).json({ message: 'Error answering question', error: error.message });
  }
};

exports.getQueryHistory = async (req, res) => {
  try {
    const queries = await prisma.studyQuery.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, question: true, answer: true, sources: true, mode: true, createdAt: true },
    });
    res.json({ message: 'History retrieved', data: queries });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving history', error: error.message });
  }
};
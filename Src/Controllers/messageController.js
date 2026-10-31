exports.sendMessage = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { body } = req.body;
    const userId = req.user.id;

    if (!body?.trim() && !req.file) {
      return res.status(400).json({ message: 'Message text or a file is required.' });
    }

    const request = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: { artisan: true },
    });

    if (!request) {
      return res.status(404).json({ message: 'Request not found.' });
    }

    const isParticipant =
      request.studentId === userId || request.artisan?.userId === userId;
    if (!isParticipant) {
      return res.status(403).json({ message: 'You are not a participant in this job.' });
    }

    if (!['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(request.status)) {
      return res.status(400).json({ message: 'Messaging opens once the artisan accepts the job.' });
    }

    const message = await prisma.message.create({
      data: {
        requestId,
        senderId: userId,
        body: body?.trim() || null,
        fileUrl: req.file ? req.file.path : null,
        fileName: req.file ? req.file.originalname : null,
      },
      include: { sender: { select: { id: true, name: true } } },
    });

    res.status(201).json({ message: 'Message sent', data: message });
  } catch (error) {
    res.status(500).json({ message: 'Error sending message', error: error.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.id;

    const request = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: { artisan: true },
    });

    if (!request) {
      return res.status(404).json({ message: 'Request not found.' });
    }

    const isParticipant =
      request.studentId === userId || request.artisan?.userId === userId;
    if (!isParticipant) {
      return res.status(403).json({ message: 'You are not a participant in this job.' });
    }

    const messages = await prisma.message.findMany({
      where: { requestId },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { id: true, name: true } } },
    });

    await prisma.message.updateMany({
      where: { requestId, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });

    res.json({ message: 'Messages retrieved successfully', data: messages });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving messages', error: error.message });
  }
};

exports.sendListingMessage = async (req, res) => {
  try {
    const { listingId } = req.params;
    const { body } = req.body;
    const userId = req.user.id;

    if (!body?.trim() && !req.file) {
      return res.status(400).json({ message: 'Message text or a file is required.' });
    }

    const listing = await prisma.marketplaceListing.findUnique({ where: { id: listingId } });
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found.' });
    }
    if (listing.school !== req.user.school) {
      return res.status(403).json({ message: 'This listing is not on your campus.' });
    }
    if (listing.userId === userId) {
      return res.status(400).json({ message: 'You cannot message yourself about your own listing.' });
    }

    const message = await prisma.message.create({
      data: {
        requestId: null,
        listingId,
        senderId: userId,
        body: body?.trim() || null,
        fileUrl: req.file ? req.file.path : null,
        fileName: req.file ? req.file.originalname : null,
      },
      include: { sender: { select: { id: true, name: true } } },
    });

    res.status(201).json({ message: 'Message sent', data: message });
  } catch (error) {
    res.status(500).json({ message: 'Error sending message', error: error.message });
  }
};

exports.getListingMessages = async (req, res) => {
  try {
    const { listingId } = req.params;
    const userId = req.user.id;

    const listing = await prisma.marketplaceListing.findUnique({ where: { id: listingId } });
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found.' });
    }

    const hasMessaged = await prisma.message.findFirst({
      where: { listingId, senderId: userId },
    });
    const isParticipant = listing.userId === userId || Boolean(hasMessaged);
    if (!isParticipant) {
      return res.status(403).json({ message: 'Send the first message to open this conversation.' });
    }

    const messages = await prisma.message.findMany({
      where: { listingId },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { id: true, name: true } } },
    });

    await prisma.message.updateMany({
      where: { listingId, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });

    res.json({ message: 'Messages retrieved successfully', data: messages });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving messages', error: error.message });
  }
};
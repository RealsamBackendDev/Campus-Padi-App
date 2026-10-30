exports.initializePayment = async (req, res) => {
  try {
    const { serviceRequestId } = req.body;
    const userId = req.user.id;

    const request = await prisma.serviceRequest.findUnique({
      where: { id: serviceRequestId },
      include: { student: true },
    });

    if (!request || request.studentId !== userId) {
      return res.status(404).json({ message: 'Request not found.' });
    }
    if (request.status !== 'COMPLETED') {
      return res.status(400).json({ message: 'You can only pay for completed jobs.' });
    }
    if (request.paid) {
      return res.status(400).json({ message: 'This job has already been paid for.' });
    }
        if (!request.priceApproved) {
      return res.status(400).json({ message: 'The quoted price has not been approved yet.' });
    }
    if (!request.price || request.price <= 0) {
      return res.status(400).json({ message: 'No price set for this job.' });
    }

    const email = request.student.email || `${request.student.phone}@campuspadi.ng`;

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Math.round(request.price * 100),
        reference: `CP-${request.id}-${Date.now()}`,
        metadata: { serviceRequestId: request.id, studentId: userId },
        callback_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/callback`,
      }),
    });

    const data = await response.json();
    if (!data.status) {
      return res.status(400).json({ message: data.message || 'Payment initialization failed' });
    }

    res.status(200).json({
      message: 'Payment initialized',
      authorizationUrl: data.data.authorization_url,
      reference: data.data.reference,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error initializing payment', error: error.message });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;
    const userId = req.user.id;

    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });
    const data = await response.json();

    if (!data.status || data.data.status !== 'success') {
      return res.status(400).json({ message: 'Payment not confirmed. Try again.' });
    }

    const serviceRequestId = data.data.metadata?.serviceRequestId;
    const request = await prisma.serviceRequest.findUnique({ where: { id: serviceRequestId } });
    if (!request || request.studentId !== userId) {
      return res.status(403).json({ message: 'Request not found.' });
    }

    await prisma.serviceRequest.update({
      where: { id: serviceRequestId },
      data: { paid: true, paymentReference: reference },
    });

    res.status(200).json({ message: 'Payment confirmed', paid: true });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying payment', error: error.message });
  }
};
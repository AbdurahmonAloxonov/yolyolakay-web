'use client';

import React, { use } from 'react';
import { BiddingContent } from './BiddingContent';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function BiddingPage({ params }: PageProps) {
  const { id } = use(params);

  return <BiddingContent tripId={id} />;
}

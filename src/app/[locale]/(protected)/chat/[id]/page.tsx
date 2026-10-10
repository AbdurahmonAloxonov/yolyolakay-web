'use client';

import React, { use } from 'react';
import { ChatContent } from './ChatContent';

// Marshrut kaliti 2026-07-17'da BOOKING'dan SAFAR'ga o'zgardi: yangi Gateway'da suhbat
// (ride_id + peer_id) juftligi bilan aniqlanadi (`/notifications/history?peer_id=&ride_id=`),
// booking id umuman ishlatilmaydi. `peer` — suhbatdoshning user id'si.
interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ peer?: string; price?: string; name?: string; avatar?: string }>;
}

export default function ChatPage({ params, searchParams }: PageProps) {
  const { id } = use(params);
  const { peer, price, name, avatar } = use(searchParams);
  const agreedPrice = price ? Number(price) : 0;

  return (
    <ChatContent
      // `direct` = safarsiz suhbat (safar tugagan yoki umuman bo'lmagan).
      // Bo'sh segment marshrutga tushmagani uchun shu so'z ishlatiladi,
      // serverga esa bo'sh `ride_id` ketadi.
      rideId={id === 'direct' ? '' : id}
      peerId={peer || ''}
      agreedPrice={agreedPrice}
      peerName={name || ''}
      // Suhbatdosh surati havola orqali keladi (ismi ham shunday) — chat
      // sahifasi suhbatdoshning profilini alohida so'ramaydi.
      peerAvatar={avatar || ''}
    />
  );
}

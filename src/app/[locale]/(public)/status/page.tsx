import type { Metadata } from 'next';
import StatusClient from './StatusClient';

export const metadata: Metadata = {
  title: 'Xizmat holati',
  description: "Nima ishlayapti, nima yo'q — jonli tekshiruv.",
  // Bu sahifa qidiruvda chiqmasin: u nosozlik paytidagi yordam sahifasi,
  // brend natijasi emas.
  robots: { index: false, follow: false },
};

export default function StatusPage() {
  return <StatusClient />;
}

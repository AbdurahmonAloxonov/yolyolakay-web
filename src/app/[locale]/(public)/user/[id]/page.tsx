import UserProfileClient from './UserProfileClient';

/**
 * BEGONA foydalanuvchi profili — odatda haydovchi.
 *
 * Yo'l `(public)` guruhida: qidiruv va safar sahifasi mehmonga ochiq
 * (`BROWSE_PATHS`), ya'ni ro'yxatdan o'tmagan odam ham haydovchini ko'ra
 * olishi kerak. Aks holda "bu kim?" degan savol login devoriga urilardi.
 *
 * ⚠️ Ma'lumotning O'ZI baribir tokenga bog'liq: `GET /users/{id}` mehmonga
 * 401 qaytaradi. Shuning uchun mijoz qismi xatoni ochiq ko'rsatadi.
 */
export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UserProfileClient id={id} />;
}

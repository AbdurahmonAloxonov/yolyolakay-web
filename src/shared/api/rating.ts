import { api, unwrap } from './client';
import type { Feedback, FeedbackList, SubmitFeedbackRequest } from './types/rating';

/**
 * Rating — FAQAT completed safardan keyin, haydovchi <-> yo'lovchi o'zaro.
 * Endpoint BIRLIKDA (/rating), reviewer_id tokendan (yuborilmaydi).
 */
export async function submitFeedback(body: SubmitFeedbackRequest): Promise<Feedback> {
  // skipErrorToast: RatingModal xatoni o'zi tushunarli ko'rsatadi.
  const res = await api.post('/rating', body, { skipErrorToast: true });
  return unwrap<Feedback>(res);
}

/**
 * SHARHLAR RO'YXATI — `GET /rating?reviewee_id=`.
 *
 * 🔑 MEHMONLARGA OCHIQ (jonli o'lchov: tokensiz 200) — ya'ni kirmagan
 * odam ham ko'radi. Bu muhim: safar sahifasi mehmon rejimida ochiladi va
 * qaror aynan o'sha yerda qabul qilinadi.
 *
 * `withComment` standart YOQIQ: matnsiz baholar ro'yxatni suyultiradi,
 * odam bu yerga raqamni emas, GAPNI o'qigani keladi.
 *
 * skipErrorToast: sharhlar uzilsa sahifaning qolgani ishlashi kerak —
 * butun ekranni xato holatiga o'tkazish nomutanosib bo'lardi.
 */
export async function getFeedback(
  revieweeId: string,
  { limit = 20, offset = 0, withComment = true } = {}
): Promise<FeedbackList> {
  const res = await api.get('/rating', {
    params: {
      reviewee_id: revieweeId,
      limit,
      offset,
      ...(withComment ? { with_comment: true } : {}),
    },
    skipErrorToast: true,
  });
  const body = unwrap<FeedbackList>(res);
  // Bo'sh natijada `[]` keladi (o'lchandi), lekin backendning boshqa
  // ro'yxatlari `null` qaytaradi — ikkalasiga ham tayyor turamiz.
  return {
    items: body?.items ?? [],
    total: body?.total ?? 0,
    average: body?.average ?? 0,
  };
}

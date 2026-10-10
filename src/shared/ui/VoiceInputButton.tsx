'use client';

import React from 'react';
import { Mic, MicOff } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useTr } from '@/shared/lib/useTr';

/**
 * OVOZLI KIRITISH — shahar nomini aytib yozdirish.
 *
 * 🔴 NEGA KERAK: shahar nomini yozish keksa foydalanuvchi uchun to'siq —
 * klaviatura tili, lotin/kirill, apostrof. Aytish esa tabiiy.
 *
 * ⚠️ HALOL CHEKLOV: nutqni tanish BRAUZERNING ishi, biznikida emas.
 * O'zbek tili (`uz-UZ`) hamma brauzerda ham qo'llab-quvvatlanmaydi va
 * tanish sifati bizga bog'liq emas. Shuning uchun:
 *   • API bo'lmasa tugma UMUMAN chizilmaydi (o'lik tugma eng yomoni);
 *   • xato bo'lsa jimgina to'xtaydi — forma buzilmaydi, matn yo'qolmaydi;
 *   • natija maydonga QO'SHILADI, ustiga yozilmaydi.
 *
 * Ya'ni "har doim ishlaydi" deb va'da bermaymiz — "hech qachon
 * xalaqit bermaydi" deb kafolat beramiz.
 */
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

const getRecognition = (): SpeechRecognitionLike | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
};

export function VoiceInputButton({
  onResult,
  className = '',
  label,
}: {
  onResult: (text: string) => void;
  className?: string;
  /**
   * Tugmaning ovozli yorlig'i. Standarti "Ovoz bilan aytish", lekin
   * chaqiruvchi aniqroq ayta oladi: qidiruvda tugma BITTA maydonni emas,
   * butun YO'NALISHNI to'ldiradi va odam buni oldindan bilishi kerak
   * (aks holda faqat shahar nomini aytadi).
   */
  label?: string;
}) {
  const tr = useTr();
  const locale = useLocale();
  const title = label ?? tr('Ovoz bilan aytish', 'Сказать голосом', 'Speak');
  const [supported, setSupported] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);

  React.useEffect(() => {
    // Faqat MAVJUDLIGINI tekshiramiz — obyekt bosilganda yaratiladi.
    setSupported(getRecognition() !== null);
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* to'xtatib bo'lmasa ham zarari yo'q */
      }
    };
  }, []);

  if (!supported) return null;

  const start = () => {
    if (listening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* jim */
      }
      setListening(false);
      return;
    }

    const recognition = getRecognition();
    if (!recognition) return;
    recognitionRef.current = recognition;

    // Til — interfeys tiliga qarab. O'zbek tili qo'llab-quvvatlanmasa
    // brauzer o'zi eng yaqinini oladi yoki `onerror` beradi.
    recognition.lang = locale === 'ru' ? 'ru-RU' : locale === 'en' ? 'en-US' : 'uz-UZ';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript;
      if (typeof text === 'string' && text.trim()) onResult(text.trim());
    };
    // Xato ekranga CHIQARILMAYDI: odam tugmani bosdi, hech nima bo'lmadi —
    // bu tushunarli. Qizil xabar esa "ilova buzuq" degandek ko'rinadi.
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  return (
    <button
      type="button"
      onClick={start}
      aria-label={title}
      title={title}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
        listening
          ? 'animate-pulse border-accent bg-brand-pink-light dark:bg-accent/10 text-accent'
          : 'border-border text-text-muted hover:border-accent hover:text-accent'
      } ${className}`}
    >
      {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </button>
  );
}

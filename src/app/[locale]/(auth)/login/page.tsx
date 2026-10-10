'use client';

import React, { useState, useEffect } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { useLocale } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  sendOtp,
  verifyOtp,
  loginWithPassword,
  setupPassword,
  isNewDeviceError,
  isAccountLockedError,
  isSmsNotSentError,
} from '@/shared/api/auth';
import type { OtpPurpose } from '@/shared/api/types/auth';
import { localizeBackendMessage } from '@/shared/lib/format';
import { getMe, updateProfile } from '@/shared/api/users';
import type { TokenResponse } from '@/shared/api/types/auth';
import {
  setStoredUserName,
  setStoredUserId,
  setTokens,
  decodeUserIdFromToken,
} from '@/shared/lib/token';
import { userFacingError, splitFullName } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { OTPInput } from '@/shared/ui/OTPInput';
import { User, ShieldCheck, Phone, KeyRound, ArrowLeft, Car, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTr } from '@/shared/lib/useTr';
import { useRetainedState, clearRetained } from '@/shared/lib/useSessionState';
import { AnalyticsEvent, logEvent } from '@/shared/lib/analytics';
import { clearReferral, readReferral } from '@/shared/lib/referral';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/shared/model/uiStore';
import { AuthSupportLink } from '@/features/support/AuthSupportLink';
import { getAccessToken } from '@/shared/lib/token';

const cleanPhone = (val: string) => val.replace(/[\s\-\(\)]/g, '');

/**
 * Auth — IKKI ANIQ REJIM (2026-07-22 mahsulot qarori):
 *  1) KIRISH (login): telefon + PAROL, SMS/kodSIZ — POST /auth/login {phone_number, password}
 *     (jonli tasdiqlangan). Parol ro'yxatdan o'tishda o'rnatiladi.
 *  2) RO'YXATDAN O'TISH (register): telefon -> 5 xonali OTP -> verify-otp yangi hisob ochadi
 *     -> ism/jins + PAROL so'raladi. Profil PUT /users/profile, parol POST /auth/setup-password.
 *
 * Ya'ni: KOD odatda FAQAT ro'yxatdan o'tishda so'raladi; kirish parol bilan (kodsiz).
 *
 * ISTISNO — YANGI QURILMA (backend 2026-08-09): parol to'g'ri bo'lsa ham, `X-Device-ID`
 * foydalanuvchining ochiq sessiyalari orasida bo'lmasa, backend O'ZI SMS yuboradi va
 * `403 {"error":"new_device"}` qaytaradi. Bunda KIRISH rejimi ham `otp` qadamiga o'tadi
 * (shuning uchun OTP bloki `login` rejimida ham chiziladi). Biz qayta SMS YUBORMAYMIZ —
 * kod allaqachon ketgan, `sendOtp` chaqirsak ikkinchi SMS va 429 (3/daqiqa) bo'lardi.
 */
type Mode = 'login' | 'register' | 'reset';
/**
 * `role` — «yo'lovchimi haydovchimi» (egasi, 22.09.2026): kod
 * tasdiqlangandan KEYIN, hisob ma'lumotlarini so'rashdan OLDIN.
 * Tartib ataylab shunday — javob qolgan hamma narsaga ma'no beradi
 * (ro'yxatdan o'tish oxirida qayerga tushishi ham shunga bog'liq).
 */
type Step = 'phone' | 'otp' | 'role' | 'info';
type SignupRole = 'passenger' | 'driver';

/**
 * OTP `type` — backend MAJBURIY talab qiladi (2026-08-03):
 *   register  — birinchi ro'yxatdan o'tish, login — boshqa qurilmadan kirish,
 *   frgt_pswd — parolni unutganlar. Usiz 400: "missing 'type'".
 */
const OTP_PURPOSE: Record<Mode, OtpPurpose> = {
  register: 'register',
  login: 'login',
  reset: 'frgt_pswd',
};

export default function LoginPage() {
  const locale = useLocale();
  const router = useRouter();
  const { activeRole, setActiveRole } = useUIStore();
  const tr = useTr();
  const queryClient = useQueryClient();

  /*
   * TAKLIF BILAN KELGANMI — faqat KO'RSATISH uchun.
   *
   * ⚠️ `useEffect`, to'g'ridan o'qish EMAS: `localStorage` serverda
   * yo'q va birinchi chizishda qiymat boshqacha bo'lib, hydration
   * xatosi berardi.
   *
   * Kimning taklifi ekani AYTILMAYDI: bizda kodni ismga aylantiradigan
   * ruchka yo'q va «Akmal sizni chaqirdi» deb yozish to'qima bo'lardi.
   */
  const [invitedBy, setInvitedBy] = useState(false);
  useEffect(() => setInvitedBy(!!readReferral()), []);

  // TIL ALMASHTIRILGANDA FORMA TOZALANMASLIGI UCHUN `useRetainedState`.
  //
  // Til URL segmenti bo'lgani uchun uni almashtirish butun `[locale]` daraxtini
  // qayta mount qiladi va oddiy `useState` boshlang'ich qiymatiga qaytadi.
  // Jonli tekshirilgan: telefon `+998(90) 123-45-67` -> RU bosilgach `+998 `.
  //
  // Saqlash FAQAT XOTIRADA (diskka hech narsa yozilmaydi) — parol va OTP ham
  // shu yerda, chunki ular React holatida qanday tursa shunday turadi, yangi
  // saqlash joyi ochilmaydi. Muvaffaqiyatli kirishdan keyin hammasi tozalanadi.
  const [mode, setMode] = useRetainedState('login-mode', 'login') as [Mode, (v: Mode) => void];
  const [step, setStep] = useRetainedState('login-step', 'phone') as [Step, (v: Step) => void];
  const [password, setPassword] = useRetainedState('login-password', '');
  const [phone, setPhone] = useRetainedState('login-phone', '');
  const [smsCode, setSmsCode] = useRetainedState('login-sms', '');
  const [resendIn, setResendIn] = useState(0); // OTP qayta yuborishgacha qolgan soniya
  // Kod noto'g'ri kiritildi — `OTPInput` qatorni qizartirib chayqaydi.
  // Toast bilan birga ishlaydi: toast o'qilmasa ham xato KATAKDA ko'rinadi.
  const [otpError, setOtpError] = useState(false);
  /**
   * Kod TO'G'RI chiqdi — `OTPInput` kataklarni yashil yoqadi. Sahifa shu
   * rang o'tishidan keyin almashadi: aks holda odam tasdiqni umuman
   * ko'rmasdi, ekran shunchaki o'zgarardi.
   */
  const [otpWin, setOtpWin] = useState(false);
  const [regName, setRegName] = useRetainedState('login-regname', '');
  const [regGenderRaw, setRegGenderRaw] = useRetainedState('login-reggender', '');
  const regGender = (regGenderRaw || null) as 'male' | 'female' | null;
  const setRegGender = (v: 'male' | 'female' | null) => setRegGenderRaw(v ?? '');
  const [regPassword, setRegPassword] = useRetainedState('login-regpassword', '');
  // Tanlangan rol — `role` qadamida. Bo'sh satr = hali tanlanmagan.
  const [regRoleRaw, setRegRoleRaw] = useRetainedState('login-regrole', '');
  const regRole = (regRoleRaw || null) as SignupRole | null;
  /**
   * Shu sahifada kamida bitta xato bo'ldimi.
   *
   * 🔴 NEGA SAQLANADI: toast 4 soniyada so'nadi va odam xato bilan
   * yolg'iz qoladi — «SMS kelmadi» holatida aynan shunday bo'ladi.
   * Xatodan keyin yordam havolasi sokin yozuvdan KO'RINADIGAN
   * havolaga aylanadi va shundayligicha qoladi.
   */
  const [hadError, setHadError] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Kirgan foydalanuvchi yo'naltirilayotganda forma "chaqnab" ketmasin.
  const [redirecting, setRedirecting] = useState(false);
  // verify-otp javobi (token'lar) — yangi user 'info' qadamini yakunlaguncha saqlanadi.
  const [authBody, setAuthBody] = useState<TokenResponse | null>(null);

  useEffect(() => {
    setMounted(true);
    // PWA `start_url` = `/login`: ilova aynan shu ekrandan ochiladi. Allaqachon
    // kirgan foydalanuvchiga login formasini ko'rsatish noto'g'ri bo'lardi —
    // uni darhol o'z paneliga o'tkazamiz (rolga qarab).
    if (getAccessToken()) {
      setRedirecting(true);
      router.replace(`/${locale}/${activeRole === 'driver' ? 'dashboard' : 'search'}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  // ======= VALIDATSIYA =======
  const phoneRule = zod.string().refine((val) => /^\+998\d{9}$/.test(cleanPhone(val)), {
    message: tr("Telefon raqami noto'g'ri", 'Неверный формат', 'Invalid phone number'),
  });
  const phoneSchema = zod.object({ phone: phoneRule });
  // DIQQAT: ko'rinadigan telefon maydoni `useState` EMAS, react-hook-form
  // boshqaruvida. Til almashtirilganda daraxt qayta mount bo'ladi va RHF ham
  // `defaultValues` ga qaytadi — shuning uchun boshlang'ich qiymat xotirada
  // saqlangan qiymatdan olinadi (jonli tekshirilgan: usiz raqam `+998 ` ga
  // tozalanardi).
  const [phoneDraft, setPhoneDraft] = useRetainedState('login-phone-draft', '+998 ');
  const phoneForm = useForm({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: phoneDraft },
  });

  // Har bir o'zgarishni xotiraga yozamiz — keyingi mount shu yerdan tiklanadi.
  useEffect(() => {
    const sub = phoneForm.watch((values) => {
      if (typeof values.phone === 'string') setPhoneDraft(values.phone);
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneForm]);

  const resetFlow = () => {
    setStep('phone');
    setSmsCode('');
    // Kirish oqimida telefon tozalanadi — parol undan qolib ketmasin (boshqa
    // raqamga tegishli parol formada turgani chalg'itadi).
    setPassword('');
    setResendIn(0);
    setRegName('');
    setRegGender(null);
    setRegPassword('');
    setRegRoleRaw('');
    setAuthBody(null);
    phoneForm.reset({ phone: '+998 ' });
  };

  // Rejimni almashtirish — oqimni toza holatga qaytaramiz.
  const switchMode = (next: Mode) => {
    setMode(next);
    setPassword('');
    resetFlow();
  };

  const onApiError = (err: any, fallback: string) => {
    // Yordam havolasi shu paytdan boshlab ko'rinadigan bo'lib qoladi.
    setHadError(true);
    // 429/5xx/tarmoq — global axios interceptor tushunarli toast beradi, dublikat chiqarmaymiz.
    const status = err.response?.status;
    if (!err.response || status === 429 || status >= 500) return;
    const msg =
      err.response?.data?.error?.message ||
      err.response?.data?.error ||
      err.response?.data?.message;
    // `userFacingError` — ichki baza xatosi ekranga chiqmasin.
    toast.error(userFacingError(msg, fallback));
  };

  // Token olingach: saqlash + (yangi user bo'lsa) parol/profil to'ldirish + rolga qarab yo'naltirish.
  const finishAuth = async (
    body: TokenResponse,
    profileExtra?: {
      name?: string;
      gender?: 'male' | 'female' | null;
      password?: string;
      role?: SignupRole | null;
    }
  ) => {
    const token = body?.access_token;
    if (!token) {
      toast.error(tr('Token topilmadi', 'Токен не найден', 'Token not found'));
      return;
    }
    setTokens(token, body.refresh_token);
    // Til almashuvi uchun xotirada saqlangan forma qiymatlari (parol/OTP ham)
    // endi keraksiz — chiqib qayta kirganda eski qiymatlar to'ldirilib
    // qolmasligi uchun tozalaymiz.
    clearRetained('login-');
    localStorage.setItem('user_phone', phone);
    // O'z id — JWT `sub` claim'idan (WS/rating/GET users/{id} uchun ham kerak bo'ladi).
    const uid = decodeUserIdFromToken(token);
    setStoredUserId(uid);
    queryClient.invalidateQueries({ queryKey: ['profile'] });

    // Ro'yxatdan o'tishda parol o'rnatamiz — keyingi safar kirishlar kodsiz (parol bilan) bo'ladi.
    if (profileExtra?.password) {
      try {
        await setupPassword(profileExtra.password);
      } catch {
        // parolni keyin profil sozlamalarida ham o'rnatish mumkin — ro'yxatdan o'tishni to'xtatmaymiz
      }
    }

    // Yangi hisob placeholder ism bilan ochiladi — ism/jinsni PUT /users/profile yozadi
    // (POST /users mavjud userda 409; first_name VA last_name backend'da qat'iy majburiy,
    // bo'sh/probel last_name 400 — jonli tasdiqlangan 2026-07-18).
    if (profileExtra?.name || profileExtra?.gender) {
      const trimmed = (profileExtra.name ?? '').trim();
      const names = splitFullName(trimmed);
      if (names.first_name && names.last_name) {
        try {
          await updateProfile({
            first_name: names.first_name,
            last_name: names.last_name,
            ...(profileExtra.gender ? { gender: profileExtra.gender } : {}),
          });
        } catch {
          // profil keyin ham tahrirlanadi — ro'yxatdan o'tishni to'xtatmaymiz
        }
      }
      setStoredUserName(trimmed);
    }

    /*
     * TAKLIF HISOBI — faqat YANGI hisob ochilganda.
     *
     * `profileExtra?.name` — ro'yxatdan o'tish oqimining oxirgi
     * qadamiga XOS belgi: kirishda ham, parol tiklashda ham ism
     * so'ralmaydi. Ya'ni bu shart «bu odam hozir ro'yxatdan o'tdi»
     * degani.
     *
     * ⚠️ Token ALLAQACHON saqlangan (yuqorida) — `logEvent` tokensiz
     * jimgina chiqib ketadi, shuning uchun tartib muhim.
     *
     * Kod yozilgach O'CHIRILADI: bitta havola bitta ro'yxatdan
     * o'tishga, aks holda o'sha brauzerdagi keyingi hisob ham
     * o'sha odamga yozilardi.
     */
    if (profileExtra?.name) {
      const invite = readReferral();
      if (invite) {
        logEvent(AnalyticsEvent.inviteSignup, { code: invite });
        clearReferral();
      }
    }

    /*
     * RO'YXATDAN O'TISHDA TANLANGAN ROL (22.09.2026).
     *
     * ⚠️ SERVERGA YOZILMAYDI va yozib ham bo'lmaydi: gateway'da rolni
     * o'zgartiradigan endpoint YO'Q — haydovchilik faqat
     * `POST /users/upgrade` (hujjat + mashina) va moderatsiya orqali
     * beriladi. Ya'ni bu tanlov «keyin qayerga tushasan» degan savolga
     * javob, hisobning huquqiga emas.
     *
     * 🔴 «Dashboard» ga EMAS, ONBOARDING ga: hujjatsiz odamda mashina
     * ham, e'lon berish huquqi ham yo'q — panel unga bo'sh ko'rinardi.
     */
    if (profileExtra?.role === 'driver') {
      setActiveRole('driver');
      window.location.href = `/${locale}/driver/onboarding`;
      return;
    }
    if (profileExtra?.role === 'passenger') setActiveRole('passenger');

    // Rol uchun o'z profilimizni o'qiymiz; xato bo'lsa yo'lovchi sifatida qidiruvga.
    try {
      const me = await getMe();
      const u = me?.user;
      setStoredUserName(u?.first_name ? `${u.first_name} ${u.last_name ?? ''}`.trim() : undefined);
      const isDriver = String(u?.role ?? '').toLowerCase() === 'driver';
      window.location.href = isDriver ? `/${locale}/dashboard` : `/${locale}/search`;
    } catch {
      window.location.href = `/${locale}/search`;
    }
  };

  // ======= MUTATIONS =======

  // PAROL bilan KIRISH — SMS/kodsiz. Parol ro'yxatdan o'tishda o'rnatilgan bo'ladi.
  const passwordLoginMutation = useMutation({
    mutationFn: (phoneNumber: string) => loginWithPassword(cleanPhone(phoneNumber), password),
    onSuccess: (body) => finishAuth(body),
    onError: (err: any) => {
      // Yangi qurilma aniqlandi, LEKIN SMS ketmadi (limit 3/daq yoki shlyuz).
      // Kod ekraniga o'tkazish bu yerda ZARARLI bo'lardi: kod yo'q, odam bo'sh
      // ekranda kutib qolardi. Shuning uchun `isNewDeviceError` dan OLDIN.
      if (isSmsNotSentError(err)) {
        setHadError(true);
        toast.error(
          tr(
            "Tasdiqlash kodi yuborilmadi. Bir daqiqadan so'ng qayta urinib ko'ring",
            'Код подтверждения не отправлен. Попробуйте через минуту',
            'The confirmation code was not sent. Please try again in a minute'
          )
        );
        return;
      }
      // YANGI QURILMA: bu xato EMAS — parol to'g'ri, backend SMS yuborib bo'ldi.
      // Qizil xato ko'rsatish foydalanuvchini "parolim noto'g'ri" deb adashtiradi.
      if (isNewDeviceError(err)) {
        setSmsCode('');
        setStep('otp');
        setResendIn(60);
        toast.info(
          tr(
            'Yangi qurilmadan kirilyapti — raqamingizga tasdiqlash kodi yuborildi',
            'Вход с нового устройства — на ваш номер отправлен код подтверждения',
            'Signing in from a new device — a confirmation code was sent to your number'
          )
        );
        return;
      }
      // 423 — hisob bloklangan. Aniq raqamlar backend javobidan (2026-08-09):
      // 5 ta xato urinish (parol VA SMS kodi birga sanaladi) -> ROSA 15 daqiqa,
      // blok faqat vaqt bilan yechiladi (to'g'ri kod ham yechmaydi).
      // "Biroz kuting" deb yozish yomon: odam necha daqiqa ekanini bilmay,
      // qayta-qayta urinib ko'radi.
      if (isAccountLockedError(err)) {
        setHadError(true);
        toast.error(
          tr(
            "Hisob 15 daqiqaga bloklandi — 5 marta xato urinish. Shu vaqt o'tishini kutish kerak",
            'Аккаунт заблокирован на 15 минут — 5 неверных попыток. Нужно дождаться окончания',
            'Account locked for 15 minutes — 5 failed attempts. You need to wait it out'
          )
        );
        return;
      }
      const msg = err.response?.data?.error || err.response?.data?.message;
      setHadError(true);
      toast.error(
        localizeBackendMessage(msg, locale) ||
          tr('Kirishda xatolik', 'Ошибка входа', 'Sign-in error')
      );
    },
  });

  // SMS yuborish (FAQAT ro'yxatdan o'tish). Rate-limit 3/daq -> 429 (interceptor toast beradi).
  const requestOtpMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      const cleaned = cleanPhone(phoneNumber);
      // `type` joriy REJIMDAN keladi: register / login / frgt_pswd.
      await sendOtp(cleaned, OTP_PURPOSE[mode]);
      return cleaned;
    },
    onSuccess: (cleaned) => {
      setPhone(cleaned);
      setSmsCode('');
      setStep('otp');
      setResendIn(60);
      toast.success(tr('SMS kod yuborildi', 'SMS код отправлен', 'SMS code sent'));
    },
    onError: (err: any) => {
      // Backend endi holatlarni AJRATADI (swagger 2026-08-03):
      //   404 — raqam ro'yxatdan o'tmagan (login/frgt_pswd uchun),
      //   409 — raqam allaqachon bor (register uchun).
      // Ularni umumiy "Xatolik yuz berdi" bilan yopib qo'yish foydalanuvchini
      // boshi berk ko'chaga olib boradi — har biriga to'g'ri yo'l ko'rsatamiz.
      const status = err?.response?.status;
      if (status === 404) {
        toast.error(
          tr(
            "Bu raqam ro'yxatdan o'tmagan — avval ro'yxatdan o'ting",
            'Этот номер не зарегистрирован — сначала зарегистрируйтесь',
            'This number is not registered — please sign up first'
          )
        );
        switchMode('register');
        return;
      }
      if (status === 409) {
        toast.error(
          tr(
            "Bu raqam allaqachon ro'yxatdan o'tgan — kirishga o'ting",
            'Этот номер уже зарегистрирован — перейдите ко входу',
            'This number is already registered — please sign in'
          )
        );
        switchMode('login');
        return;
      }
      onApiError(err, tr('Xatolik yuz berdi', 'Произошла ошибка', 'Something went wrong'));
    },
  });

  // VERIFY-OTP (ro'yxatdan o'tish) — hisob yaratadi, token qaytaradi. is_new_user=true bo'lsa
  // ism/jins/parol so'raymiz. Mavjud hisob bo'lsa (is_new_user=false) shundoq kiritamiz.
  const verifyMutation = useMutation({
    mutationFn: () => verifyOtp(cleanPhone(phone), smsCode),
    onSuccess: async (body) => {
      /*
        YASHIL TASDIQ. Kod to'g'ri ekani ANIQ bo'lgach, `OTPInput` ga signal
        beramiz: kataklar yashil yonadi va ostida tasdiq belgisi chiqadi.

        Nega kutish qo'shildi: ilgari tasdiq lahzasi UMUMAN ko'rinmasdi —
        server javob berishi bilan ekran almashardi va odam "kod qabul
        qilindimi?" degan savol bilan qolardi.

        ⚠️ ILGARI BU 950 ms EDI — eski mashinali animatsiyaning to'liq
        uzunligi. Endi kutish faqat rang o'tishi (200 ms) ko'rinishiga
        yetadi, ya'ni kirish yarim soniyaga tezlashdi.

        Bu FAQAT muvaffaqiyatda: xatoda kutish qo'shsak, noto'g'ri kod
        kiritgan odam har urinishda ortiqcha sekinlikka duch kelardi.
      */
      setOtpWin(true);
      await new Promise((r) => setTimeout(r, 400));

      // PAROLNI TIKLASH: kod to'g'ri -> token bor, endi FAQAT yangi parol so'raymiz
      // (ism/jins allaqachon bor, ularni qayta so'rash mantiqsiz).
      if (mode === 'reset') {
        setAuthBody(body);
        setStep('info');
        return;
      }
      // YANGI QURILMADAN KIRISH: hisob allaqachon bor, profil/parol so'ralmaydi —
      // kod tasdiqlangani zahoti kiritamiz. "Bu raqam allaqachon ro'yxatdan o'tgan"
      // matni bu yerda mantiqsiz bo'lardi (odam ro'yxatdan o'tayotgani yo'q, kiryapti).
      if (mode === 'login') {
        finishAuth(body);
        return;
      }
      if (body?.is_new_user) {
        setAuthBody(body); // token'ni saqlaymiz — 'info' yakunida ishlatiladi
        // 🔴 ROL AVVAL (22.09.2026): ilgari bu yerda to'g'ridan-to'g'ri
        // `info` (ism/jins/parol) ochilardi va «siz kimsiz?» degan savol
        // UMUMAN berilmasdi — yangi odam ro'yxatdan o'tib yo'lovchi
        // qidiruviga tushardi, haydovchi esa o'z yo'lini keyin qidirardi.
        setStep('role');
        return;
      }
      // Bu raqam allaqachon ro'yxatdan o'tgan — to'g'ridan-to'g'ri kiritamiz.
      toast.info(
        tr(
          "Bu raqam allaqachon ro'yxatdan o'tgan — tizimga kiritildingiz",
          'Этот номер уже зарегистрирован — вы вошли в систему',
          'This number is already registered — you have been signed in'
        )
      );
      finishAuth(body);
    },
    onError: (err: any) => {
      const status = err.response?.status;
      const msg = String(
        err.response?.data?.error?.message || err.response?.data?.error || ''
      ).toLowerCase();
      if (status === 400 || status === 401 || msg.includes('otp') || msg.includes('code')) {
        toast.error(
          tr(
            "Tasdiqlash kodi noto'g'ri yoki eskirgan",
            'Неверный или просроченный код',
            'The code is invalid or expired'
          )
        );
        setStep('otp');
        setHadError(true);
        // Kod tozalanadi: noto'g'ri raqamlarni birma-bir o'chirish odamni
        // ortiqcha ovora qiladi va yo'l imorasi ham boshidan boshlanadi.
        setSmsCode('');
        setOtpWin(false);
        setOtpError(true);
        return;
      }
      onApiError(err, tr('Kirishda xatolik', 'Ошибка входа', 'Sign-in error'));
    },
  });

  // ======= HANDLERLAR =======
  // KIRISH (login) — faqat parol.
  const onLoginSubmit = phoneForm.handleSubmit((data) => {
    if (password.length < 6) {
      toast.error(
        tr(
          "Parol kamida 6 belgidan iborat bo'lsin",
          'Пароль должен быть не короче 6 символов',
          'Password must be at least 6 characters'
        )
      );
      return;
    }
    setPhone(cleanPhone(data.phone));
    passwordLoginMutation.mutate(data.phone);
  });

  // RO'YXATDAN O'TISH 1-qadam — telefon -> OTP so'rash.
  const onRegisterPhoneSubmit = phoneForm.handleSubmit((data) => {
    requestOtpMutation.mutate(data.phone);
  });

  const onVerifyOtp = () => {
    if (smsCode.length !== 5) {
      toast.error(tr("Kodni to'liq kiriting", 'Введите код полностью', 'Enter the full code'));
      return;
    }
    verifyMutation.mutate();
  };

  const onInfoSubmit = () => {
    // PAROLNI TIKLASH: bu yerda faqat YANGI PAROL so'raladi. Ism/jins allaqachon
    // mavjud va ularni qayta so'rash foydalanuvchini adashtirardi.
    if (mode === 'reset') {
      if (regPassword.length < 6) {
        toast.error(
          tr(
            "Parol kamida 6 belgidan iborat bo'lsin",
            'Пароль должен быть не короче 6 символов',
            'Password must be at least 6 characters'
          )
        );
        return;
      }
      if (!authBody) {
        toast.error(
          tr(
            "Sessiya topilmadi, qaytadan urinib ko'ring",
            'Сессия не найдена, попробуйте снова',
            'Session not found, please try again'
          )
        );
        resetFlow();
        return;
      }
      // finishAuth token'ni saqlaydi va `password` bo'lsa setup-password chaqiradi —
      // ya'ni eski parol yangisiga almashadi.
      finishAuth(authBody, { password: regPassword });
      return;
    }

    // Backend ham ism, ham familiyani QAT'IY talab qiladi (last_name required+min) —
    // bitta maydonda ikkala so'z bo'lishini tekshiramiz.
    const nameParts = regName.trim().split(/\s+/).filter(Boolean);
    if (nameParts.length < 2 || nameParts.some((p) => p.length < 2)) {
      toast.error(
        tr(
          'Ism va familiyangizni kiriting (masalan: Palonchi Pistonchiyev)',
          'Введите имя и фамилию (например: Палончи Пистончиев)',
          'Enter your first and last name (e.g. Palonchi Pistonchiyev)'
        )
      );
      return;
    }
    if (!regGender) {
      toast.error(tr('Jinsni tanlang', 'Выберите пол', 'Select your gender'));
      return;
    }
    if (regPassword.length < 6) {
      toast.error(
        tr(
          "Parol kamida 6 belgidan iborat bo'lsin",
          'Пароль должен быть не короче 6 символов',
          'Password must be at least 6 characters'
        )
      );
      return;
    }
    // is_new_user oqimida token verify'dan saqlangan (authBody) — profileExtra bilan yakunlaymiz.
    if (!authBody) {
      toast.error(
        tr(
          "Sessiya topilmadi, qaytadan urinib ko'ring",
          'Сессия не найдена, попробуйте снова',
          'Session not found, please try again'
        )
      );
      resetFlow();
      return;
    }
    finishAuth(authBody, {
      name: regName.trim(),
      gender: regGender,
      password: regPassword,
      role: regRole,
    });
  };

  const formatPhoneNumber = (value: string) => {
    let cleaned = value.replace(/\D/g, '');
    if (!cleaned.startsWith('998')) cleaned = '998' + cleaned;
    const match = cleaned.match(/^(\d{3})(\d{0,2})(\d{0,3})(\d{0,2})(\d{0,2})$/);
    if (match) {
      const parts = [`+${match[1]}`];
      if (match[2]) parts.push(`(${match[2]}`);
      if (match[3]) parts.push(`) ${match[3]}`);
      if (match[4]) parts.push(`-${match[4]}`);
      if (match[5]) parts.push(`-${match[5]}`);
      return parts.join('');
    }
    return value;
  };

  if (!mounted || redirecting) return null;

  const otpPending = requestOtpMutation.isPending;

  // Progress bar faqat ro'yxatdan o'tish oqimida ko'rsatiladi.
  //
  // ⚠️ QADAMLAR SONI REJIMGA BOG'LIQ: ro'yxatdan o'tishda TO'RTTA
  // (telefon → kod → rol → ma'lumot), parolni tiklashda esa UCHTA —
  // u yerda rol ham, ism ham so'ralmaydi (odam allaqachon ro'yxatda).
  // Qotirilgan uchlik «3 ning 4-qadami» degan yolg'on yozuv berardi.
  const flowSteps: Step[] =
    mode === 'register' ? ['phone', 'otp', 'role', 'info'] : ['phone', 'otp', 'info'];
  const stepIndex = Math.max(1, flowSteps.indexOf(step) + 1);
  const stepProgress = (
    <div className="space-y-2 mb-5">
      <p className="text-xs font-bold text-text-muted">
        {tr(
          `Qadam ${stepIndex} ning ${flowSteps.length}`,
          `Шаг ${stepIndex} из ${flowSteps.length}`,
          `Step ${stepIndex} of ${flowSteps.length}`
        )}
      </p>
      <div className="flex h-1.5 w-full bg-border/40 rounded-full overflow-hidden">
        <div
          className="h-full w-full bg-accent origin-left transition-transform duration-300"
          style={{ transform: `scaleX(${stepIndex / flowSteps.length})` }}
        />
      </div>
    </div>
  );

  /*
   * 🔴 YORLIQ MAYDONGA BOG'LANMAGAN EDI (2026-09-04, o'lchandi):
   * `<label>` inputning yonida turardi-yu, `htmlFor` yo'q edi — ekran
   * o'qigich «tahrirlash maydoni» deb o'qirdi. Bu forma saytga
   * KIRISHNING yagona yo'li, ya'ni nuqson eng noqulay joyda edi.
   *
   * ⚠️ `id` PARAMETR: bu yordamchi IKKI formada chaqiriladi (kirish va
   * ro'yxatdan o'tish). Qotirilgan id ikki nusxada paydo bo'lardi va
   * yorliq noto'g'ri maydonga ulanardi.
   */
  const phoneField = (form: UseFormReturn<any>, fieldId: string) => (
    <div className="space-y-1">
      <label htmlFor={fieldId} className="text-sm font-medium ml-1">
        {tr('Telefon raqam', 'Номер телефона', 'Phone number')}
      </label>
      <div className="relative group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Phone className="w-5 h-5 text-foreground/40 group-focus-within:text-accent transition-colors" />
        </div>
        <Input
          {...form.register('phone')}
          id={fieldId}
          type="tel"
          placeholder="+998 (__) ___-__-__"
          className="pl-12 h-14 bg-background/50 focus:bg-background transition-colors text-lg"
          onChange={(e) =>
            form.setValue('phone', formatPhoneNumber(e.target.value), { shouldValidate: true })
          }
        />
      </div>
      {form.formState.errors.phone && (
        <p className="text-error text-sm mt-1 ml-1">
          {form.formState.errors.phone.message as string}
        </p>
      )}
    </div>
  );

  // Rejim tanlash (Kirish / Ro'yxatdan o'tish) — segmentli tugma.
  const modeTabs = (
    <div className="flex p-1 mb-5 bg-background/60 border border-border rounded-2xl">
      {(['login', 'register'] as const).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={`flex-1 h-11 rounded-xl text-sm font-bold transition-colors ${
              active ? 'bg-surface text-accent shadow-sm' : 'text-text-muted hover:text-text'
            }`}
          >
            {m === 'login'
              ? tr('Kirish', 'Вход', 'Sign in')
              : tr("Ro'yxatdan o'tish", 'Регистрация', 'Sign up')}
          </button>
        );
      })}
    </div>
  );

  const headerSubtitle =
    mode === 'login'
      ? step === 'otp'
        ? tr(
            'Raqamingizga yuborilgan kodni kiriting',
            'Введите код, отправленный на ваш номер',
            'Enter the code sent to your number'
          )
        : tr(
            'Telefon va parolingiz bilan kiring',
            'Войдите по номеру телефона и паролю',
            'Sign in with your phone number and password'
          )
      : mode === 'reset'
        ? step === 'info'
          ? tr("Yangi parol o'rnating", 'Задайте новый пароль', 'Set a new password')
          : tr(
              'Parolni tiklash uchun raqamingizga SMS kod yuboramiz',
              'Для сброса пароля отправим SMS-код на ваш номер',
              'We will send an SMS code to reset your password'
            )
        : step === 'phone'
          ? tr(
              "Ro'yxatdan o'tish uchun raqamingizga SMS kod yuboramiz",
              'Для регистрации отправим SMS-код на ваш номер',
              'We will send an SMS code to your number to sign up'
            )
          : step === 'role'
            ? tr(
                'Ilova siz uchun shunga qarab ochiladi',
                'От этого зависит, что вы увидите дальше',
                'This decides what you see next'
              )
            : tr("Ma'lumotlaringizni to'ldiring", 'Заполните ваши данные', 'Fill in your details');

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/*
          🔴 TIL ALMASHTIRGICH BU YERDAN OLIB TASHLANDI (03.09).
          U ATAYIN qo'yilgandi (PWA aynan shu manzildan ochiladi), lekin
          endi SARLAVHADA ham bor — natijada bitta ekranda ikkita
          almashtirgich turardi. Sarlavhadagisi hamma sahifada bir xil
          joyda, shuning uchun o'sha qoldi; bu yerdagisi ketdi.
        */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brand-pink rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-display text-3xl font-black tracking-tight text-foreground">
            {tr('Xush kelibsiz', 'Добро пожаловать', 'Welcome')}
          </h1>
          <p className="text-sm text-text-muted mt-2">{headerSubtitle}</p>
        </div>

        <div className="bg-surface border border-border p-6 rounded-3xl shadow-md">
          {/* Kirish oqimi kod qadamiga o'tganda ham tab'lar emas, "orqaga" ko'rsatiladi:
              odam allaqachon hisobga ega, unga "Ro'yxatdan o'tish" tabi kerak emas. */}
          {mode === 'reset' || (mode === 'login' && step === 'otp') ? (
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="mb-5 flex items-center gap-1.5 text-sm font-bold text-text-muted transition-colors hover:text-accent"
            >
              <ArrowLeft className="h-4 w-4" />
              {tr('Kirishga qaytish', 'Назад ко входу', 'Back to sign in')}
            </button>
          ) : (
            modeTabs
          )}

          {/* ===== KIRISH (login) — telefon + parol, kodsiz =====
              `step === 'phone'` sharti MUHIM: yangi qurilmadan kirishda oqim `otp`
              qadamiga o'tadi va parol formasi kod ekrani bilan birga turmasligi kerak. */}
          {mode === 'login' && step === 'phone' && (
            <form onSubmit={onLoginSubmit} className="space-y-4">
              {phoneField(phoneForm, 'login-phone')}

              <div className="space-y-1">
                <label htmlFor="login-password" className="text-sm font-medium ml-1">
                  {tr('Parol', 'Пароль', 'Password')}
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <KeyRound className="w-5 h-5 text-foreground/40 group-focus-within:text-accent transition-colors" />
                  </div>
                  <Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={tr('Parolingiz', 'Ваш пароль', 'Your password')}
                    className="pl-12 h-14"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-14 text-lg font-semibold rounded-2xl shadow-lg shadow-accent/20"
                disabled={passwordLoginMutation.isPending}
                isLoading={passwordLoginMutation.isPending}
              >
                {tr('Kirish', 'Войти', 'Sign in')}
              </Button>

              {/* Parolni tiklash — backend `frgt_pswd` turini shu oqim uchun beradi:
                  SMS kod -> tasdiqlash -> yangi parol. */}
              <p className="text-center text-sm pt-1">
                <button
                  type="button"
                  onClick={() => switchMode('reset')}
                  /* `py-2 -my-2` — tegib turadigan maydon 20 px dan
                     36 px ga o'sadi, matn esa joyidan qimirlamaydi. */
                  className="-my-2 py-2 font-semibold text-text-muted hover:text-accent hover:underline"
                >
                  {tr('Parolni unutdingizmi?', 'Забыли пароль?', 'Forgot your password?')}
                </button>
              </p>

              <p className="text-center text-sm text-text-muted pt-1">
                {tr("Hisobingiz yo'qmi? ", 'Нет аккаунта? ', 'No account yet? ')}
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="-my-2 py-2 font-semibold text-accent hover:underline"
                >
                  {tr("Ro'yxatdan o'ting", 'Зарегистрируйтесь', 'Sign up')}
                </button>
              </p>
            </form>
          )}

          {/* ===== RO'YXATDAN O'TISH — 1-qadam: telefon ===== */}
          {(mode === 'register' || mode === 'reset') && step === 'phone' && (
            <>
              {stepProgress}
              {/* Havola ishlaganini odam KO'RSIN — bu ayni paytda
                  bizning yagona ko'z bilan tekshirish nuqtamiz. */}
              {mode === 'register' && invitedBy && (
                <p className="rounded-xl border border-turquoise/40 bg-turquoise-light/40 px-4 py-3 text-center text-sm font-semibold text-text dark:bg-turquoise/10">
                  {tr(
                    "Do'stingizning taklifi bilan keldingiz",
                    'Вы пришли по приглашению друга',
                    'You came through a friend’s invitation'
                  )}
                </p>
              )}
              <form onSubmit={onRegisterPhoneSubmit} className="space-y-4">
                {phoneField(phoneForm, 'register-phone')}

                <Button
                  type="submit"
                  className="w-full h-14 text-lg font-semibold rounded-2xl shadow-lg shadow-accent/20"
                  disabled={otpPending}
                  isLoading={otpPending}
                >
                  {otpPending
                    ? tr('Yuborilmoqda...', 'Отправка...', 'Sending...')
                    : tr('Kod olish', 'Получить код', 'Get code')}
                </Button>

                <p className="text-center text-sm text-text-muted pt-1">
                  {tr('Hisobingiz bormi? ', 'Уже есть аккаунт? ', 'Already have an account? ')}
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="font-semibold text-accent hover:underline"
                  >
                    {tr('Kirish', 'Войти', 'Sign in')}
                  </button>
                </p>
              </form>
            </>
          )}

          {/* ===== 2-qadam: OTP — ro'yxatdan o'tish/tiklash, VA yangi qurilmadan kirish ===== */}
          {step === 'otp' && (
            <>
              {/* Kirish oqimi 3 qadamli emas — progress bar faqat ro'yxatdan o'tish/tiklashda. */}
              {mode !== 'login' && stepProgress}
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-brand-pink-light dark:bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-2">
                    <ShieldCheck className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="text-lg font-semibold">
                    {tr('Tasdiqlash kodi', 'Код подтверждения', 'Verification code')}
                  </h3>
                  <p className="text-sm text-text-muted">{phone}</p>
                  {mode === 'login' && (
                    <p className="text-sm text-text-muted">
                      {tr(
                        'Siz yangi qurilmadan kiryapsiz. Hisobingizni himoya qilish uchun SMS kodni kiriting.',
                        'Вы входите с нового устройства. Для защиты аккаунта введите код из SMS.',
                        'You are signing in from a new device. Enter the SMS code to protect your account.'
                      )}
                    </p>
                  )}
                </div>
                <OTPInput
                  length={5}
                  value={smsCode}
                  error={otpError}
                  status={otpWin ? 'success' : 'idle'}
                  confirmLabel={tr('Tasdiqlandi', 'Подтверждено', 'Confirmed')}
                  onChange={(v) => {
                    // Yozishni boshlagan zahoti xato belgisi so'nadi — aks holda
                    // chayqalish animatsiyasi har raqamda qayta ishga tushardi.
                    if (otpError) setOtpError(false);
                    setSmsCode(v);
                  }}
                />
                <Button
                  onClick={onVerifyOtp}
                  className="w-full h-14 text-lg font-semibold rounded-2xl"
                  disabled={smsCode.length !== 5 || verifyMutation.isPending}
                  isLoading={verifyMutation.isPending}
                >
                  {tr('Davom etish', 'Продолжить', 'Continue')}
                </Button>

                <div className="text-center">
                  {resendIn > 0 ? (
                    <p className="text-sm text-text-muted">
                      {tr(
                        `Qayta yuborish ${resendIn} s`,
                        `Повторная отправка через ${resendIn} с`,
                        `Resend in ${resendIn}s`
                      )}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => requestOtpMutation.mutate(phone)}
                      disabled={requestOtpMutation.isPending}
                      className="text-sm font-semibold text-accent hover:underline disabled:opacity-50"
                    >
                      {requestOtpMutation.isPending
                        ? tr('Yuborilmoqda...', 'Отправка...', 'Sending...')
                        : tr('Kodni qayta yuborish', 'Отправить код повторно', 'Resend code')}
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={resetFlow}
                  className="w-full py-2 text-sm text-text-muted hover:text-foreground"
                >
                  {tr('Boshqa raqam kiritish', 'Ввести другой номер', 'Use another number')}
                </button>
              </div>
            </>
          )}

          {/* ===== RO'YXATDAN O'TISH — 3-qadam: SIZ KIMSIZ? =====
              Egasi, 22.09.2026: «role ni so'rashni otp dan keyin so'rash
              kerak, akkaunt ma'lumotlarini olishdan oldin — yo'lovchimi
              haydovchimi so'ralsin».

              ⚠️ Tanlov hisobning ROLINI o'zgartirmaydi (buning endpointi
              yo'q) — u ro'yxatdan o'tish oxirida odam qayerga tushishini
              belgilaydi: yo'lovchi qidiruvga, haydovchi esa hujjat
              tekshiruviga. */}
          {mode === 'register' && step === 'role' && (
            <>
              {stepProgress}
              <div className="space-y-4">
                <p className="text-sm text-text-muted">
                  {tr(
                    "Keyin buni profilda istalgan vaqt o'zgartirasiz",
                    'Позже это можно изменить в профиле в любой момент',
                    'You can change this later in your profile at any time'
                  )}
                </p>

                <div role="group" aria-labelledby="register-role-label" className="space-y-3">
                  <span id="register-role-label" className="sr-only">
                    {tr('Siz kimsiz?', 'Кто вы?', 'Who are you?')}
                  </span>
                  {(
                    [
                      {
                        key: 'passenger' as const,
                        icon: <User className="h-6 w-6" />,
                        title: tr("Yo'lovchi", 'Пассажир', 'Passenger'),
                        hint: tr(
                          'Safar qidiraman va joy bron qilaman',
                          'Ищу поездки и бронирую место',
                          'I look for rides and book a seat'
                        ),
                      },
                      {
                        key: 'driver' as const,
                        icon: <Car className="h-6 w-6" />,
                        title: tr('Haydovchi', 'Водитель', 'Driver'),
                        hint: tr(
                          "E'lon beraman va yo'lovchi olaman",
                          'Публикую поездки и беру пассажиров',
                          'I publish rides and take passengers'
                        ),
                      },
                    ] as const
                  ).map((option) => {
                    const active = regRole === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setRegRoleRaw(option.key)}
                        /* BUTUN KARTA bosiladi, kichik nuqta emas —
                           barmoq nishoni qoidasi (2026-09-04 auditi). */
                        className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
                          active
                            ? 'border-accent bg-brand-pink-light dark:bg-accent/10'
                            : 'border-border bg-background/50 hover:border-accent/50'
                        }`}
                      >
                        <span className={active ? 'text-accent' : 'text-text-muted'}>
                          {option.icon}
                        </span>
                        <span className="flex-1">
                          <span className="block text-base font-bold">{option.title}</span>
                          <span className="block text-sm text-text-muted">{option.hint}</span>
                        </span>
                        {/* Tanlanganini faqat RANG bilan emas, BELGI bilan
                            ham aytamiz — rang ko'rmaydigan odam uchun. */}
                        {active && <CheckCircle2 className="h-5 w-5 shrink-0 text-accent" />}
                      </button>
                    );
                  })}
                </div>

                {/* HAQIQAT DARHOL: haydovchilik tekshiruvdan o'tadi.
                    Buni keyinroq aytish «aldadi» degan taassurot beradi. */}
                {regRole === 'driver' && (
                  <p className="rounded-xl border border-turquoise/40 bg-turquoise-light/40 px-4 py-3 text-sm text-text dark:bg-turquoise/10">
                    {tr(
                      "Buning uchun guvohnoma, texpasport va mashina suratlari tekshiruvdan o'tadi. Tekshiruvgacha yo'lovchi sifatida foydalanasiz.",
                      'Для этого права, техпаспорт и фото машины пройдут проверку. До проверки вы пользуетесь сервисом как пассажир.',
                      'Your licence, vehicle passport and car photos will be checked first. Until then you use the service as a passenger.'
                    )}
                  </p>
                )}

                <Button
                  type="button"
                  className="w-full h-14 text-lg font-semibold rounded-2xl"
                  onClick={() => setStep('info')}
                  disabled={!regRole}
                >
                  {tr('Davom etish', 'Продолжить', 'Continue')}
                </Button>
                {/* O'chiq tugmaning SABABI yozilsin — jim o'chiq tugma
                    boshi berk ko'cha (loyiha qoidasi). */}
                {!regRole && (
                  <p className="text-center text-xs text-text-muted">
                    {tr(
                      'Davom etish uchun birini tanlang',
                      'Выберите один из вариантов, чтобы продолжить',
                      'Choose one to continue'
                    )}
                  </p>
                )}
              </div>
            </>
          )}

          {/* ===== RO'YXATDAN O'TISH — 4-qadam: ism/jins + parol ===== */}
          {(mode === 'register' || mode === 'reset') && step === 'info' && (
            <>
              {stepProgress}
              <div className="space-y-4">
                {/* ROLGA QAYTISH: odam noto'g'ri bosgan bo'lishi mumkin va
                    tanlovni faqat butun oqimni qaytadan boshlab
                    o'zgartirish boshi berk ko'cha bo'lardi. */}
                {mode === 'register' && (
                  <button
                    type="button"
                    onClick={() => setStep('role')}
                    className="-my-2 flex items-center gap-1.5 py-2 text-sm font-bold text-text-muted transition-colors hover:text-accent"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {regRole === 'driver'
                      ? tr('Haydovchi', 'Водитель', 'Driver')
                      : tr("Yo'lovchi", 'Пассажир', 'Passenger')}
                    {' · '}
                    {tr("O'zgartirish", 'Изменить', 'Change')}
                  </button>
                )}
                <p className="text-sm text-text-muted">
                  {mode === 'reset'
                    ? tr(
                        "Yangi parol o'rnating — keyingi kirishlar shu parol bilan bo'ladi.",
                        'Задайте новый пароль — дальше вход по нему.',
                        'Set a new password — you will sign in with it from now on.'
                      )
                    : tr(
                        "Tabriklaymiz! O'zingiz haqingizda ma'lumot bering va parol o'rnating.",
                        'Расскажите немного о себе и задайте пароль.',
                        'Tell us a bit about yourself and set a password.'
                      )}
                </p>
                {mode === 'register' && (
                  <>
                    <div className="space-y-1">
                      <label htmlFor="register-name" className="text-sm font-medium ml-1">
                        {tr('Ism va familiya', 'Имя и фамилия', 'First and last name')}
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                          <User className="w-5 h-5 text-foreground/40 group-focus-within:text-accent transition-colors" />
                        </div>
                        <Input
                          id="register-name"
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          // Namuna ism ATAYIN uydirma: "Aziz Karimov" haqiqiy odamning
                          // ismidek o'qiladi (Karimov familiyasi ayniqsa), placeholder esa
                          // "John Doe" kabi aniq shartli bo'lishi kerak.
                          placeholder={tr('Palonchi Pistonchiyev', 'Иван Иванов', 'John Doe')}
                          className="pl-12 h-14"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      {/* ⚠️ Bu YORLIQ EMAS: pastda kiritish maydoni emas,
                          ikkita TUGMA turadi. `<label>` boshqaruvsiz
                          qolsa ekran o'qigich uni hech narsaga
                          bog'lamaydi — guruhning o'z nomi bo'lgani
                          to'g'ri. */}
                      <span id="register-gender-label" className="text-sm font-medium ml-1">
                        {tr('Jins', 'Пол', 'Gender')}
                      </span>
                      <div
                        role="group"
                        aria-labelledby="register-gender-label"
                        className="flex gap-2"
                      >
                        {(['male', 'female'] as const).map((g) => {
                          const active = regGender === g;
                          return (
                            <button
                              key={g}
                              type="button"
                              onClick={() => setRegGender(g)}
                              className={`flex-1 h-14 rounded-2xl border text-sm font-semibold transition-colors ${
                                active
                                  ? 'bg-brand-pink-light dark:bg-accent/10 border-accent text-accent'
                                  : 'bg-background/50 border-border text-text-muted hover:border-accent/50'
                              }`}
                            >
                              {g === 'male'
                                ? tr('Erkak', 'Мужской', 'Male')
                                : tr('Ayol', 'Женский', 'Female')}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-1">
                  <label htmlFor="register-password" className="text-sm font-medium ml-1">
                    {tr('Parol', 'Пароль', 'Password')}
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                      <KeyRound className="w-5 h-5 text-foreground/40 group-focus-within:text-accent transition-colors" />
                    </div>
                    <Input
                      id="register-password"
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder={tr(
                        'Kamida 6 belgi',
                        'Не менее 6 символов',
                        'At least 6 characters'
                      )}
                      className="pl-12 h-14"
                      autoComplete="new-password"
                    />
                  </div>
                  <p className="text-xs text-text-muted ml-1">
                    {mode === 'reset'
                      ? tr(
                          "Eski parol bekor bo'ladi",
                          'Старый пароль перестанет действовать',
                          'Your old password will stop working'
                        )
                      : tr(
                          'Keyingi safar shu parol bilan kodsiz kirasiz',
                          'В следующий раз входите по этому паролю без кода',
                          'Next time you can sign in with this password, without a code'
                        )}
                  </p>
                </div>

                <Button
                  type="button"
                  className="w-full h-14 text-lg font-semibold rounded-2xl"
                  onClick={onInfoSubmit}
                  isLoading={verifyMutation.isPending}
                >
                  {tr('Yakunlash', 'Завершить', 'Finish')}
                </Button>
              </div>
            </>
          )}

          {/* YORDAM — HAR QADAMDA (egasi, 22.09.2026: «support'ni ham
              ko'rinadigan joyga qo'yish kerak, masalan otpdan o'tmay
              qolsa ham yoki xatolik bo'lsa ham supportga yozish uchun»).
              Izohi `AuthSupportLink` da. */}
          <AuthSupportLink highlight={hadError} />
        </div>
      </div>
    </div>
  );
}

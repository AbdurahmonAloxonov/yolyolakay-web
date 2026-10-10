import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'react-hooks/set-state-in-effect': 'off',
      '@typescript-eslint/no-unused-vars': 'off',

      /*
       * UCH TILLILIK QO'RIQCHISI (2026-08-03).
       *
       * Ilgari matnlar `isUz ? 'uz' : 'ru'` shaklida yozilardi. Ingliz tili
       * qo'shilganda bu shakl JIMGINA buziladi: `isUz` false bo'lsa inglizga
       * ruscha chiqadi. 704 ta joy `tr(uz, ru, en)` ga o'tkazildi — bitta yangi
       * ternariy butun sahifani orqaga qaytarib yuborishi mumkin, shuning uchun
       * shakl kod darajasida taqiqlanadi.
       *
       * To'g'ri yo'l: komponentda `const tr = useTr()`, React'dan tashqarida
       * `trFor(locale)`; qiymat (massiv/obyekt) tanlash uchun `pickFor(locale)`.
       */
      'no-restricted-syntax': [
        'error',
        {
          selector: "Identifier[name='isUz']",
          message:
            "`isUz` uch tilda ishlamaydi (en -> ru bo'lib qoladi). `useTr()` / `trFor(locale)` dan `tr(uz, ru, en)` ishlating.",
        },
        {
          selector:
            "ConditionalExpression > BinaryExpression[operator='==='][right.value='uz'][left.name='locale']",
          message:
            "`locale === 'uz' ? ... : ...` uch tilda ishlamaydi. `tr(uz, ru, en)` yoki `pickFor(locale)` ishlating.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    '.vercel/**',
    'node_modules/**',
    'next-env.d.ts',
    'patch*.js',
    'extract_*.py',
  ]),
]);

export default eslintConfig;

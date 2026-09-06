import assert from 'node:assert/strict';
import test from 'node:test';
import { en, zh, locale, setLocale, t } from '../src/i18n.ts';

test('English defaults, both dictionaries match, and existing messages can switch languages', () => {
  assert.equal(locale, 'en');
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort());
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    assert.deepEqual(zh[key].match(/\{\w+\}/g)?.sort(), en[key].match(/\{\w+\}/g)?.sort(), key);
  }
  const stored = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { setItem: (key: string, value: string) => stored.set(key, value) } });
  assert.equal(t('noteCount', { count: 12 }), '12 notes');
  setLocale('zh');
  assert.equal(t('noteCount', { count: 12 }), '12 个音符');
  assert.equal(t('transcriptionFailed', { reason: { key: 'songBusy' } }), `${zh.transcriptionFailed.replace('{reason}', zh.songBusy)}`);
  assert.equal(stored.get('echo-piano-language'), 'zh');
  setLocale('fr');
  assert.equal(locale, 'en');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage disabled'); } });
  assert.doesNotThrow(() => setLocale('zh'));
  setLocale('en');
});

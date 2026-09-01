import test from 'node:test'
import assert from 'node:assert/strict'
import { __test__ } from '../mt-deepl.mjs'

const { normalizeSourceLanguage, normalizeTargetLanguage, deeplEndpoint, deeplErrorMessage } = __test__

test('DeepL Free keys use the free endpoint', () => {
  assert.equal(deeplEndpoint('abc:fx'), 'https://api-free.deepl.com/v2/translate')
  assert.equal(deeplEndpoint('pro-key'), 'https://api.deepl.com/v2/translate')
})

test('source language normalization matches desktop rules', () => {
  assert.equal(normalizeSourceLanguage('auto'), null)
  assert.equal(normalizeSourceLanguage('en'), 'EN')
  assert.equal(normalizeSourceLanguage('en-US'), 'EN')
  assert.equal(normalizeSourceLanguage('no'), 'NB')
  assert.equal(normalizeSourceLanguage('zh-CN'), 'ZH')
})

test('target language normalization matches desktop rules', () => {
  assert.equal(normalizeTargetLanguage('en'), 'EN-US')
  assert.equal(normalizeTargetLanguage('en-GB'), 'EN-GB')
  assert.equal(normalizeTargetLanguage('pt'), 'PT-PT')
  assert.equal(normalizeTargetLanguage('zh-CN'), 'ZH-HANS')
  assert.equal(normalizeTargetLanguage(''), null)
})

test('provider errors stay sanitized', () => {
  assert.match(deeplErrorMessage(401), /API key/i)
  assert.match(deeplErrorMessage(456), /quota/i)
  assert.doesNotMatch(deeplErrorMessage(500), /stack|exception/i)
})

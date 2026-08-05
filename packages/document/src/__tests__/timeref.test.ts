import {describe, expect, test} from 'vitest';
import {parseAnchor} from '../timeref.js';

describe('parseAnchor grammar', () => {
  test.each([
    ['intro.start', {segment: 'intro', kind: 'start', offset: 0}],
    ['intro.end', {segment: 'intro', kind: 'end', offset: 0}],
    ['intro.end+0.3', {segment: 'intro', kind: 'end', offset: 0.3}],
    ['intro.start-0.25', {segment: 'intro', kind: 'start', offset: -0.25}],
    ['my-seg.start', {segment: 'my-seg', kind: 'start', offset: 0}],
    [
      'intro.word:binária',
      {segment: 'intro', kind: 'word', word: 'binária', offset: 0},
    ],
    ['intro.word:🙂', {segment: 'intro', kind: 'word', word: '🙂', offset: 0}],
    [
      'intro.word:C++',
      {segment: 'intro', kind: 'word', word: 'C++', offset: 0},
    ],
    [
      'intro.word:a+b',
      {segment: 'intro', kind: 'word', word: 'a+b', offset: 0},
    ],
    [
      'intro.word:binária+0.5',
      {segment: 'intro', kind: 'word', word: 'binária', offset: 0.5},
    ],
    // Documented ambiguity: trailing +/-<digits> is ALWAYS an offset.
    ['intro.word:x-1', {segment: 'intro', kind: 'word', word: 'x', offset: -1}],
    [
      'intro.word:naïve-2',
      {segment: 'intro', kind: 'word', word: 'naïve', offset: -2},
    ],
  ])('%s parses', (ref, expected) => {
    expect(parseAnchor(ref)).toMatchObject(expected);
  });

  test.each([
    'intro.wrd:x',
    'intro.middle',
    '.start',
    'intro.',
    'intro.word:', // empty word
    'intro.word: ', // whitespace is not a word
    'intro.end+.5', // offsets need a leading digit
    'intro.end+1e3', // no exponent notation
    '1abc.start', // segment ids start with a letter
  ])('%s is rejected', ref => {
    expect(parseAnchor(ref)).toBeNull();
  });
});

#!/usr/bin/env python3
"""Convert a raw interview transcript (txt) into an anonymized JS data file.

Usage: build_transcripts.py <raw.txt> <interview_id> <out.js> [--map "원문=치환" ...]

Speaker header lines look like "이름 / 00:12", "이름 00:12" or "이름 / 01:02:03".
Anonymization map is applied to speaker names and body text.
"""
import json
import re
import sys

HEADER = re.compile(r'^(?P<sp>[^\n]{1,30}?)\s*/?\s*(?P<t>\d{1,2}:\d{2}(?::\d{2})?)\s*$')
DROP = re.compile(r'^(##.*##|clovanote\.naver\.com)$')


def main():
    raw, iid, out = sys.argv[1:4]
    pairs = []
    args = sys.argv[4:]
    for i, a in enumerate(args):
        if a == '--map':
            k, v = args[i + 1].split('=', 1)
            pairs.append((k, v))
    # longest keys first so "홍길동 차장" wins over "홍길동"
    pairs.sort(key=lambda p: -len(p[0]))

    def anon(s):
        for k, v in pairs:
            s = s.replace(k, v)
        return s

    turns = []
    cur = None
    for line in open(raw, encoding='utf-8'):
        line = line.rstrip('\n').strip()
        if not line or DROP.match(line):
            continue
        m = HEADER.match(line)
        if m:
            cur = {'s': anon(m.group('sp').strip()), 't': m.group('t'), 'x': []}
            turns.append(cur)
            continue
        if cur is None:
            cur = {'s': '', 't': '', 'x': []}
            turns.append(cur)
        cur['x'].append(anon(line))
    data = [{'s': t['s'], 't': t['t'], 'x': '\n'.join(t['x'])} for t in turns if t['x']]
    with open(out, 'w', encoding='utf-8') as f:
        f.write('// 자동 생성 파일: tools/build_transcripts.py 로 만들어집니다. 직접 수정하지 마세요.\n')
        f.write('window.__registerTranscript(%s, %s);\n' % (
            json.dumps(iid), json.dumps(data, ensure_ascii=False, indent=0)))
    print(f'{iid}: {len(data)} turns -> {out}')


if __name__ == '__main__':
    main()
